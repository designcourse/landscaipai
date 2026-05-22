import { createAdminClient } from "@/lib/supabase/admin";
import { CREDIT_PACKS, type CreditPack } from "@/lib/stripe/config";

export interface CreditPackOverride {
  price_cents?: number;
  credits?: number;
}

export type CreditPackOverridesMap = Record<string, CreditPackOverride>;

const OVERRIDES_KEY = "credit_pack_overrides";

export async function getCreditPackOverrides(): Promise<{
  overrides: CreditPackOverridesMap;
  hasAny: boolean;
}> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("admin_settings")
    .select("value")
    .eq("key", OVERRIDES_KEY)
    .maybeSingle();

  const raw = (data?.value ?? {}) as Record<string, unknown>;
  const overrides: CreditPackOverridesMap = {};
  for (const [id, val] of Object.entries(raw)) {
    if (!val || typeof val !== "object") continue;
    const v = val as Record<string, unknown>;
    const out: CreditPackOverride = {};
    if (typeof v.price_cents === "number") out.price_cents = v.price_cents;
    if (typeof v.credits === "number") out.credits = v.credits;
    if (out.price_cents != null || out.credits != null) overrides[id] = out;
  }
  return { overrides, hasAny: Object.keys(overrides).length > 0 };
}

export function applyOverrides(
  packs: readonly CreditPack[],
  overrides: CreditPackOverridesMap
): CreditPack[] {
  return packs.map((pack) => {
    const o = overrides[pack.id];
    if (!o) return { ...pack };
    return {
      ...pack,
      priceCents: o.price_cents ?? pack.priceCents,
      credits: o.credits ?? pack.credits,
    };
  });
}

export async function getCreditPacks(): Promise<CreditPack[]> {
  const { overrides } = await getCreditPackOverrides();
  return applyOverrides(CREDIT_PACKS, overrides);
}

export async function findResolvedPack(
  id: string
): Promise<CreditPack | undefined> {
  const packs = await getCreditPacks();
  return packs.find((p) => p.id === id);
}
