import { redirect } from "next/navigation";
import { getAuthenticatedProfile } from "@/lib/supabase/queries";
import { AccountSettings } from "@/components/account/account-settings";

export const metadata = { title: "Account Settings" };

export default async function AccountPage() {
  const { user, profile } = await getAuthenticatedProfile();

  if (!user || !profile) {
    redirect("/login");
  }

  return (
    <main className="px-element py-section">
      <AccountSettings user={user} profile={profile} />
    </main>
  );
}
