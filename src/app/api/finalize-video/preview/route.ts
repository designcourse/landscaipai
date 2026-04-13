import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { collectAssetsForVideo, enrichAssets } from "@/lib/finalize/collect-assets";
import {
  BUCKET_COMPANY_LOGOS,
  BUCKET_VIDEOS,
} from "@/lib/utils/storage";

export const runtime = "nodejs";
export const maxDuration = 30;

const SIGNED_URL_EXPIRY_SECONDS = 4 * 60 * 60; // 4 hours

/**
 * GET /api/finalize-video/preview?videoGenerationId=<uuid>
 *
 * Returns initial data for the Finalize Video modal:
 *   - Signed URL + dimensions for the source veo MP4
 *   - Library assets auto-detected from the video's parent generation chain
 *   - Company branding (with signed logo URL) to display in the form
 */
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const videoGenerationId = req.nextUrl.searchParams.get("videoGenerationId");
  if (!videoGenerationId) {
    return NextResponse.json(
      { error: "Missing videoGenerationId" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  // Fetch + ownership check
  const { data: video, error: videoError } = await admin
    .from("video_generations")
    .select(
      "id, user_id, status, storage_path, actual_duration_seconds, actual_fps, actual_width, actual_height"
    )
    .eq("id", videoGenerationId)
    .single();

  if (videoError || !video) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
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

  // Sign the veo URL for Player preview (long-lived so the modal can sit
  // open while the user configures the form)
  const { data: veoUrlData } = await admin.storage
    .from(BUCKET_VIDEOS)
    .createSignedUrl(video.storage_path, SIGNED_URL_EXPIRY_SECONDS);

  if (!veoUrlData?.signedUrl) {
    return NextResponse.json(
      { error: "Failed to sign veo URL" },
      { status: 500 }
    );
  }

  // Auto-detect assets from the parent generation chain, then enrich with
  // full library_items attributes for the plant info card sequence.
  const rawAssets = await collectAssetsForVideo(admin, video.id);
  const detectedAssets = await enrichAssets(admin, rawAssets);

  // Company branding (read server-side so it can't be spoofed by the client)
  const { data: companySettings } = await admin
    .from("company_settings")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  let logoUrl: string | null = null;
  if (companySettings?.logo_path) {
    const { data: logoData } = await admin.storage
      .from(BUCKET_COMPANY_LOGOS)
      .createSignedUrl(companySettings.logo_path, SIGNED_URL_EXPIRY_SECONDS);
    logoUrl = logoData?.signedUrl ?? null;
  }

  return NextResponse.json({
    videoGenerationId: video.id,
    veo: {
      signedUrl: veoUrlData.signedUrl,
      durationSeconds: Number(video.actual_duration_seconds),
      fps: Number(video.actual_fps) || 24,
      width: video.actual_width || 1280,
      height: video.actual_height || 720,
    },
    detectedAssets,
    branding: companySettings
      ? {
          companyName: companySettings.company_name,
          companyPhone: companySettings.company_phone,
          defaultNote: companySettings.default_note,
          logoUrl,
        }
      : null,
  });
}
