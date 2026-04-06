import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import sharp from "sharp";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { deductCredit, refundCredit } from "@/lib/utils/credits";
import { buildInpaintPrompt } from "@/lib/gemini/prompts";
import {
  getGenerationPath,
  BUCKET_GENERATIONS,
  BUCKET_UPLOADS,
  fetchLibraryImageParts,
} from "@/lib/utils/storage";

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

/**
 * Composite the original image with the AI-generated result using the mask.
 * - Black mask pixels → original image (untouched)
 * - White mask pixels → Gemini result
 * - Feathered boundary (15px blur) for smooth blending at mask edges
 */
async function compositeWithMask(
  originalBuffer: Buffer,
  generatedBuffer: Buffer,
  maskBuffer: Buffer
): Promise<Buffer> {
  const { width: w, height: h } = await sharp(originalBuffer).metadata();
  const width = w!;
  const height = h!;

  // Blur creates a gradient at the mask boundary for smooth blending
  const featherRadius = Math.max(7, Math.round(Math.min(width, height) * 0.01));
  const sigma = featherRadius % 2 === 0 ? featherRadius + 1 : featherRadius;

  // Parallelize all three resize operations — ensure 3-channel RGB (no alpha surprises)
  const [resizedGenerated, processedMask, originalRaw] = await Promise.all([
    sharp(generatedBuffer).resize(width, height, { fit: "fill" }).removeAlpha().raw().toBuffer(),
    sharp(maskBuffer).resize(width, height, { fit: "fill" }).grayscale().blur(sigma).raw().toBuffer(),
    sharp(originalBuffer).resize(width, height, { fit: "fill" }).removeAlpha().raw().toBuffer(),
  ]);

  // Composite: alpha-blend original and generated based on mask intensity
  const outputPixels = Buffer.alloc(width * height * 3);
  for (let i = 0; i < width * height; i++) {
    const maskVal = processedMask[i] / 255; // 0 = keep original, 1 = use generated
    const ri = i * 3;
    outputPixels[ri] = Math.round(
      originalRaw[ri] * (1 - maskVal) + resizedGenerated[ri] * maskVal
    );
    outputPixels[ri + 1] = Math.round(
      originalRaw[ri + 1] * (1 - maskVal) + resizedGenerated[ri + 1] * maskVal
    );
    outputPixels[ri + 2] = Math.round(
      originalRaw[ri + 2] * (1 - maskVal) + resizedGenerated[ri + 2] * maskVal
    );
  }

  return sharp(outputPixels, { raw: { width, height, channels: 3 } })
    .webp({ quality: 90 })
    .toBuffer();
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
      maskOverlayBase64,
      rawMaskBase64,
      selectedPlants,
      selectedHardscape,
    } = body;

    if (!imageId || !projectId) {
      return NextResponse.json(
        { error: "imageId and projectId are required" },
        { status: 400 }
      );
    }

    if (!maskOverlayBase64) {
      return NextResponse.json(
        { error: "maskOverlayBase64 is required" },
        { status: 400 }
      );
    }

    if (!customPrompt?.trim()) {
      return NextResponse.json(
        { error: "A prompt describing the edit is required" },
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
    // Detect if scene-wide settings (time/season/weather) changed from the parent.
    // When they change, we skip mask compositing so the full Gemini output is used
    // (otherwise compositing pastes the old lighting back over non-masked areas).
    let hasSceneChange = !!(timeOfDay || season || weather);

    if (parentGenerationId) {
      const { data: parentGen } = await admin
        .from("generations")
        .select("storage_path, time_of_day, season, weather")
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

      // Only flag as scene change if settings actually differ from parent
      hasSceneChange =
        (!!timeOfDay && timeOfDay !== (parentGen.time_of_day ?? "")) ||
        (!!season && season !== (parentGen.season ?? "")) ||
        (!!weather && weather !== (parentGen.weather ?? ""));
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
    const sourceBase64 = sourceBuffer.toString("base64");
    const sourceMimeType = sourcePath.endsWith(".png")
      ? "image/png"
      : sourcePath.endsWith(".webp")
        ? "image/webp"
        : "image/jpeg";

    // Get source image dimensions for matching Gemini output resolution
    const sourceMeta = await sharp(sourceBuffer).metadata();
    const imageSize = getImageSize(sourceMeta.width ?? 1024, sourceMeta.height ?? 1024);

    // 5. Create generation record (pending)
    const generationId = crypto.randomUUID();
    const storagePath = getGenerationPath(user.id, projectId, generationId);
    const prompt = buildInpaintPrompt({
      customPrompt: customPrompt.trim(),
      style: style || null,
      timeOfDay,
      season,
      weather,
      selectedPlants,
      selectedHardscape,
      hasSceneChange,
    });

    // Build library items metadata for persistence
    const allLibItems = [...(selectedPlants ?? []), ...(selectedHardscape ?? [])];
    const libraryItemsMeta = allLibItems.length > 0
      ? allLibItems.map((item: { common_name: string; image_path?: string }) => ({
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
      custom_prompt: customPrompt?.trim() || null,
      selected_library_items: libraryItemsMeta,
      style_preset: style || null,
      time_of_day: timeOfDay || null,
      season: season || null,
      weather: weather || null,
      is_inpaint: true,
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

    // 9. Call Gemini — send mask overlay + reference images + prompt
    let generatedImageBase64: string | null = null;

    try {
      const parts: { inlineData?: { mimeType: string; data: string }; text?: string }[] = [
        { inlineData: { mimeType: "image/jpeg", data: maskOverlayBase64 } },
      ];
      for (const ref of refImages) {
        parts.push({ inlineData: { mimeType: ref.mimeType, data: ref.data } });
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

      let textResponse = "";
      for (const part of response.candidates?.[0]?.content?.parts ?? []) {
        if (part.inlineData?.data) {
          generatedImageBase64 = part.inlineData.data;
          break;
        }
        if (part.text) {
          textResponse += part.text;
        }
      }

      if (!generatedImageBase64) {
        const detail = textResponse
          ? `Gemini responded with text instead of an image: "${textResponse.slice(0, 200)}"`
          : "No image returned from Gemini";
        throw new Error(detail);
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

    // 9. Composite: blend original + Gemini result using the raw mask
    // This guarantees pixel-perfect preservation outside the masked area
    // with a feathered boundary for natural blending.
    // EXCEPTION: when scene-wide settings changed (time/season/weather), skip
    // compositing so the full Gemini output is used — otherwise compositing
    // pastes the old lighting/atmosphere back over the non-masked areas.
    let finalImageBuffer: Buffer;

    if (rawMaskBase64 && !hasSceneChange) {
      console.log("[inpaint] Compositing with mask — rawMaskBase64 length:", rawMaskBase64.length);
      const generatedBuffer = Buffer.from(generatedImageBase64, "base64");
      const maskBuffer = Buffer.from(rawMaskBase64, "base64");
      finalImageBuffer = await compositeWithMask(
        sourceBuffer,
        generatedBuffer,
        maskBuffer
      );
    } else {
      if (hasSceneChange) {
        console.log("[inpaint] Scene settings changed — using full Gemini output (no compositing)");
      } else {
        console.warn("[inpaint] No rawMaskBase64 — skipping composite, using raw Gemini output");
      }
      // Use full Gemini output, resize to match source dimensions
      const generatedBuffer = Buffer.from(generatedImageBase64, "base64");
      finalImageBuffer = await sharp(generatedBuffer)
        .resize(sourceMeta.width!, sourceMeta.height!, { fit: "fill" })
        .webp({ quality: 90 })
        .toBuffer();
    }

    // 10. Upload final image to storage
    const { error: uploadError } = await admin.storage
      .from(BUCKET_GENERATIONS)
      .upload(storagePath, finalImageBuffer, {
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

    // 12. Mark completed
    await admin
      .from("generations")
      .update({ status: "completed" })
      .eq("id", generationId);

    // 13. Get signed URL + updated credit balance
    const [{ data: urlData }, { data: profile }] = await Promise.all([
      admin.storage
        .from(BUCKET_GENERATIONS)
        .createSignedUrl(storagePath, 3600),
      admin
        .from("profiles")
        .select("credits_balance")
        .eq("id", user.id)
        .single(),
    ]);

    return NextResponse.json({
      generation: {
        id: generationId,
        image_id: imageId,
        status: "completed",
        prompt,
        custom_prompt: customPrompt?.trim() || null,
        selected_library_items: libraryItemsMeta,
        style_preset: style || null,
        time_of_day: timeOfDay || null,
        season: season || null,
        weather: weather || null,
        is_inpaint: true,
        url: urlData?.signedUrl ?? "",
      },
      credits_remaining: profile?.credits_balance ?? 0,
    });
  } catch (err) {
    console.error("Inpaint generation error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
