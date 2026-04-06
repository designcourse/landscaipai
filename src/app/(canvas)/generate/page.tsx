import { getAuthenticatedProfile } from "@/lib/supabase/queries";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { CanvasWorkspace } from "@/components/generate/canvas-workspace";
import {
  attachSignedUrls,
  BUCKET_UPLOADS,
  BUCKET_GENERATIONS,
} from "@/lib/utils/storage";

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

  // Batch signed URLs for uploads and generations
  const [imagesWithUrls, generationsWithUrls] = await Promise.all([
    attachSignedUrls(admin, BUCKET_UPLOADS, images ?? []),
    attachSignedUrls(admin, BUCKET_GENERATIONS, generations ?? []),
  ]);

  return (
    <CanvasWorkspace
      project={project}
      images={imagesWithUrls}
      generations={generationsWithUrls}
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
