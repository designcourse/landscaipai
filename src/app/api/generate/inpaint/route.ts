import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { deductCredit, refundCredit } from "@/lib/utils/credits";
import { buildInpaintPrompt, buildInpaintPromptForOpenAI } from "@/lib/gemini/prompts";
import {
  getGenerationPath,
  BUCKET_GENERATIONS,
  BUCKET_UPLOADS,
  fetchLibraryImageParts,
} from "@/lib/utils/storage";
import { getImageModel } from "@/lib/image-models";

// Allow up to 3 retry attempts of a ~10-20s AI call inside one request.
export const maxDuration = 60;

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
      referenceImages,
      model,
    } = body as {
      imageId: string;
      projectId: string;
      style?: string;
      timeOfDay?: string;
      season?: string;
      weather?: string;
      customPrompt?: string;
      parentGenerationId?: string;
      maskOverlayBase64?: string;
      rawMaskBase64?: string;
      selectedPlants?: { common_name: string; scientific_name: string | null; image_path?: string | null }[];
      selectedHardscape?: { common_name: string; image_path?: string | null }[];
      referenceImages?: { base64: string; mimeType: string }[];
      model?: string;
    };

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

    // Get source image dimensions for matching AI output resolution
    const sourceMeta = await sharp(sourceBuffer).metadata();
    const sourceWidth = sourceMeta.width ?? 1024;
    const sourceHeight = sourceMeta.height ?? 1024;

    // 5. Create generation record (pending)
    const generationId = crypto.randomUUID();
    const storagePath = getGenerationPath(user.id, projectId, generationId);

    // Pick the model early so we can choose the right prompt dialect.
    // Gemini sees a visual red-overlay mask baked into the image, so it needs
    // "green area" phrasing. OpenAI gets a clean source + separate alpha mask,
    // so it must receive "masked region" phrasing — otherwise it hallucinates.
    const imageModel = getImageModel(model);
    const promptParams = {
      customPrompt: customPrompt.trim(),
      style: style || null,
      timeOfDay,
      season,
      weather,
      selectedPlants,
      selectedHardscape,
      hasSceneChange,
      hasReferenceAttachments: (referenceImages?.length ?? 0) > 0,
    };
    const prompt =
      imageModel.name === "openai"
        ? buildInpaintPromptForOpenAI(promptParams)
        : buildInpaintPrompt(promptParams);

    // Build library items metadata for persistence
    const allLibItems = [...(selectedPlants ?? []), ...(selectedHardscape ?? [])];
    const libraryItemsMeta = allLibItems.length > 0
      ? allLibItems.map((item) => ({
          id: item.common_name,
          name: item.common_name,
          thumbnail_url: item.image_path
            ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/plant-library/${item.image_path}`
            : "",
        }))
      : null;

    console.log(`[inpaint] model=${imageModel.name} generationId=${generationId}`);

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
      image_model: imageModel.name,
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

    // 9. Call the provider's fully self-contained inpaint pipeline.
    // Each provider owns its own post-processing (Gemini composites + feathers
    // with the raw mask; OpenAI relies on its own alpha-mask edit and only
    // resizes). The route does NOT touch the output beyond uploading it.
    let finalImageBuffer: Buffer;
    let finalMimeType: string;

    try {
      const allRefs = [
        ...refImages.map((r) => ({ base64: r.data, mimeType: r.mimeType })),
        ...(referenceImages ?? []),
      ];

      const result = await imageModel.inpaint({
        sourceBuffer,
        sourceMimeType,
        maskOverlayImage: { base64: maskOverlayBase64, mimeType: "image/jpeg" },
        rawMaskBase64,
        referenceImages: allRefs,
        prompt,
        width: sourceWidth,
        height: sourceHeight,
        hasSceneChange,
        onRetry: (err, attempt, nextDelayMs) => {
          const msg = err instanceof Error ? err.message : String(err);
          console.warn(
            `[inpaint/${imageModel.name}] transient error on attempt ${attempt}, retrying in ${Math.round(nextDelayMs)}ms:`,
            msg,
          );
        },
      });

      finalImageBuffer = result.buffer;
      finalMimeType = result.mimeType;
    } catch (err: unknown) {
      await refundCredit(user.id, generationId);

      const rawMessage =
        err instanceof Error ? err.message : "AI generation failed";
      const userMessage = imageModel.friendlyError(err);
      await admin
        .from("generations")
        .update({ status: "failed", error_message: rawMessage })
        .eq("id", generationId);

      return NextResponse.json({ error: userMessage }, { status: 502 });
    }

    // 10. Upload final image to storage
    const { error: uploadError } = await admin.storage
      .from(BUCKET_GENERATIONS)
      .upload(storagePath, finalImageBuffer, {
        contentType: finalMimeType,
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
        image_model: imageModel.name,
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
