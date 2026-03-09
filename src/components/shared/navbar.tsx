import { getAuthenticatedProfile } from "@/lib/supabase/queries";
import { NavbarClient } from "./navbar-client";

export async function Navbar() {
  const { user, profile } = await getAuthenticatedProfile();

  return (
    <NavbarClient
      user={user ? { id: user.id, email: user.email ?? "" } : null}
      profile={profile}
    />
  );
}
