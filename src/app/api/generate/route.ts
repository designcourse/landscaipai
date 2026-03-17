import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { deductCredit, refundCredit } from "@/lib/utils/credits";
import { buildPrompt } from "@/lib/gemini/prompts";
import { getGenerationPath, BUCKET_GENERATIONS, BUCKET_UPLOADS } from "@/lib/utils/storage";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export async function POST(request: NextRequest) {
  try {
    // 1. Auth check
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Parse body
    const body = await request.json();
    const {
      imageId,
      projectId,
      style,
      timeOfDay,
      season,
      weather,
      customPrompt,
      parentGenerationId,
    } = body;

    if (!imageId || !projectId) {
      return NextResponse.json(
        { error: "imageId and projectId are required" },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    // 3. Verify image ownership
    const { data: image } = await admin
      .from("images")
      .select("*")
      .eq("id", imageId)
      .eq("user_id", user.id)
      .single();

    if (!image) {
      return NextResponse.json({ error: "Image not found" }, { status: 404 });
    }

    // 4. Get source image bytes (original upload or parent generation)
    let sourcePath: string;
    let sourceBucket: string;

    if (parentGenerationId) {
      const { data: parentGen } = await admin
        .from("generations")
        .select("storage_path")
        .eq("id", parentGenerationId)
        .eq("user_id", user.id)
        .single();

      if (!parentGen) {
        return NextResponse.json(
          { error: "Parent generation not found" },
          { status: 404 }
        );
      }
      sourcePath = parentGen.storage_path;
      sourceBucket = BUCKET_GENERATIONS;
    } else {
      sourcePath = image.storage_path;
      sourceBucket = BUCKET_UPLOADS;
    }

    const { data: fileData, error: downloadError } = await admin.storage
      .from(sourceBucket)
      .download(sourcePath);

    if (downloadError || !fileData) {
      return NextResponse.json(
        { error: "Failed to download source image" },
        { status: 500 }
      );
    }

    const arrayBuffer = await fileData.arrayBuffer();
    const base64Image = Buffer.from(arrayBuffer).toString("base64");
    const mimeType = sourcePath.endsWith(".png")
      ? "image/png"
      : sourcePath.endsWith(".webp")
        ? "image/webp"
        : "image/jpeg";

    // 5. Create generation record (pending)
    const generationId = crypto.randomUUID();
    const storagePath = getGenerationPath(user.id, projectId, generationId);
    const prompt = buildPrompt({ style, timeOfDay, season, weather, customPrompt });

    const { error: insertError } = await admin.from("generations").insert({
      id: generationId,
      image_id: imageId,
      user_id: user.id,
      parent_generation_id: parentGenerationId || null,
      storage_path: storagePath,
      prompt,
      style_preset: style || null,
      time_of_day: timeOfDay || null,
      season: season || null,
      weather: weather || null,
      is_inpaint: false,
      status: "pending",
    });

    if (insertError) {
      return NextResponse.json(
        { error: "Failed to create generation record" },
        { status: 500 }
      );
    }

    // 6. Deduct credit
    const deducted = await deductCredit(user.id, generationId);
    if (!deducted) {
      await admin
        .from("generations")
        .update({ status: "failed", error_message: "Insufficient credits" })
        .eq("id", generationId);

      return NextResponse.json(
        { error: "Insufficient credits", code: "NO_CREDITS" },
        { status: 402 }
      );
    }

    // 7. Update status to processing
    await admin
      .from("generations")
      .update({ status: "processing" })
      .eq("id", generationId);

    // 8. Call Gemini
    let generatedImageBase64: string | null = null;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-image-preview",
        contents: [
          {
            role: "user",
            parts: [
              { inlineData: { mimeType, data: base64Image } },
              { text: prompt },
            ],
          },
        ],
      });

      for (const part of response.candidates?.[0]?.content?.parts ?? []) {
        if (part.inlineData?.data) {
          generatedImageBase64 = part.inlineData.data;
          break;
        }
      }

      if (!generatedImageBase64) {
        throw new Error("No image returned from Gemini");
      }
    } catch (err: unknown) {
      // Refund credit on AI failure
      await refundCredit(user.id, generationId);

      const message =
        err instanceof Error ? err.message : "AI generation failed";
      await admin
        .from("generations")
        .update({ status: "failed", error_message: message })
        .eq("id", generationId);

      return NextResponse.json({ error: message }, { status: 500 });
    }

    // 9. Upload generated image to storage
    const imageBuffer = Buffer.from(generatedImageBase64, "base64");

    const { error: uploadError } = await admin.storage
      .from(BUCKET_GENERATIONS)
      .upload(storagePath, imageBuffer, {
        contentType: "image/webp",
        cacheControl: "3600",
      });

    if (uploadError) {
      await refundCredit(user.id, generationId);
      await admin
        .from("generations")
        .update({ status: "failed", error_message: "Failed to save result" })
        .eq("id", generationId);

      return NextResponse.json(
        { error: "Failed to save generated image" },
        { status: 500 }
      );
    }

    // 10. Mark completed
    await admin
      .from("generations")
      .update({ status: "completed" })
      .eq("id", generationId);

    // 11. Get signed URL + updated credit balance (parallel)
    const [{ data: urlData }, { data: profile }] = await Promise.all([
      admin.storage.from(BUCKET_GENERATIONS).createSignedUrl(storagePath, 3600),
      admin.from("profiles").select("credits_balance").eq("id", user.id).single(),
    ]);

    return NextResponse.json({
      generation: {
        id: generationId,
        image_id: imageId,
        status: "completed",
        prompt,
        style_preset: style || null,
        time_of_day: timeOfDay || null,
        season: season || null,
        weather: weather || null,
        url: urlData?.signedUrl ?? "",
      },
      credits_remaining: profile?.credits_balance ?? 0,
    });
  } catch (err) {
    console.error("Generation error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
