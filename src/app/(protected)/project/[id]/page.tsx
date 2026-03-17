import { getAuthenticatedProfile } from "@/lib/supabase/queries";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect, notFound } from "next/navigation";
import { ProjectDetail } from "@/components/projects/project-detail";
import { attachSignedUrls, BUCKET_UPLOADS } from "@/lib/utils/storage";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("projects")
    .select("name")
    .eq("id", id)
    .single();

  return { title: data?.name ?? "Project" };
}

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { user } = await getAuthenticatedProfile();

  if (!user) {
    redirect("/login");
  }

  const supabase = await createClient();

  // Fetch project and images in parallel
  const [{ data: project, error }, { data: images }] = await Promise.all([
    supabase.from("projects").select("*").eq("id", id).single(),
    supabase.from("images").select("*").eq("project_id", id).order("created_at", { ascending: false }),
  ]);

  if (error || !project) {
    notFound();
  }

  // Batch signed URLs (single HTTP request)
  const admin = createAdminClient();
  const imagesWithUrls = await attachSignedUrls(admin, BUCKET_UPLOADS, images ?? []);

  return (
    <main className="mx-auto max-w-7xl px-element py-section">
      <ProjectDetail project={project} images={imagesWithUrls} userId={user.id} />
    </main>
  );
}
