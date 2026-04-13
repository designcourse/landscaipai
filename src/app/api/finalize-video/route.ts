import { NextRequest, NextResponse } from "next/server";
import { renderMediaOnLambda } from "@remotion/lambda/client";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { deductCredits, refundCredits } from "@/lib/utils/credits";
import { hashInputProps } from "@/lib/finalize/hash";
import {
  BUCKET_COMPANY_LOGOS,
  BUCKET_VIDEOS,
} from "@/lib/utils/storage";

export const runtime = "nodejs";
export const maxDuration = 60;

const SIGNED_URL_EXPIRY_SECONDS = 4 * 60 * 60; // 4 hours
const FINALIZE_CREDIT_COST = 1;
const MAX_ASSETS = 6;
const MAX_TEXT_LENGTH = 500;

// New AWS accounts have a default Lambda concurrency limit of 10. Remotion
// renders by splitting the composition into chunks where each chunk = one
// Lambda invocation. For our ~450-frame composition (8s veo + 7s freeze at
// 30fps), framesPerLambda=100 yields ~5 chunks + 1 orchestrator = ~6 Lambdas
// — comfortably under the limit. Once the AWS quota is increased (run
// `npx remotion lambda quotas increase`), this can be lowered for faster
// renders. Lower = more parallelism = faster wall-clock but more concurrent
// Lambdas.
const FRAMES_PER_LAMBDA = 100;

type FinalizeRequestAsset = {
  name: string;
  thumbnailUrl: string;
  description: string | null;
  zoneMin: string | null;
  zoneMax: string | null;
  heightMinFt: number | null;
  heightMaxFt: number | null;
  spreadMinFt: number | null;
  spreadMaxFt: number | null;
  sunRequirement: string | null;
  waterNeeds: string | null;
  growthRate: string | null;
  maintenanceLevel: string | null;
};

type FinalizeRequestBody = {
  videoGenerationId: string;
  assets: FinalizeRequestAsset[];
  address: string | null;
  note: string | null;
};

function sanitizeText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  // Strip control chars except newline; trim; cap at MAX_TEXT_LENGTH
  const cleaned = value
    .replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, "")
    .trim();
  if (!cleaned) return null;
  return cleaned.slice(0, MAX_TEXT_LENGTH);
}

