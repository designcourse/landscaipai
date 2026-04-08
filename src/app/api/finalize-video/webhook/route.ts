import { NextRequest, NextResponse } from "next/server";
import {
  validateWebhookSignature,
  getRenderProgress,
  type WebhookPayload,
} from "@remotion/lambda/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { refundCredits } from "@/lib/utils/credits";
import {
  BUCKET_FINALIZED_VIDEOS,
  getFinalizedVideoPath,
} from "@/lib/utils/storage";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/finalize-video/webhook
 *
 * Called by AWS Lambda (NOT by the user's browser) when a Remotion render
 * finishes, errors, or times out. Verifies the HMAC signature using
 * REMOTION_WEBHOOK_SECRET, then:
 *
 *   - On success: downloads the rendered MP4 from S3, uploads it to the
 *     finalized-videos Supabase bucket, captures the AWS cost, and marks
 *     the video_finalizations row as completed.
 *   - On error/timeout: refunds the credit and marks the row failed.
 *
 * Idempotent: re-deliveries (Lambda may retry) skip the work if the row
 * is already in a terminal state.
 *
 * IMPORTANT: This route MUST read the raw body to verify the HMAC signature
 * — JSON parsing happens AFTER signature validation.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.REMOTION_WEBHOOK_SECRET;
  if (!secret) {
    console.error("REMOTION_WEBHOOK_SECRET not configured — rejecting webhook");
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }

  // Read raw body for signature validation
  const rawBody = await req.text();
  const signatureHeader = req.headers.get("x-remotion-signature");

  // Validate signature — throws on mismatch
  try {
    validateWebhookSignature({
      secret,
      body: JSON.parse(rawBody),
      signatureHeader: signatureHeader ?? "",
    });
  } catch (err) {
    console.error("Webhook signature validation failed:", err);
    return NextResponse.json(
      { error: "Invalid signature" },
      { status: 401 }
    );
  }

  let payload: WebhookPayload;
  try {
    payload = JSON.parse(rawBody) as WebhookPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Extract finalizationId from customData (set in the POST handler)
  const customData = payload.customData as
    | { finalizationId?: string; userId?: string; videoGenerationId?: string }
    | undefined;
  const finalizationId = customData?.finalizationId;

  if (!finalizationId) {
    console.error("Webhook missing finalizationId in customData");
    return NextResponse.json(
      { error: "Missing finalizationId" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  // Look up the row
  const { data: row, error: rowErr } = await admin
    .from("video_finalizations")
    .select("*")
    .eq("id", finalizationId)
    .single();

  if (rowErr || !row) {
    console.error("Webhook: video_finalizations row not found", finalizationId);
    return NextResponse.json({ error: "Row not found" }, { status: 404 });
  }

  // Idempotency: if already completed/failed, return 200 silently
  if (row.status === "completed" || row.status === "failed") {
    return NextResponse.json({ success: true, idempotent: true });
  }

  // ----- Handle error / timeout payloads -----
  if (payload.type === "error" || payload.type === "timeout") {
    const errorMessage =
      payload.type === "timeout"
        ? "Lambda render timed out"
        : payload.errors?.[0]?.message ?? "Lambda render failed";

    console.error(
      `Webhook: render ${payload.type} for finalization ${finalizationId}:`,
      errorMessage
    );

    await refundCredits(row.user_id, row.cost_credits, {
      videoFinalizationId: row.id,
      description: `Lambda render ${payload.type}`,
    });

    await admin
      .from("video_finalizations")
      .update({
        status: "failed",
        error_message: errorMessage,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);

    return NextResponse.json({ success: true });
  }

  // ----- Success payload -----
  if (payload.type !== "success") {
    return NextResponse.json({ success: true });
  }

  // Mark downloading so concurrent webhook deliveries don't double-process
  const { error: lockErr } = await admin
    .from("video_finalizations")
    .update({ status: "downloading", updated_at: new Date().toISOString() })
    .eq("id", row.id)
    .eq("status", "rendering"); // optimistic concurrency: only flip from rendering

  if (lockErr) {
    console.error("Webhook: failed to lock row for download:", lockErr);
    return NextResponse.json({ error: "Lock failed" }, { status: 500 });
  }

  // Determine the rendered output URL. Lambda may not include `outputUrl`
  // in the webhook payload itself — we use getRenderProgress to get the
  // final outputFile and the cost.
  const region = (process.env.REMOTION_AWS_REGION ?? "us-east-1") as
    | "us-east-1"
    | "us-east-2"
    | "us-west-1"
    | "us-west-2";

  let outputFileUrl: string | null = null;
  let costCents: number | null = null;
  try {
    const progress = await getRenderProgress({
      renderId: row.lambda_render_id!,
      bucketName: row.lambda_bucket_name!,
      functionName: row.lambda_function_name!,
      region,
    });
    outputFileUrl = progress.outputFile ?? null;
    if (progress.costs?.accruedSoFar != null) {
      costCents = Math.round(progress.costs.accruedSoFar * 100);
    }
  } catch (err) {
    console.error("Webhook: getRenderProgress failed:", err);
  }

  if (!outputFileUrl) {
    await markFailed(admin, row.id, row.user_id, row.cost_credits, "No output URL from Lambda");
    return NextResponse.json({ error: "No output URL" }, { status: 500 });
  }

  // Fetch the rendered MP4 from S3
  let mp4Buffer: Buffer;
  try {
    const resp = await fetch(outputFileUrl);
    if (!resp.ok) {
      throw new Error(`Failed to fetch output (${resp.status})`);
    }
    mp4Buffer = Buffer.from(await resp.arrayBuffer());
  } catch (err) {
    const message = err instanceof Error ? err.message : "Output download failed";
    await markFailed(admin, row.id, row.user_id, row.cost_credits, message);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  // Upload to Supabase finalized-videos bucket
  const storagePath = getFinalizedVideoPath(
    row.user_id,
    customData?.videoGenerationId ?? "unknown",
    row.id
  );
  const { error: uploadErr } = await admin.storage
    .from(BUCKET_FINALIZED_VIDEOS)
    .upload(storagePath, mp4Buffer, {
      contentType: "video/mp4",
      cacheControl: "3600",
      upsert: true,
    });

  if (uploadErr) {
    await markFailed(
      admin,
      row.id,
      row.user_id,
      row.cost_credits,
      `Storage upload failed: ${uploadErr.message}`
    );
    return NextResponse.json({ error: uploadErr.message }, { status: 500 });
  }

  // Mark completed
  await admin
    .from("video_finalizations")
    .update({
      status: "completed",
      output_storage_path: storagePath,
      cost_cents: costCents,
      updated_at: new Date().toISOString(),
    })
    .eq("id", row.id);

  return NextResponse.json({ success: true });
}

async function markFailed(
  admin: ReturnType<typeof createAdminClient>,
  rowId: string,
  userId: string,
  costCredits: number,
  errorMessage: string
) {
  await refundCredits(userId, costCredits, {
    videoFinalizationId: rowId,
    description: "Lambda webhook processing failed",
  });
  await admin
    .from("video_finalizations")
    .update({
      status: "failed",
      error_message: errorMessage,
      updated_at: new Date().toISOString(),
    })
    .eq("id", rowId);
}
