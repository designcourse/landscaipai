import { redirect } from "next/navigation";
import {
  getAuthenticatedProfile,
  getCompanySettings,
} from "@/lib/supabase/queries";
import { AccountSettings } from "@/components/account/account-settings";

export const metadata = { title: "Account Settings" };

export default async function AccountPage() {
  const { user, profile } = await getAuthenticatedProfile();

  if (!user || !profile) {
    redirect("/login");
  }

  const { settings: companySettings, logoUrl: initialLogoUrl } =
    await getCompanySettings();

  return (
    <AccountSettings
      user={user}
      companySettings={companySettings}
      initialLogoUrl={initialLogoUrl}
    />
  );
}
