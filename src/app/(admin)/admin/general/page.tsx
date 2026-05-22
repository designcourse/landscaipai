import { CREDIT_PACKS } from "@/lib/stripe/config";
import { getCreditPackOverrides } from "@/lib/billing/packs";
import { PricingOverridesForm } from "./pricing-overrides-form";

export const dynamic = "force-dynamic";

export default async function AdminGeneralPage() {
  const { overrides, hasAny } = await getCreditPackOverrides();
  return (
    <div className="space-y-section">
      <PricingOverridesForm
        defaultPacks={[...CREDIT_PACKS]}
        initialOverrides={overrides}
        initialHasAny={hasAny}
      />
    </div>
  );
}
