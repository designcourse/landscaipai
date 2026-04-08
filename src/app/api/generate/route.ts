import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import sharp from "sharp";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { deductCredit, refundCredit } from "@/lib/utils/credits";
import { buildPrompt } from "@/lib/gemini/prompts";
import { getGenerationPath, BUCKET_GENERATIONS, BUCKET_UPLOADS, fetchLibraryImageParts } from "@/lib/utils/storage";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

/**
 * Determine the closest Gemini imageSize for a given resolution.
 */
function getImageSize(width: number, height: number): string {
  const longest = Math.max(width, height);
  if (longest <= 512) return "512px";
  if (longest <= 1024) return "1K";
  if (longest <= 2048) return "2K";
  return "4K";
}

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
      selectedPlants,
      selectedHardscape,
      referenceImages,
    } = body as {
      imageId: string;
      projectId: string;
      style?: string;
      timeOfDay?: string;
      season?: string;
      weather?: string;
      customPrompt?: string;
      parentGenerationId?: string;
      selectedPlants?: { common_name: string; scientific_name: string | null; image_path?: string | null }[];
      selectedHardscape?: { common_name: string; image_path?: string | null }[];
      referenceImages?: { base64: string; mimeType: string }[];
    };

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
      .select("storage_path")
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
    const sourceBuffer = Buffer.from(arrayBuffer);
    const base64Image = sourceBuffer.toString("base64");
    const mimeType = sourcePath.endsWith(".png")
      ? "image/png"
      : sourcePath.endsWith(".webp")
        ? "image/webp"
        : "image/jpeg";

    // Get source image dimensions for aspect ratio preservation
    const sourceMeta = await sharp(sourceBuffer).metadata();
    const sourceWidth = sourceMeta.width ?? 1024;
    const sourceHeight = sourceMeta.height ?? 1024;
    const imageSize = getImageSize(sourceWidth, sourceHeight);

    // 5. Create generation record (pending)
    const generationId = crypto.randomUUID();
    const storagePath = getGenerationPath(user.id, projectId, generationId);
    const prompt = buildPrompt({ style: style ?? null, timeOfDay, season, weather, customPrompt, selectedPlants, selectedHardscape, sourceWidth, sourceHeight, hasReferenceAttachments: (referenceImages?.length ?? 0) > 0 });

    // Build library items metadata for persistence
    const allItems = [...(selectedPlants ?? []), ...(selectedHardscape ?? [])];
    const libraryItemsMeta = allItems.length > 0
      ? allItems.map((item) => ({
          id: item.common_name,
          name: item.common_name,
          thumbnail_url: item.image_path
            ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/plant-library/${item.image_path}`
            : "",
        }))
      : null;

    const { error: insertError } = await admin.from("generations").insert({
      id: generationId,
      image_id: imageId,
      user_id: user.id,
      parent_generation_id: parentGenerationId || null,
      storage_path: storagePath,
      prompt,
      custom_prompt: customPrompt || null,
      selected_library_items: libraryItemsMeta,
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

    // 7. Update status to processing + fetch reference images in parallel
    const allSelectedItems = [
      ...(selectedPlants ?? []),
      ...(selectedHardscape ?? []),
    ];
    const [, refImages] = await Promise.all([
      admin.from("generations").update({ status: "processing" }).eq("id", generationId),
      fetchLibraryImageParts(admin, allSelectedItems),
    ]);

    // 9. Call Gemini
    let generatedImageBase64: string | null = null;

    try {
      // Build parts: source photo first, then reference images, then prompt
      const parts: { inlineData?: { mimeType: string; data: string }; text?: string }[] = [
        { inlineData: { mimeType, data: base64Image } },
      ];
      for (const ref of refImages) {
        parts.push({ inlineData: { mimeType: ref.mimeType, data: ref.data } });
      }
      // User-attached reference images
      if (referenceImages?.length) {
        for (const ref of referenceImages) {
          parts.push({ inlineData: { mimeType: ref.mimeType, data: ref.base64 } });
        }
      }
      parts.push({ text: prompt });

      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-image-preview",
        contents: [
          {
            role: "user",
            parts,
          },
        ],
        config: {
          responseModalities: ["TEXT", "IMAGE"],
          imageConfig: {
            imageSize,
          },
        },
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
        custom_prompt: customPrompt || null,
        selected_library_items: libraryItemsMeta,
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
