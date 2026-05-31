import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { deductCredit, refundCredit } from "@/lib/utils/credits";
import { getGenerationPath, BUCKET_GENERATIONS } from "@/lib/utils/storage";
import { getImageModel } from "@/lib/image-models";

export const maxDuration = 60;

// Image-to-image "enhance" — we feed the chosen (1K explore) variation back in
// and re-render it at the original photo's full resolution, preserving the exact
// composition. This is the paywalled HD step that pairs with the cheap 3-up
// explore batch (variations render at a 1024px cap; finalize restores full res).
const FINALIZE_PROMPT =
  "Upscale this landscape design to a crisp, high-resolution, photorealistic image. " +
  "Preserve the EXACT composition, layout, plants, hardscape, materials, colors, and " +
  "lighting precisely as shown — do not redesign, add, remove, or move anything. Only " +
  "increase resolution, sharpness, and fine natural detail. Keep the identical aspect " +
  "ratio and framing.";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { generationId } = (await request.json()) as { generationId?: string };
    if (!generationId) {
      return NextResponse.json({ error: "generationId is required" }, { status: 400 });
    }

    const admin = createAdminClient();

    // 1. Load the chosen generation (must be the user's, completed)
    const { data: src } = await admin
      .from("generations")
      .select(
        "id, image_id, storage_path, status, style_preset, time_of_day, season, weather, custom_prompt, selected_library_items, image_model",
      )
      .eq("id", generationId)
      .eq("user_id", user.id)
      .single();

    if (!src) return NextResponse.json({ error: "Generation not found" }, { status: 404 });
    if (src.status !== "completed") {
      return NextResponse.json(
        { error: "This image isn't ready to finalize yet." },
        { status: 400 },
      );
    }

    // 2. Resolve the project + full-resolution target from the source upload.
    const { data: imageRow } = await admin
      .from("images")
      .select("width, height, project_id")
      .eq("id", src.image_id)
      .single();

    const projectId = imageRow?.project_id;
    if (!projectId) {
      return NextResponse.json({ error: "Source project not found" }, { status: 404 });
    }

    // 3. Download the chosen variation's bytes (the image we're enhancing).
    const { data: fileData, error: dlErr } = await admin.storage
      .from(BUCKET_GENERATIONS)
      .download(src.storage_path);
    if (dlErr || !fileData) {
      return NextResponse.json({ error: "Failed to load the image to finalize" }, { status: 500 });
    }
    const pickedBuffer = Buffer.from(await fileData.arrayBuffer());

    let targetWidth = imageRow?.width ?? 0;
    let targetHeight = imageRow?.height ?? 0;
    if (!targetWidth || !targetHeight) {
      const meta = await sharp(pickedBuffer).metadata();
      targetWidth = meta.width ?? 1024;
      targetHeight = meta.height ?? 1024;
    }

    const imageModel = getImageModel(src.image_model);

    // 4. Create the finalized generation record (child of the chosen variation).
    const finalId = crypto.randomUUID();
    const storagePath = getGenerationPath(user.id, projectId, finalId);

    const { error: insertError } = await admin.from("generations").insert({
      id: finalId,
      image_id: src.image_id,
      user_id: user.id,
      parent_generation_id: src.id,
      storage_path: storagePath,
      prompt: FINALIZE_PROMPT,
      custom_prompt: src.custom_prompt,
      selected_library_items: src.selected_library_items,
      style_preset: src.style_preset,
      time_of_day: src.time_of_day,
      season: src.season,
      weather: src.weather,
      is_inpaint: false,
      is_finalized: true,
      status: "pending",
      image_model: imageModel.name,
    });
    if (insertError) {
      return NextResponse.json({ error: "Failed to create generation record" }, { status: 500 });
    }

    // 5. Deduct one credit for the HD render.
    const deducted = await deductCredit(user.id, finalId);
    if (!deducted) {
      await admin
        .from("generations")
        .update({ status: "failed", error_message: "Insufficient credits" })
        .eq("id", finalId);
      return NextResponse.json({ error: "Insufficient credits", code: "NO_CREDITS" }, { status: 402 });
    }

    await admin.from("generations").update({ status: "processing" }).eq("id", finalId);

    // 6. Re-render the picked image at full resolution.
    let resultBase64: string;
    try {
      const mimeType = src.storage_path.endsWith(".png")
        ? "image/png"
        : src.storage_path.endsWith(".jpg") || src.storage_path.endsWith(".jpeg")
          ? "image/jpeg"
          : "image/webp";

      const result = await imageModel.generate({
        sourceImage: { base64: pickedBuffer.toString("base64"), mimeType },
        referenceImages: [],
        prompt: FINALIZE_PROMPT,
        width: targetWidth,
        height: targetHeight,
        onRetry: (err, attempt, nextDelayMs) => {
          const msg = err instanceof Error ? err.message : String(err);
          console.warn(
            `[finalize/${imageModel.name}] gen=${finalId} transient error on attempt ${attempt}, retrying in ${Math.round(nextDelayMs)}ms:`,
            msg,
          );
        },
      });
      resultBase64 = result.base64;
    } catch (err: unknown) {
      await refundCredit(user.id, finalId);
      const rawMessage = err instanceof Error ? err.message : "AI generation failed";
      await admin
        .from("generations")
        .update({ status: "failed", error_message: rawMessage })
        .eq("id", finalId);
      return NextResponse.json({ error: imageModel.friendlyError(err) }, { status: 502 });
    }

    // 7. Upload + mark completed.
    const outBuffer = Buffer.from(resultBase64, "base64");
    const { error: uploadError } = await admin.storage
      .from(BUCKET_GENERATIONS)
      .upload(storagePath, outBuffer, { contentType: "image/webp", cacheControl: "3600" });
    if (uploadError) {
      await refundCredit(user.id, finalId);
      await admin
        .from("generations")
        .update({ status: "failed", error_message: "Failed to save result" })
        .eq("id", finalId);
      return NextResponse.json({ error: "Failed to save finalized image" }, { status: 500 });
    }

    await admin.from("generations").update({ status: "completed" }).eq("id", finalId);

    const [{ data: urlData }, { data: profile }] = await Promise.all([
      admin.storage.from(BUCKET_GENERATIONS).createSignedUrl(storagePath, 3600),
      admin.from("profiles").select("credits_balance").eq("id", user.id).single(),
    ]);

    return NextResponse.json({
      generation: {
        id: finalId,
        image_id: src.image_id,
        status: "completed",
        prompt: FINALIZE_PROMPT,
        custom_prompt: src.custom_prompt,
        selected_library_items: src.selected_library_items,
        style_preset: src.style_preset,
        time_of_day: src.time_of_day,
        season: src.season,
        weather: src.weather,
        image_model: imageModel.name,
        parent_generation_id: src.id,
        url: urlData?.signedUrl ?? "",
        finalized: true,
      },
      credits_remaining: profile?.credits_balance ?? 0,
    });
  } catch (err) {
    console.error("Finalize error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
