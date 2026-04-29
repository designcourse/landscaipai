import { redirect } from "next/navigation";
import {
  getAuthenticatedProfile,
  getBillingHistory,
  getCompanySettings,
} from "@/lib/supabase/queries";
import { BillingHistory } from "@/components/billing/billing-history";
import { buildDefaultBillTo } from "@/lib/billing/purchases";

export const metadata = { title: "Billing History" };

export default async function BillingHistoryPage() {
  const { user, profile } = await getAuthenticatedProfile();

  if (!user || !profile) {
    redirect("/login");
  }

  const [transactions, { settings: companySettings }] = await Promise.all([
    getBillingHistory(),
    getCompanySettings(),
  ]);

  const defaultBillTo = buildDefaultBillTo({
    user,
    profile,
    companySettings,
  });

  return (
    <BillingHistory
      transactions={transactions}
      defaultBillTo={defaultBillTo}
    />
  );
}
