import { getAuthenticatedProfile } from "@/lib/supabase/queries";
import { SiteNavbarClient } from "./site-navbar-client";

export async function SiteNavbar() {
  const { user, profile } = await getAuthenticatedProfile();

  return (
    <SiteNavbarClient
      user={user ? { id: user.id, email: user.email ?? "" } : null}
      profile={profile}
    />
  );
}
