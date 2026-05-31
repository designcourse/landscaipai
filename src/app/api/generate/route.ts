import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { deductCredit, refundCredit } from "@/lib/utils/credits";
import { buildPrompt, VARIATION_DIRECTIVES, buildAspectGuardrails, buildDetailLines } from "@/lib/gemini/prompts";
import { planConcepts, type PlannedConcept } from "@/lib/gemini/planner";
import { getGenerationPath, BUCKET_GENERATIONS, BUCKET_UPLOADS, fetchLibraryImageParts } from "@/lib/utils/storage";
import { getImageModel } from "@/lib/image-models";
import { VARIATIONS_PER_GENERATION, VARIATION_MAX_DIMENSION, PLANNER_ENABLED } from "@/lib/image-models/config";
import { applyFreeTierWatermark } from "@/lib/utils/watermark";
import { isPayingCustomer } from "@/lib/billing/status";

// Up to 3 retry attempts of a ~10-20s AI call, now fanned out across N variants
// in parallel — wall-clock stays close to a single call.
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

    // Source dimensions, used both for aspect-ratio preservation and to derive
    // a capped target size for the variation batch.
    const sourceMeta = await sharp(sourceBuffer).metadata();
    const sourceWidth = sourceMeta.width ?? 1024;
    const sourceHeight = sourceMeta.height ?? 1024;

    // Cap the batch resolution: N images per request is N x the API cost, so we
    // render the explore batch at a modest size and downscale the model input to
    // match. Aspect ratio is preserved (uniform scale).
    const longestEdge = Math.max(sourceWidth, sourceHeight);
    const scale = longestEdge > VARIATION_MAX_DIMENSION ? VARIATION_MAX_DIMENSION / longestEdge : 1;
    const targetWidth = Math.max(1, Math.round(sourceWidth * scale));
    const targetHeight = Math.max(1, Math.round(sourceHeight * scale));

    const modelInputBase64 =
      scale < 1
        ? (
            await sharp(sourceBuffer)
              .resize(targetWidth, targetHeight, { fit: "inside" })
              .toBuffer()
          ).toString("base64")
        : base64Image;

    // Library items metadata for persistence (shared across all variants).
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

    const imageModel = getImageModel(model);

    // AI landscaping planner (fresh generations only): analyzes the photo and
    // returns budget-tiered, photo-tailored concepts. Falls back to the
    // deterministic template if disabled, an iteration, or on any error.
    let plannedConcepts: PlannedConcept[] | null = null;
    if (PLANNER_ENABLED && !parentGenerationId && VARIATIONS_PER_GENERATION > 1) {
      try {
        const concepts = await planConcepts({
          base64: modelInputBase64,
          mimeType,
          style,
          customPrompt,
          timeOfDay,
          season,
          weather,
          selectedPlants,
          selectedHardscape,
          hasReferenceAttachments: (referenceImages?.length ?? 0) > 0,
        });
        if (concepts.length >= VARIATIONS_PER_GENERATION) {
          plannedConcepts = concepts;
          console.log(`[generate] planner produced ${concepts.length} concepts`);
        } else {
          console.warn(`[generate] planner returned ${concepts.length} concepts (<${VARIATIONS_PER_GENERATION}); using template`);
        }
      } catch (err) {
        console.warn(`[generate] planner failed, using template:`, err instanceof Error ? err.message : err);
      }
    }

    // 5. Build N pending generation records grouped by a batch id. Each variant
    //    gets a tailored planner concept (or a template directive) + a seed.
    const batchId = crypto.randomUUID();
    const variantCount = Math.max(1, VARIATIONS_PER_GENERATION);
    const variants = Array.from({ length: variantCount }, (_, index) => {
      const id = crypto.randomUUID();
      const concept = plannedConcepts?.[index];
      let prompt: string;
      let conceptLabel: string | null = null;
      if (concept) {
        conceptLabel = concept.tier || concept.name || null;
        const details = buildDetailLines({
          timeOfDay,
          season,
          weather,
          selectedPlants,
          selectedHardscape,
          hasReferenceAttachments: (referenceImages?.length ?? 0) > 0,
        });
        prompt = [concept.prompt, details, buildAspectGuardrails(targetWidth, targetHeight)]
          .filter(Boolean)
          .join(" ");
      } else {
        const variationDirective =
          variantCount > 1 ? VARIATION_DIRECTIVES[index % VARIATION_DIRECTIVES.length] : undefined;
        prompt = buildPrompt({
          style: style ?? null,
          timeOfDay,
          season,
          weather,
          customPrompt,
          selectedPlants,
          selectedHardscape,
          sourceWidth: targetWidth,
          sourceHeight: targetHeight,
          hasReferenceAttachments: (referenceImages?.length ?? 0) > 0,
          variationDirective,
        });
      }
      return {
        index,
        id,
        prompt,
        conceptLabel,
        storagePath: getGenerationPath(user.id, projectId, id),
        seed: Math.floor(Math.random() * 2_147_483_647),
      };
    });

    console.log(
      `[generate] model=${imageModel.name} batch=${batchId} variants=${variantCount} size=${targetWidth}x${targetHeight}`,
    );

    const { error: insertError } = await admin.from("generations").insert(
      variants.map((v) => ({
        id: v.id,
        image_id: imageId,
        user_id: user.id,
        parent_generation_id: parentGenerationId || null,
        batch_id: batchId,
        variant_index: v.index,
        storage_path: v.storagePath,
        prompt: v.prompt,
        custom_prompt: customPrompt || null,
        selected_library_items: libraryItemsMeta,
        style_preset: style || null,
        time_of_day: timeOfDay || null,
        season: season || null,
        weather: weather || null,
        is_inpaint: false,
        status: "pending",
        image_model: imageModel.name,
        concept_label: v.conceptLabel,
      })),
    );

    if (insertError) {
      return NextResponse.json(
        { error: "Failed to create generation record" },
        { status: 500 }
      );
    }

    // 6. Deduct ONE credit for the whole batch (tracked against the first variant).
    const creditRef = variants[0].id;
    const deducted = await deductCredit(user.id, creditRef);
    if (!deducted) {
      await admin
        .from("generations")
        .update({ status: "failed", error_message: "Insufficient credits" })
        .eq("batch_id", batchId);

      return NextResponse.json(
        { error: "Insufficient credits", code: "NO_CREDITS" },
        { status: 402 }
      );
    }

    // 7. Move batch to processing + fetch shared reference images in parallel.
    const allSelectedItems = [
      ...(selectedPlants ?? []),
      ...(selectedHardscape ?? []),
    ];
    const [, refImages] = await Promise.all([
      admin.from("generations").update({ status: "processing" }).eq("batch_id", batchId),
      fetchLibraryImageParts(admin, allSelectedItems),
    ]);

    const allRefs = [
      ...refImages.map((r) => ({ base64: r.data, mimeType: r.mimeType })),
      ...(referenceImages ?? []),
    ];

    // Free-tier (non-paying) users get a faint centered leaf watermark baked
    // into every output; paying customers and admins get clean images.
    const paid = await isPayingCustomer(admin, user.id);

    // 8. Generate every variant in parallel. A failed variant marks only its own
    //    row failed and resolves to null; its siblings are unaffected.
    let failureSample: unknown = null;
    const settled = await Promise.all(
      variants.map(async (v) => {
        try {
          const result = await imageModel.generate({
            sourceImage: { base64: modelInputBase64, mimeType },
            referenceImages: allRefs,
            prompt: v.prompt,
            width: targetWidth,
            height: targetHeight,
            seed: v.seed,
            onRetry: (err, attempt, nextDelayMs) => {
              const msg = err instanceof Error ? err.message : String(err);
              console.warn(
                `[generate/${imageModel.name}] batch=${batchId} variant=${v.index} transient error on attempt ${attempt}, retrying in ${Math.round(nextDelayMs)}ms:`,
                msg,
              );
            },
          });

          const rawBuffer = Buffer.from(result.base64, "base64");
          const imageBuffer = paid ? rawBuffer : await applyFreeTierWatermark(rawBuffer);
          const { error: uploadError } = await admin.storage
            .from(BUCKET_GENERATIONS)
            .upload(v.storagePath, imageBuffer, {
              contentType: "image/webp",
              cacheControl: "3600",
            });
          if (uploadError) throw new Error("Failed to save result");

          await admin.from("generations").update({ status: "completed" }).eq("id", v.id);

          const { data: urlData } = await admin.storage
            .from(BUCKET_GENERATIONS)
            .createSignedUrl(v.storagePath, 3600);

          return {
            id: v.id,
            image_id: imageId,
            status: "completed" as const,
            prompt: v.prompt,
            custom_prompt: customPrompt || null,
            selected_library_items: libraryItemsMeta,
            style_preset: style || null,
            time_of_day: timeOfDay || null,
            season: season || null,
            weather: weather || null,
            image_model: imageModel.name,
            batch_id: batchId,
            variant_index: v.index,
            concept_label: v.conceptLabel,
            url: urlData?.signedUrl ?? "",
          };
        } catch (err: unknown) {
          failureSample = err;
          const rawMessage = err instanceof Error ? err.message : "AI generation failed";
          await admin
            .from("generations")
            .update({ status: "failed", error_message: rawMessage })
            .eq("id", v.id);
          return null;
        }
      }),
    );

    const succeeded = settled
      .filter((g): g is NonNullable<typeof g> => g !== null)
      .sort((a, b) => a.variant_index - b.variant_index);

    // 9. If every variant failed, refund the one credit and surface the error.
    if (succeeded.length === 0) {
      await refundCredit(user.id, creditRef);
      return NextResponse.json(
        { error: imageModel.friendlyError(failureSample) },
        { status: 502 }
      );
    }

    // 10. Return all successful variants + updated balance.
    const { data: profile } = await admin
      .from("profiles")
      .select("credits_balance")
      .eq("id", user.id)
      .single();

    return NextResponse.json({
      batch_id: batchId,
      generations: succeeded,
      // Backward-compat for the legacy (_generate_old) workspace, which reads `generation`.
      generation: succeeded[0],
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
