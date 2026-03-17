import { getAuthenticatedProfile } from "@/lib/supabase/queries";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ProjectList } from "@/components/projects/project-list";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const { user, profile } = await getAuthenticatedProfile();

  if (!user) {
    redirect("/login");
  }

  const supabase = await createClient();

  // Fetch projects with image count
  const { data: projects } = await supabase
    .from("projects")
    .select("*, images(count)")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  const projectsWithCount = (projects ?? []).map((p) => ({
    ...p,
    image_count: p.images?.[0]?.count ?? 0,
  }));

  const displayName = profile?.full_name || user.email?.split("@")[0] || "there";

  return (
    <main className="mx-auto max-w-7xl px-element py-section">
      <div className="space-y-group">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Welcome back, {displayName}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            You have{" "}
            <span className="font-medium text-primary">
              {profile?.credits_balance ?? 0} credits
            </span>{" "}
            remaining
          </p>
        </div>

        <ProjectList initialProjects={projectsWithCount} />
      </div>
    </main>
  );
}
