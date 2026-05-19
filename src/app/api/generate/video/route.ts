import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { deductCredits, refundCredits } from "@/lib/utils/credits";
import {
  buildVideoPrompt,
  buildVideoNegativePrompt,
  computeCreditCost,
  CAMERA_PRESETS,
  TRANSITION_PRESETS,
  VIDEO_MODELS,
  DEFAULT_VIDEO_MODEL_ID,
  DEFAULT_CAMERA_PRESET_ID,
  DEFAULT_TRANSITION_PRESET_ID,
  DEFAULT_RESOLUTION,
  type ResolutionOption,
} from "@/lib/gemini/video-prompts";
import {
  BUCKET_UPLOADS,
  BUCKET_GENERATIONS,
} from "@/lib/utils/storage";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

// Veo 3.1 first/last-frame interpolation locks duration at 8s. Kept at module
// scope because Turbopack (Next.js 16) was incorrectly eliminating a
// function-local `const durationSeconds = 8` whose references all looked like
// shorthand object props (`{ durationSeconds }`) — at runtime the references
// then threw `ReferenceError: durationSeconds is not defined`. A module-level
// const is never elided, which sidesteps the bug entirely.
const VIDEO_DURATION_SECONDS = 8;

// Frame source can be either an original upload or a prior generation
interface FrameSource {
  kind: "image" | "generation";
  id: string;
}

/**
 * Download a frame's bytes from the appropriate bucket and return base64 + mime.
 */
async function loadFrameBytes(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  source: FrameSource
): Promise<{ base64: string; mimeType: string; width: number | null; height: number | null }> {
  if (source.kind === "image") {
    const { data: img, error } = await admin
      .from("images")
      .select("storage_path, width, height")
      .eq("id", source.id)
      .eq("user_id", userId)
      .single();
    if (error || !img) throw new Error(`Frame image ${source.id} not found`);

    const { data: fileData, error: dlError } = await admin.storage
      .from(BUCKET_UPLOADS)
      .download(img.storage_path);
    if (dlError || !fileData) throw new Error(`Failed to download frame image ${source.id}`);

    const buf = Buffer.from(await fileData.arrayBuffer());
    const mimeType = img.storage_path.endsWith(".png")
      ? "image/png"
      : img.storage_path.endsWith(".webp")
        ? "image/webp"
        : "image/jpeg";
    return {
      base64: buf.toString("base64"),
      mimeType,
      width: img.width,
      height: img.height,
    };
  } else {
    // Generation — look up the generation row + its parent image for dims
    const { data: gen, error } = await admin
      .from("generations")
      .select("storage_path, image_id")
      .eq("id", source.id)
      .eq("user_id", userId)
      .single();
    if (error || !gen) throw new Error(`Frame generation ${source.id} not found`);

    const { data: parentImg } = await admin
      .from("images")
      .select("width, height")
      .eq("id", gen.image_id)
      .single();

    const { data: fileData, error: dlError } = await admin.storage
      .from(BUCKET_GENERATIONS)
      .download(gen.storage_path);
    if (dlError || !fileData) throw new Error(`Failed to download frame generation ${source.id}`);

    const buf = Buffer.from(await fileData.arrayBuffer());
    return {
      base64: buf.toString("base64"),
      mimeType: "image/webp",
      width: parentImg?.width ?? null,
      height: parentImg?.height ?? null,
    };
  }
}

function aspectRatioString(width: number | null, height: number | null): string {
  if (!width || !height) return "16:9";
  const ratio = width / height;
  // Snap to the closest Veo-supported aspect ratio
  if (Math.abs(ratio - 16 / 9) < 0.1) return "16:9";
  if (Math.abs(ratio - 9 / 16) < 0.1) return "9:16";
  if (Math.abs(ratio - 1) < 0.05) return "1:1";
  // Fallback: default to the closer of 16:9 / 9:16
  return ratio >= 1 ? "16:9" : "9:16";
}

