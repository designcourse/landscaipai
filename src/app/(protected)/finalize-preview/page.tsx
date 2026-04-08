import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedProfile, getCompanySettings } from "@/lib/supabase/queries";
import { collectAssetsForVideo } from "@/lib/finalize/collect-assets";
import { BUCKET_VIDEOS } from "@/lib/utils/storage";
import { FinalizePreviewPlayer } from "@/components/dev/finalize-preview-player";

export const metadata = { title: "Finalize Video preview" };

/**
 * Local development page for iterating on the FinalizeVideo Remotion
 * composition without going through the modal or Lambda render. Loads
 * the most recent completed video by default, or a specific video if
 * `?videoGenerationId=xxx` is passed.
 */
export default async function FinalizePreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ videoGenerationId?: string }>;
}) {
  const { user } = await getAuthenticatedProfile();
  if (!user) redirect("/login");

  const params = await searchParams;
  const admin = createAdminClient();

  const query = admin
    .from("video_generations")
    .select("*")
    .eq("status", "completed")
    .not("storage_path", "is", null)
    .not("actual_duration_seconds", "is", null)
    .order("created_at", { ascending: false })
    .limit(1);

  const { data } = params.videoGenerationId
    ? await admin
        .from("video_generations")
        .select("*")
        .eq("id", params.videoGenerationId)
        .single()
        .then((r) => ({ data: r.data ? [r.data] : null }))
    : await query;

  const video = data?.[0];

  if (!video || !video.storage_path) {
    return (
      <main className="px-element py-section">
        <div className="mx-auto max-w-lg space-y-4">
          <h1 className="text-2xl font-bold text-foreground">
            Finalize Video preview
          </h1>
          <p className="text-sm text-muted-foreground">
            No completed videos found. Generate a video first, then come
            back here to preview the finalize composition against it.
          </p>
        </div>
      </main>
    );
  }

  const { data: urlData } = await admin.storage
    .from(BUCKET_VIDEOS)
    .createSignedUrl(video.storage_path, 4 * 60 * 60);

  const detectedAssets = await collectAssetsForVideo(admin, video.id);
  const { settings: companySettings, logoUrl } = await getCompanySettings();

  if (!urlData?.signedUrl) {
    return (
      <main className="px-element py-section">
        <p className="text-sm text-destructive">
          Failed to sign URL for video {video.id}.
        </p>
      </main>
    );
  }

  return (
    <main className="px-element py-section">
      <div className="mx-auto max-w-5xl space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Finalize Video preview
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Composition source: {video.id}{" "}
            <span className="ml-2">
              ({video.actual_width}×{video.actual_height} @{" "}
              {video.actual_fps}fps,{" "}
              {video.actual_duration_seconds?.toFixed(2)}s)
            </span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Detected assets: {detectedAssets.length}{" "}
            {detectedAssets.length > 0 &&
              `(${detectedAssets.map((a) => a.name).join(", ")})`}
          </p>
        </div>

        <FinalizePreviewPlayer
          veoUrl={urlData.signedUrl}
          veoDurationSeconds={Number(video.actual_duration_seconds) || 8}
          veoWidth={video.actual_width || 1280}
          veoHeight={video.actual_height || 720}
          assets={detectedAssets.map((a) => ({
            name: a.name,
            thumbnailUrl: a.thumbnail_url,
          }))}
          address="1234 Maple Avenue, Springfield"
          branding={
            companySettings
              ? {
                  logoUrl,
                  companyName: companySettings.company_name ?? "Your Company",
                  companyPhone: companySettings.company_phone,
                  note:
                    companySettings.default_note ??
                    "Contact us today and we can make this happen.",
                }
              : {
                  logoUrl: null,
                  companyName: "Greenleaf Landscaping",
                  companyPhone: "(555) 123-4567",
                  note: "Contact us today and we can make this happen.",
                }
          }
        />
      </div>
    </main>
  );
}
