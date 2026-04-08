import { getAuthenticatedProfile } from "@/lib/supabase/queries";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { CanvasWorkspace } from "@/components/generate/canvas-workspace";
import {
  attachSignedUrls,
  BUCKET_UPLOADS,
  BUCKET_GENERATIONS,
  BUCKET_VIDEOS,
  BUCKET_FINALIZED_VIDEOS,
} from "@/lib/utils/storage";
import type { VideoFinalization, VideoGeneration } from "@/types";

export const metadata = { title: "Generate" };

export default async function CanvasGeneratePage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string; image?: string }>;
}) {
  const { user, profile } = await getAuthenticatedProfile();
  if (!user) redirect("/login");

  const params = await searchParams;
  let projectId = params.project;

  // Backward compat: if ?image= is provided, resolve its parent project
  if (!projectId && params.image) {
    const supabase = await createClient();
    const { data: img } = await supabase
      .from("images")
      .select("project_id")
      .eq("id", params.image)
      .single();
    if (img) projectId = img.project_id;
  }

  if (!projectId) redirect("/dashboard");

  const supabase = await createClient();
  const admin = createAdminClient();

  // Fetch project details
  const { data: project } = await supabase
    .from("projects")
    .select("id, name, hardiness_zone")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .single();

  if (!project) redirect("/dashboard");

  // Fetch all images first, then generations using their IDs
  const { data: images } = await supabase
    .from("images")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });

  const imageIds = (images ?? []).map((i) => i.id);
  const { data: generations } = imageIds.length > 0
    ? await supabase
        .from("generations")
        .select("*")
        .eq("status", "completed")
        .in("image_id", imageIds)
        .order("created_at", { ascending: true })
        .limit(200)
    : { data: [] as never[] };

  // Fetch video generations for this project
  const { data: videoGenerations } = await supabase
    .from("video_generations")
    .select("*")
    .eq("project_id", projectId)
    .eq("status", "completed")
    .order("created_at", { ascending: true })
    .limit(100);

  // Video rows use storage_path (nullable) — only sign those with a path set.
  const videosWithPath = ((videoGenerations ?? []) as VideoGeneration[]).filter(
    (v): v is VideoGeneration & { storage_path: string } => !!v.storage_path
  );

  // Fetch finalized videos for this project (joined through video_generations)
  const videoGenIds = (videoGenerations ?? []).map((vg) => vg.id);
  const { data: finalizations } =
    videoGenIds.length > 0
      ? await supabase
          .from("video_finalizations")
          .select("*")
          .in("video_generation_id", videoGenIds)
          .eq("status", "completed")
          .not("output_storage_path", "is", null)
          .order("created_at", { ascending: true })
          .limit(100)
      : { data: [] as VideoFinalization[] };

  const finalizationsWithPath = (
    (finalizations ?? []) as VideoFinalization[]
  ).filter(
    (f): f is VideoFinalization & { output_storage_path: string } =>
      !!f.output_storage_path
  );

  // Batch signed URLs for uploads, generations, videos, and finalizations
  const [
    imagesWithUrls,
    generationsWithUrls,
    videosWithUrls,
    finalizationsWithUrls,
  ] = await Promise.all([
    attachSignedUrls(admin, BUCKET_UPLOADS, images ?? []),
    attachSignedUrls(admin, BUCKET_GENERATIONS, generations ?? []),
    attachSignedUrls(admin, BUCKET_VIDEOS, videosWithPath),
    attachSignedUrls(
      admin,
      BUCKET_FINALIZED_VIDEOS,
      // attachSignedUrls signs the `storage_path` field — finalizations
      // store theirs in `output_storage_path`, so map for the helper.
      finalizationsWithPath.map((f) => ({
        ...f,
        storage_path: f.output_storage_path,
      }))
    ),
  ]);

  return (
    <CanvasWorkspace
      project={project}
      images={imagesWithUrls}
      generations={generationsWithUrls}
      videoGenerations={videosWithUrls}
      videoFinalizations={finalizationsWithUrls}
      creditsBalance={profile?.credits_balance ?? 0}
      userProfile={{
        full_name: profile?.full_name ?? null,
        avatar_url: profile?.avatar_url ?? null,
        email: profile?.email ?? user.email ?? "",
      }}
      userId={user.id}
    />
  );
}
