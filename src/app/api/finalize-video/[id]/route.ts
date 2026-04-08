import { NextRequest, NextResponse } from "next/server";
import { getRenderProgress } from "@remotion/lambda/client";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { BUCKET_FINALIZED_VIDEOS } from "@/lib/utils/storage";

export const runtime = "nodejs";
export const maxDuration = 30;

const SIGNED_URL_EXPIRY_SECONDS = 4 * 60 * 60;
const PROGRESS_CACHE_TTL_MS = 3000;

// In-memory progress cache to avoid hammering AWS when many polls happen.
// Keyed by Lambda renderId. Survives across requests within the same
// serverless instance; cleared on cold-start (acceptable).
const progressCache = new Map<
  string,
  { result: { overallProgress: number; done: boolean }; expiresAt: number }
>();

/**
 * GET /api/finalize-video/[id]
 *
 * Polled by the FinalizeVideo modal every ~2s while a render is in flight.
 * Returns current status, progress (0..1), and a signed output URL when
 * the render is complete.
 *
 * Does NOT do the S3 → Supabase storage transfer — that happens in the
 * webhook handler when Lambda calls us back.
 */
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
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
    .from("video_finalizations")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (row.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Terminal states — return immediately
  if (row.status === "completed" && row.output_storage_path) {
    const { data: urlData } = await admin.storage
      .from(BUCKET_FINALIZED_VIDEOS)
      .createSignedUrl(row.output_storage_path, SIGNED_URL_EXPIRY_SECONDS);
    return NextResponse.json({
      id: row.id,
      status: "completed",
      progress: 1,
      outputUrl: urlData?.signedUrl ?? null,
    });
  }
  if (row.status === "failed") {
    return NextResponse.json({
      id: row.id,
      status: "failed",
      progress: 0,
      error: row.error_message,
    });
  }

  // Pending = INSERT happened but Lambda not yet started (very rare,
  // briefly between INSERT and UPDATE in POST handler)
  if (row.status === "pending" || !row.lambda_render_id) {
    return NextResponse.json({
      id: row.id,
      status: row.status,
      progress: 0,
    });
  }

  // Status is 'rendering' or 'downloading' — query Lambda for live progress
  const region = (process.env.REMOTION_AWS_REGION ?? "us-east-1") as
    | "us-east-1"
    | "us-east-2"
    | "us-west-1"
    | "us-west-2";

  const cacheKey = row.lambda_render_id;
  const now = Date.now();
  const cached = progressCache.get(cacheKey);

  let overallProgress: number;
  let done: boolean;

  if (cached && cached.expiresAt > now) {
    overallProgress = cached.result.overallProgress;
    done = cached.result.done;
  } else {
    try {
      const progress = await getRenderProgress({
        renderId: row.lambda_render_id,
        bucketName: row.lambda_bucket_name!,
        functionName: row.lambda_function_name!,
        region,
      });
      overallProgress = progress.overallProgress ?? 0;
      done = Boolean(progress.done);

      progressCache.set(cacheKey, {
        result: { overallProgress, done },
        expiresAt: now + PROGRESS_CACHE_TTL_MS,
      });

      if (progress.fatalErrorEncountered) {
        return NextResponse.json({
          id: row.id,
          status: "failed",
          progress: 0,
          error: progress.errors?.[0]?.message ?? "Render failed",
        });
      }
    } catch (err) {
      console.error("getRenderProgress failed:", err);
      return NextResponse.json({
        id: row.id,
        status: row.status,
        progress: 0,
      });
    }
  }

  return NextResponse.json({
    id: row.id,
    status: row.status,
    progress: overallProgress,
    done,
  });
}