/**
 * POST /api/finalize-video
 *
 * Kicks off a Remotion Lambda render of the FinalizeVideo composition for
 * the given source video. Sequence:
 *   1. Auth + ownership check
 *   2. Sanitize body
 *   3. Resolve branding server-side (NOT from request — security)
 *   4. Build inputProps + hash for cache lookup
 *   5. If a completed finalization exists with the same hash, return it
 *   6. INSERT video_finalizations row (status=pending) — unique index
 *      catches double-clicks
 *   7. Deduct credits
 *   8. Call renderMediaOnLambda with webhook config (passes finalizationId
 *      as customData so the webhook doesn't need lambda_render_id lookup)
 *   9. UPDATE row with lambda fields, status=rendering
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ----- Parse + sanitize body -----
  let body: FinalizeRequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { videoGenerationId } = body;
  if (!videoGenerationId || typeof videoGenerationId !== "string") {
    return NextResponse.json(
      { error: "Missing videoGenerationId" },
      { status: 400 }
    );
  }

  const address = sanitizeText(body.address);
  const note = sanitizeText(body.note);

  // Validate assets — max 6, each name + thumbnailUrl required
  if (!Array.isArray(body.assets)) {
    return NextResponse.json(
      { error: "assets must be an array" },
      { status: 400 }
    );
  }
  if (body.assets.length > MAX_ASSETS) {
    return NextResponse.json(
      { error: `Too many assets (max ${MAX_ASSETS})` },
      { status: 400 }
    );
  }
  const assets = body.assets
    .filter(
      (a) =>
        a &&
        typeof a.name === "string" &&
        typeof a.thumbnailUrl === "string" &&
        a.name.trim() &&
        a.thumbnailUrl.trim()
    )
    .map((a) => ({
      name: a.name.trim().slice(0, 100),
      thumbnailUrl: a.thumbnailUrl.trim(),
      description: typeof a.description === "string" ? a.description.slice(0, 500) : null,
      zoneMin: typeof a.zoneMin === "string" ? a.zoneMin : null,
      zoneMax: typeof a.zoneMax === "string" ? a.zoneMax : null,
      heightMinFt: typeof a.heightMinFt === "number" ? a.heightMinFt : null,
      heightMaxFt: typeof a.heightMaxFt === "number" ? a.heightMaxFt : null,
      spreadMinFt: typeof a.spreadMinFt === "number" ? a.spreadMinFt : null,
      spreadMaxFt: typeof a.spreadMaxFt === "number" ? a.spreadMaxFt : null,
      sunRequirement: typeof a.sunRequirement === "string" ? a.sunRequirement : null,
      waterNeeds: typeof a.waterNeeds === "string" ? a.waterNeeds : null,
      growthRate: typeof a.growthRate === "string" ? a.growthRate : null,
      maintenanceLevel: typeof a.maintenanceLevel === "string" ? a.maintenanceLevel : null,
    }));

  const admin = createAdminClient();

  // ----- Fetch + ownership check on the video -----
  const { data: video, error: videoErr } = await admin
    .from("video_generations")
    .select(
      "id, user_id, status, storage_path, actual_duration_seconds, actual_fps, actual_width, actual_height"
    )
    .eq("id", videoGenerationId)
    .single();

  if (videoErr || !video) {
    return NextResponse.json({ error: "Video not found" }, { status: 404 });
  }
  if (video.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (video.status !== "completed" || !video.storage_path) {
    return NextResponse.json(
      { error: "Video not ready to finalize" },
      { status: 400 }
    );
  }
  if (!video.actual_duration_seconds) {
    return NextResponse.json(
      { error: "Video metadata missing — cannot finalize" },
      { status: 400 }
    );
  }

  // ----- Resolve branding from server (NOT request body) -----
  const { data: companySettings } = await admin
    .from("company_settings")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (
    !companySettings ||
    (!companySettings.company_name &&
      !companySettings.company_phone &&
      !companySettings.logo_path &&
      !companySettings.default_note)
  ) {
    return NextResponse.json(
      { error: "Set up your company branding first." },
      { status: 400 }
    );
  }

  // ----- Sign URLs for Lambda input -----
  const { data: veoUrlData } = await admin.storage
    .from(BUCKET_VIDEOS)
    .createSignedUrl(video.storage_path, SIGNED_URL_EXPIRY_SECONDS);
  if (!veoUrlData?.signedUrl) {
    return NextResponse.json(
      { error: "Failed to sign veo URL" },
      { status: 500 }
    );
  }

  let logoUrl: string | null = null;
  if (companySettings.logo_path) {
    const { data: logoData } = await admin.storage
      .from(BUCKET_COMPANY_LOGOS)
      .createSignedUrl(companySettings.logo_path, SIGNED_URL_EXPIRY_SECONDS);
    logoUrl = logoData?.signedUrl ?? null;
  }

  // ----- Build inputProps -----
  const inputProps = {
    veoUrl: veoUrlData.signedUrl,
    veoDurationSeconds: Number(video.actual_duration_seconds),
    veoWidth: video.actual_width || 1280,
    veoHeight: video.actual_height || 720,
    assets,
    address,
    branding: {
      logoUrl,
      companyName: companySettings.company_name ?? "",
      companyPhone: companySettings.company_phone ?? null,
      note: note ?? companySettings.default_note ?? null,
    },
  };

  // For the cache hash, omit fields that change every render (signed URLs).
  // Identical user-visible inputs should produce the same hash even though
  // the signed URL tokens differ.
  const hashableInputs = {
    videoGenerationId: video.id,
    veoStoragePath: video.storage_path,
    assets,
    address,
    branding: {
      logoPath: companySettings.logo_path ?? null,
      companyName: companySettings.company_name ?? "",
      companyPhone: companySettings.company_phone ?? null,
      note: note ?? companySettings.default_note ?? null,
    },
  };
  const inputPropsHash = hashInputProps(hashableInputs);

  // ----- Cache check -----
  const { data: cached } = await admin
    .from("video_finalizations")
    .select("id, output_storage_path")
    .eq("user_id", user.id)
    .eq("input_props_hash", inputPropsHash)
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (cached) {
    return NextResponse.json({
      id: cached.id,
      status: "completed",
      cached: true,
    });
  }

  // ----- Read the deployed Remotion site URL from admin_settings -----
  const { data: serveUrlSetting } = await admin
    .from("admin_settings")
    .select("value")
    .eq("key", "remotion_serve_url")
    .single();

  const serveUrl = serveUrlSetting?.value as string | undefined;
  if (!serveUrl) {
    return NextResponse.json(
      {
        error:
          "Remotion site not deployed. Run `npm run remotion:deploy` first.",
      },
      { status: 500 }
    );
  }

  // ----- Validate Lambda env -----
  const functionName = process.env.REMOTION_LAMBDA_FUNCTION_NAME;
  const region = (process.env.REMOTION_AWS_REGION ?? "us-east-1") as
    | "us-east-1"
    | "us-east-2"
    | "us-west-1"
    | "us-west-2";
  if (!functionName) {
    return NextResponse.json(
      { error: "REMOTION_LAMBDA_FUNCTION_NAME not configured" },
      { status: 500 }
    );
  }

  // ----- Insert video_finalizations row (pending) -----
  // The unique index on (video_generation_id) WHERE status IN (active...)
  // will catch double-clicks here.
  const { data: finalization, error: insertErr } = await admin
    .from("video_finalizations")
    .insert({
      user_id: user.id,
      video_generation_id: video.id,
      status: "pending",
      input_props_snapshot: hashableInputs,
      input_props_hash: inputPropsHash,
      cost_credits: FINALIZE_CREDIT_COST,
    })
    .select()
    .single();

  if (insertErr || !finalization) {
    // Check if it's the unique constraint catching a concurrent render
    if (insertErr?.code === "23505") {
      return NextResponse.json(
        {
          error: "A finalization is already in progress for this video.",
          code: "ALREADY_RENDERING",
        },
        { status: 409 }
      );
    }
    console.error("Failed to insert video_finalizations:", insertErr);
    return NextResponse.json(
      { error: "Failed to create finalization record" },
      { status: 500 }
    );
  }

  // ----- Deduct credits -----
  const deducted = await deductCredits(user.id, FINALIZE_CREDIT_COST, {
    videoFinalizationId: finalization.id,
    description: `Video finalization (${video.id.slice(0, 8)})`,
  });

  if (!deducted) {
    await admin
      .from("video_finalizations")
      .update({
        status: "failed",
        error_message: "Insufficient credits",
        updated_at: new Date().toISOString(),
      })
      .eq("id", finalization.id);
    return NextResponse.json(
      { error: "Insufficient credits", code: "NO_CREDITS" },
      { status: 402 }
    );
  }

  // ----- Kick off Lambda render -----
  const webhookSecret = process.env.REMOTION_WEBHOOK_SECRET;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  try {
    const renderResult = await renderMediaOnLambda({
      region,
      functionName,
      serveUrl,
      composition: "FinalizeVideo",
      inputProps,
      codec: "h264",
      imageFormat: "jpeg",
      maxRetries: 1,
      privacy: "private",
      framesPerLambda: FRAMES_PER_LAMBDA,
      webhook: webhookSecret
        ? {
            url: `${appUrl}/api/finalize-video/webhook`,
            secret: webhookSecret,
            customData: {
              finalizationId: finalization.id,
              userId: user.id,
              videoGenerationId: video.id,
            },
          }
        : undefined,
    });

    // ----- Update row with Lambda metadata -----
    const { error: updateErr } = await admin
      .from("video_finalizations")
      .update({
        status: "rendering",
        lambda_render_id: renderResult.renderId,
        lambda_bucket_name: renderResult.bucketName,
        lambda_function_name: functionName,
        lambda_serve_url: serveUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("id", finalization.id);

    if (updateErr) {
      // The render is already kicked off; the webhook will still find the
      // row via customData.finalizationId. Log but don't fail.
      console.error(
        "Failed to update video_finalizations after Lambda kickoff:",
        updateErr
      );
    }

    return NextResponse.json({
      id: finalization.id,
      status: "rendering",
      renderId: renderResult.renderId,
    });
  } catch (lambdaErr) {
    // Lambda failed to even start the render — refund and mark failed
    const message =
      lambdaErr instanceof Error ? lambdaErr.message : "Lambda render failed";
    console.error("renderMediaOnLambda failed:", lambdaErr);

    await refundCredits(user.id, FINALIZE_CREDIT_COST, {
      videoFinalizationId: finalization.id,
      description: "Lambda kickoff failed",
    });

    await admin
      .from("video_finalizations")
      .update({
        status: "failed",
        error_message: message,
        updated_at: new Date().toISOString(),
      })
      .eq("id", finalization.id);

    return NextResponse.json(
      { error: message, code: "LAMBDA_FAILED" },
      { status: 500 }
    );
  }
}
