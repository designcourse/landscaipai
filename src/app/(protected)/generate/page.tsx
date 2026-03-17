import { getAuthenticatedProfile } from "@/lib/supabase/queries";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { GenerationWorkspace } from "@/components/generate/generation-workspace";
import {
  attachSignedUrls,
  BUCKET_UPLOADS,
  BUCKET_GENERATIONS,
  SIGNED_URL_EXPIRY,
} from "@/lib/utils/storage";

export const metadata = { title: "Generate" };

export default async function GeneratePage({
  searchParams,
}: {
  searchParams: Promise<{ image?: string }>;
}) {
  const { user, profile } = await getAuthenticatedProfile();
  if (!user) redirect("/login");

  const { image: imageId } = await searchParams;
  if (!imageId) redirect("/dashboard");

  const supabase = await createClient();
  const admin = createAdminClient();

  // Fetch the source image (need storage_path before we can get signed URL)
  const { data: image } = await supabase
    .from("images")
    .select("*, projects(id, name)")
    .eq("id", imageId)
    .single();

  if (!image) redirect("/dashboard");

  // Fetch original signed URL + generations in parallel
  const [{ data: originalUrlData }, { data: generations }] = await Promise.all([
    admin.storage.from(BUCKET_UPLOADS).createSignedUrl(image.storage_path, SIGNED_URL_EXPIRY),
    supabase
      .from("generations")
      .select("*")
      .eq("image_id", imageId)
      .eq("status", "completed")
      .order("created_at", { ascending: true })
      .limit(30),
  ]);

  // Batch signed URLs for generations (single HTTP request)
  const generationsWithUrls = await attachSignedUrls(admin, BUCKET_GENERATIONS, generations ?? []);

  const project = (image as Record<string, unknown>).projects as { id: string; name: string };

  return (
    <main className="mx-auto max-w-7xl px-element py-8">
      <GenerationWorkspace
        image={image}
        originalImageUrl={originalUrlData?.signedUrl ?? ""}
        projectId={project.id}
        projectName={project.name}
        initialGenerations={generationsWithUrls}
        creditsBalance={profile?.credits_balance ?? 0}
      />
    </main>
  );
}