export async function POST(request: NextRequest) {
  try {
    // 1. Auth
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Parse
    const body = await request.json();
    const {
      projectId,
      startFrame,
      endFrame,
      modelId = DEFAULT_VIDEO_MODEL_ID,
      cameraPresetId = DEFAULT_CAMERA_PRESET_ID,
      transitionPresetId = DEFAULT_TRANSITION_PRESET_ID,
      resolution = DEFAULT_RESOLUTION,
      customPrompt,
    } = body as {
      projectId: string;
      startFrame: FrameSource;
      endFrame: FrameSource;
      modelId?: string;
      cameraPresetId?: string;
      transitionPresetId?: string;
      resolution?: ResolutionOption;
      customPrompt?: string;
    };

    if (!projectId || !startFrame || !endFrame) {
      return NextResponse.json(
        { error: "projectId, startFrame, and endFrame are required" },
        { status: 400 }
      );
    }

    // Validate model + presets
    const modelOption = VIDEO_MODELS.find((m) => m.id === modelId);
    if (!modelOption) {
      return NextResponse.json({ error: "Invalid modelId" }, { status: 400 });
    }
    if (!CAMERA_PRESETS.find((c) => c.id === cameraPresetId)) {
      return NextResponse.json({ error: "Invalid cameraPresetId" }, { status: 400 });
    }
    if (!TRANSITION_PRESETS.find((t) => t.id === transitionPresetId)) {
      return NextResponse.json({ error: "Invalid transitionPresetId" }, { status: 400 });
    }
    if (resolution !== "720p" && resolution !== "1080p") {
      return NextResponse.json({ error: "Resolution must be 720p or 1080p" }, { status: 400 });
    }

    const admin = createAdminClient();

    // 3. Verify project ownership
    const { data: project } = await admin
      .from("projects")
      .select("id, user_id")
      .eq("id", projectId)
      .eq("user_id", user.id)
      .single();
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // 4. Load both frames in parallel
    let startData, endData;
    try {
      [startData, endData] = await Promise.all([
        loadFrameBytes(admin, user.id, startFrame),
        loadFrameBytes(admin, user.id, endFrame),
      ]);
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Failed to load frames" },
        { status: 404 }
      );
    }

    // 5. Verify aspect ratio matches (exact pixel match enforced client-side,
    //    but double-check server-side as a safety net)
    if (
      startData.width != null &&
      startData.height != null &&
      endData.width != null &&
      endData.height != null
    ) {
      const startRatio = startData.width / startData.height;
      const endRatio = endData.width / endData.height;
      if (Math.abs(startRatio - endRatio) > 0.01) {
        return NextResponse.json(
          { error: "Start and end frames must have the same aspect ratio" },
          { status: 400 }
        );
      }
    }

    // 6. Compute cost + build prompt
    const cost = computeCreditCost({
      modelId,
      durationSeconds: VIDEO_DURATION_SECONDS,
      resolution,
    });
    const motionPrompt = buildVideoPrompt({
      cameraPresetId,
      transitionPresetId,
      customPrompt,
    });
    const aspectRatio = aspectRatioString(startData.width, startData.height);

    // 7. Create video_generations row (pending)
    const { data: created, error: insertError } = await admin
      .from("video_generations")
      .insert({
        user_id: user.id,
        project_id: projectId,
        start_image_id: startFrame.kind === "image" ? startFrame.id : null,
        start_generation_id: startFrame.kind === "generation" ? startFrame.id : null,
        end_image_id: endFrame.kind === "image" ? endFrame.id : null,
        end_generation_id: endFrame.kind === "generation" ? endFrame.id : null,
        model: modelOption.apiModel,
        duration_seconds: VIDEO_DURATION_SECONDS,
        resolution,
        aspect_ratio: aspectRatio,
        camera_preset: cameraPresetId,
        transition_preset: transitionPresetId,
        motion_prompt: motionPrompt,
        generate_audio: false,
        width: startData.width,
        height: startData.height,
        cost_credits: cost,
        status: "pending",
      })
      .select()
      .single();

    if (insertError || !created) {
      return NextResponse.json(
        { error: "Failed to create video generation record" },
        { status: 500 }
      );
    }

    const videoGenerationId = created.id as string;

    // 8. Deduct credits atomically
    const deducted = await deductCredits(user.id, cost, {
      videoGenerationId,
      description: `Video generation (${modelOption.name}, ${VIDEO_DURATION_SECONDS}s, ${resolution})`,
    });
    if (!deducted) {
      await admin
        .from("video_generations")
        .update({ status: "failed", error_message: "Insufficient credits" })
        .eq("id", videoGenerationId);
      return NextResponse.json(
        { error: "Insufficient credits", code: "NO_CREDITS" },
        { status: 402 }
      );
    }

    // 9. Kick off the Veo long-running operation
    //
    // NB: `durationSeconds` is intentionally NOT passed when both `image` and
    // `config.lastFrame` are provided. Veo 3.1 first/last frame interpolation
    // enforces an implicit 8-second duration, and the API now responds with
    // "durationSeconds is not defined" if you try to set it explicitly in
    // that mode. The 8s is still recorded in our DB row above for accounting.
    let operation;
    try {
      operation = await ai.models.generateVideos({
        model: modelOption.apiModel,
        prompt: motionPrompt,
        image: {
          imageBytes: startData.base64,
          mimeType: startData.mimeType,
        },
        config: {
          lastFrame: {
            imageBytes: endData.base64,
            mimeType: endData.mimeType,
          },
          resolution: resolution === "1080p" ? "1080p" : "720p",
          aspectRatio,
          numberOfVideos: 1,
          // Suppresses literal misinterpretations like construction cranes
          // appearing in the scene when "crane shot" is in the prompt.
          negativePrompt: buildVideoNegativePrompt(),
          // Note: `generateAudio` is a Vertex AI parameter; the Gemini Developer
          // API rejects it. Veo 3.1 generates audio per its own defaults via Gemini API.
        },
      });
    } catch (err) {
      // Refund on API failure
      await refundCredits(user.id, cost, {
        videoGenerationId,
        description: "Veo API call failed",
      });
      const message = err instanceof Error ? err.message : "Video generation failed";
      await admin
        .from("video_generations")
        .update({ status: "failed", error_message: message })
        .eq("id", videoGenerationId);
      return NextResponse.json({ error: message }, { status: 500 });
    }

    // 10. Persist the operation NAME for polling.
    // Important: we cannot store the full operation object — the SDK's
    // GenerateVideosOperation class has internal methods (_fromAPIResponse)
    // that don't survive JSON round-trip. The operation name is the only piece
    // we need; the GET route polls the Gemini operations REST API directly.
    const operationName = (operation as { name?: string }).name;
    if (!operationName) {
      await refundCredits(user.id, cost, {
        videoGenerationId,
        description: "Veo returned no operation name",
      });
      await admin
        .from("video_generations")
        .update({ status: "failed", error_message: "No operation name returned" })
        .eq("id", videoGenerationId);
      return NextResponse.json({ error: "Veo returned no operation name" }, { status: 500 });
    }

    await admin
      .from("video_generations")
      .update({
        status: "processing",
        operation_metadata: { name: operationName },
        updated_at: new Date().toISOString(),
      })
      .eq("id", videoGenerationId);

    // 11. Return balance + generation ID. Client will poll GET /api/generate/video/[id].
    const { data: profile } = await admin
      .from("profiles")
      .select("credits_balance")
      .eq("id", user.id)
      .single();

    return NextResponse.json({
      videoGeneration: {
        id: videoGenerationId,
        status: "processing",
        model: modelOption.apiModel,
        duration_seconds: VIDEO_DURATION_SECONDS,
        resolution,
        camera_preset: cameraPresetId,
        transition_preset: transitionPresetId,
        motion_prompt: motionPrompt,
        width: startData.width,
        height: startData.height,
        cost_credits: cost,
      },
      credits_remaining: profile?.credits_balance ?? 0,
    });
  } catch (err) {
    // Dump everything we know about the error so we stop guessing what's
    // throwing. Vercel's log preview truncates messages, so JSON-stringify
    // the error with all own properties (Error's message/stack aren't
    // enumerable by default).
    const errAsAny = err as { name?: string; message?: string; stack?: string; status?: number; response?: unknown };
    const debugObj = {
      name: errAsAny?.name,
      message: errAsAny?.message,
      status: errAsAny?.status,
      stack: errAsAny?.stack?.split("\n").slice(0, 8).join("\n"),
      response: errAsAny?.response,
      raw: typeof err === "object" ? JSON.stringify(err, Object.getOwnPropertyNames(err as object)) : String(err),
    };
    console.error("Video generation error (full):", JSON.stringify(debugObj));
    const surfaced = `${errAsAny?.name ?? "Error"}: ${errAsAny?.message ?? String(err)}`;
    return NextResponse.json(
      { error: `Video generation failed: ${surfaced}` },
      { status: 500 }
    );
  }
}
