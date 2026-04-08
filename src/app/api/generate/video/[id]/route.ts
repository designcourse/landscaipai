import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { refundCredits } from "@/lib/utils/credits";
import { BUCKET_VIDEOS, getVideoPath } from "@/lib/utils/storage";

const SIGNED_URL_EXPIRY = 3600;
const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";

/**
 * Poll a Veo long-running operation by name via the raw Gemini REST API.
 *
 * Why raw fetch instead of @google/genai's `ai.operations.getVideosOperation`?
 * That SDK method expects a `GenerateVideosOperation` *class instance* and
 * calls its internal `_fromAPIResponse` method. Class methods are lost when we
 * JSON-serialize an operation to persist it across HTTP requests, so the SDK
 * call throws "operation._fromAPIResponse is not a function". Going through
 * the REST API by name sidesteps that entire class lifecycle.
 */
async function fetchOperationStatus(operationName: string) {
  const url = `${GEMINI_API_BASE}/${operationName}`;
  const resp = await fetch(url, {
    headers: { "x-goog-api-key": process.env.GEMINI_API_KEY! },
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`Operation poll HTTP ${resp.status}: ${text || resp.statusText}`);
  }
  return resp.json() as Promise<{
    name?: string;
    done?: boolean;
    error?: { code?: number; message?: string };
    response?: {
      // Gemini API may shape the response under either of these keys depending
      // on model version — handle both.
      generateVideoResponse?: {
        generatedSamples?: { video?: { uri?: string } }[];
      };
      generatedVideos?: { video?: { uri?: string } }[];
    };
  }>;
}

function extractVideoUri(opResponse: Awaited<ReturnType<typeof fetchOperationStatus>>["response"]):
  string | null {
  if (!opResponse) return null;
  // Shape A: { generatedVideos: [{ video: { uri } }] }
  const a = opResponse.generatedVideos?.[0]?.video?.uri;
  if (a) return a;
  // Shape B: { generateVideoResponse: { generatedSamples: [{ video: { uri } }] } }
  const b = opResponse.generateVideoResponse?.generatedSamples?.[0]?.video?.uri;
  if (b) return b;
  return null;
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const admin = createAdminClient();

    const { data: row, error } = await admin
      .from("video_generations")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (error || !row) {
      return NextResponse.json({ error: "Video generation not found" }, { status: 404 });
    }

    // Terminal states — return immediately
    if (row.status === "completed" && row.storage_path) {
      const { data: urlData } = await admin.storage
        .from(BUCKET_VIDEOS)
        .createSignedUrl(row.storage_path, SIGNED_URL_EXPIRY);
      return NextResponse.json({
        videoGeneration: { ...row, url: urlData?.signedUrl ?? "" },
      });
    }
    if (row.status === "failed") {
      return NextResponse.json({ videoGeneration: { ...row, url: "" } });
    }

    // Need an operation name to poll
    const operationName: string | undefined = row.operation_metadata?.name;
    if (!operationName) {
      return NextResponse.json({ error: "Operation name missing" }, { status: 500 });
    }

    // Fetch live status from Gemini operations API
    let opData;
    try {
      opData = await fetchOperationStatus(operationName);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Operation poll failed";
      await admin
        .from("video_generations")
        .update({ status: "failed", error_message: message })
        .eq("id", id);
      await refundCredits(user.id, row.cost_credits, {
        videoGenerationId: id,
        description: "Veo poll failed",
      });
      return NextResponse.json({ error: message }, { status: 500 });
    }

    if (!opData.done) {
      // Still processing — bump updated_at so the UI knows we're alive
      await admin
        .from("video_generations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", id);
      return NextResponse.json({
        videoGeneration: { ...row, status: "processing", url: "" },
      });
    }

    // Operation finished — check for error
    if (opData.error) {
      const message = opData.error.message || "Video generation failed";
      await admin
        .from("video_generations")
        .update({ status: "failed", error_message: message })
        .eq("id", id);
      await refundCredits(user.id, row.cost_credits, {
        videoGenerationId: id,
        description: "Veo operation error",
      });
      return NextResponse.json({ error: message }, { status: 500 });
    }

    const videoUri = extractVideoUri(opData.response);
    if (!videoUri) {
      const message = "No video returned by Veo";
      await admin
        .from("video_generations")
        .update({ status: "failed", error_message: message })
        .eq("id", id);
      await refundCredits(user.id, row.cost_credits, {
        videoGenerationId: id,
        description: "No video returned",
      });
      return NextResponse.json({ error: message }, { status: 500 });
    }

    // Download video bytes. The Gemini files endpoint accepts the API key via
    // either query string OR header. Use the header — it's cleaner and works
    // even if the URI already has query parameters.
    const downloadResp = await fetch(videoUri, {
      headers: { "x-goog-api-key": process.env.GEMINI_API_KEY! },
    });
    if (!downloadResp.ok) {
      const message = `Failed to download video (${downloadResp.status})`;
      await admin
        .from("video_generations")
        .update({ status: "failed", error_message: message })
        .eq("id", id);
      await refundCredits(user.id, row.cost_credits, {
        videoGenerationId: id,
        description: "Video download failed",
      });
      return NextResponse.json({ error: message }, { status: 500 });
    }

    const videoBuffer = Buffer.from(await downloadResp.arrayBuffer());

    // Upload to Supabase Storage
    const storagePath = getVideoPath(user.id, row.project_id, id);
    const { error: uploadError } = await admin.storage
      .from(BUCKET_VIDEOS)
      .upload(storagePath, videoBuffer, {
        contentType: "video/mp4",
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      await admin
        .from("video_generations")
        .update({ status: "failed", error_message: "Failed to save video" })
        .eq("id", id);
      await refundCredits(user.id, row.cost_credits, {
        videoGenerationId: id,
        description: "Video upload failed",
      });
      return NextResponse.json({ error: "Failed to save video" }, { status: 500 });
    }

    // Mark completed
    const { data: updated } = await admin
      .from("video_generations")
      .update({
        status: "completed",
        storage_path: storagePath,
        operation_metadata: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    const { data: urlData } = await admin.storage
      .from(BUCKET_VIDEOS)
      .createSignedUrl(storagePath, SIGNED_URL_EXPIRY);

    return NextResponse.json({
      videoGeneration: { ...(updated ?? row), url: urlData?.signedUrl ?? "" },
    });
  } catch (err) {
    console.error("Video poll error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/generate/video/[id]
 */
export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const admin = createAdminClient();

    const { data: row } = await admin
      .from("video_generations")
      .select("storage_path")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (!row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await admin
      .from("credit_transactions")
      .update({ video_generation_id: null })
      .eq("video_generation_id", id);

    if (row.storage_path) {
      await admin.storage.from(BUCKET_VIDEOS).remove([row.storage_path]);
    }

    await admin.from("video_generations").delete().eq("id", id);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Video delete error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
