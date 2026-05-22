import { redirect } from "next/navigation";
import { getAuthenticatedProfile } from "@/lib/supabase/queries";
import { SiteNavbar } from "@/components/shared/site-navbar";
import { SiteFooter } from "@/components/shared/site-footer";
import { AdminTabs } from "./admin-tabs";

// Admin-only area. Middleware already gates /admin/* via profile.user_type
// but we re-check here so a misconfigured middleware can't expose admin
// pages to the wrong user.
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, profile } = await getAuthenticatedProfile();
  if (!user) redirect("/login");
  if (profile?.user_type !== "admin") redirect("/dashboard");

  return (
    <div className="flex min-h-screen flex-col">
      <SiteNavbar />
      <main className="flex-1">
        <div className="mx-auto max-w-6xl px-element py-section">
          <header className="mb-element">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">
              Admin
            </p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground">
              Site controls
            </h1>
            <p className="mt-tight text-sm text-muted-foreground">
              Visible only to admins. Changes apply site-wide immediately.
            </p>
          </header>
          <AdminTabs />
          <div className="mt-section">{children}</div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
