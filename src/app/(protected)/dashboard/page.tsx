import { getAuthenticatedProfile } from "@/lib/supabase/queries";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { ProjectList } from "@/components/projects/project-list";
import { attachSignedUrls, BUCKET_UPLOADS } from "@/lib/utils/storage";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const { user, profile } = await getAuthenticatedProfile();

  if (!user) {
    redirect("/login");
  }

  const supabase = await createClient();

  // Fetch projects
  const { data: projects } = await supabase
    .from("projects")
    .select("*")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  const projectList = projects ?? [];
  const projectIds = projectList.map((p) => p.id);

  // Fetch all seed images for these projects in one query — we only need
  // (id, project_id, storage_path, created_at). With typical project counts
  // (<100) this is well under any pagination limit.
  const { data: allImages } = projectIds.length
    ? await supabase
        .from("images")
        .select("id, project_id, storage_path, created_at")
        .in("project_id", projectIds)
        .order("created_at", { ascending: true })
    : { data: [] as { id: string; project_id: string; storage_path: string; created_at: string }[] };

  // Reduce to first seed image + seed_count per project
  const firstByProject = new Map<
    string,
    { id: string; project_id: string; storage_path: string; created_at: string }
  >();
  const seedCountByProject = new Map<string, number>();
  for (const img of allImages ?? []) {
    seedCountByProject.set(
      img.project_id,
      (seedCountByProject.get(img.project_id) ?? 0) + 1
    );
    if (!firstByProject.has(img.project_id)) {
      firstByProject.set(img.project_id, img);
    }
  }

  // Fetch completed generation counts per project. We join through images
  // using the image_id → project_id relationship. Simpler: pull completed
  // generation rows with an inner join to images filtered by our project
  // ids, then count in JS.
  const imageIds = (allImages ?? []).map((i) => i.id);
  const { data: completedGens } = imageIds.length
    ? await supabase
        .from("generations")
        .select("id, image_id")
        .eq("status", "completed")
        .in("image_id", imageIds)
    : { data: [] as { id: string; image_id: string }[] };

  const imageIdToProject = new Map<string, string>(
    (allImages ?? []).map((i) => [i.id, i.project_id])
  );
  const generatedCountByProject = new Map<string, number>();
  for (const gen of completedGens ?? []) {
    const projectId = imageIdToProject.get(gen.image_id);
    if (!projectId) continue;
    generatedCountByProject.set(
      projectId,
      (generatedCountByProject.get(projectId) ?? 0) + 1
    );
  }

  // Batch signed URLs for the first-seed-image of each project (single
  // HTTP request). Service-role client bypasses RLS for signing.
  const admin = createAdminClient();
  const firstImages = Array.from(firstByProject.values());
  const signed = await attachSignedUrls(admin, BUCKET_UPLOADS, firstImages);
  const thumbnailByProject = new Map<string, string>();
  for (const row of signed) {
    if (row.url) thumbnailByProject.set(row.project_id, row.url);
  }

  const projectsWithThumbnails = projectList.map((p) => ({
    ...p,
    thumbnail_url: thumbnailByProject.get(p.id) ?? null,
    seed_count: seedCountByProject.get(p.id) ?? 0,
    generated_count: generatedCountByProject.get(p.id) ?? 0,
  }));

  const displayName = profile?.full_name || user.email?.split("@")[0] || "there";

  return (
    <main className="mx-auto max-w-7xl px-element py-section">
      <div className="space-y-group">
        <h1 className="text-2xl font-bold text-foreground">
          Welcome back, {displayName}
        </h1>

        <ProjectList initialProjects={projectsWithThumbnails} />
      </div>
    </main>
  );
}
