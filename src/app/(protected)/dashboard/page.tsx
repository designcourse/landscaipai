import { getAuthenticatedProfile } from "@/lib/supabase/queries";
import { redirect } from "next/navigation";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const { user, profile } = await getAuthenticatedProfile();

  if (!user) {
    redirect("/login");
  }

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

        {/* Placeholder for project list */}
        <div className="rounded-lg border border-border bg-muted p-section text-center">
          <p className="text-muted-foreground">
            Your projects will appear here. Upload a photo to get started.
          </p>
        </div>
      </div>
    </main>
  );
}
