import type { User } from "@supabase/supabase-js";
import { CREDIT_PACKS, type CreditPack } from "@/lib/stripe/config";
import type { CompanySettings, CreditTransaction, Profile } from "@/types";

export interface PurchaseRow {
  id: string;
  createdAt: string;
  credits: number;
  description: string;
  packName: string;
  amountCents: number | null;
  invoiceNumber: string;
}

/**
 * Match a credit_transactions row (type='purchase') to a CreditPack via the
 * credit count — pack credits are unique (50/105/225/400). Falls back to
 * scanning the description string if a pack with that credit count isn't
 * found (e.g. legacy rows or admin adjustments mis-typed as purchases).
 */
function matchPack(transaction: CreditTransaction): CreditPack | undefined {
  const byCredits = CREDIT_PACKS.find((p) => p.credits === transaction.amount);
  if (byCredits) return byCredits;

  const desc = transaction.description ?? "";
  return CREDIT_PACKS.find((p) =>
    desc.toLowerCase().includes(p.name.toLowerCase())
  );
}

/**
 * Stable per-transaction invoice number derived from the UUID. Format:
 * INV-YYYY-XXXX where YYYY is the purchase year and XXXX is the first 4
 * hex chars of the UUID, uppercased. No migration needed; the same id
 * always produces the same number.
 */
export function invoiceNumberFor(transaction: CreditTransaction): string {
  const year = new Date(transaction.created_at).getUTCFullYear();
  const suffix = transaction.id.replace(/-/g, "").slice(0, 4).toUpperCase();
  return `INV-${year}-${suffix}`;
}

export function derivePurchase(transaction: CreditTransaction): PurchaseRow {
  const pack = matchPack(transaction);
  return {
    id: transaction.id,
    createdAt: transaction.created_at,
    credits: transaction.amount,
    description: transaction.description ?? "Credit pack",
    packName: pack?.name ?? "Credit pack",
    amountCents: pack?.priceCents ?? null,
    invoiceNumber: invoiceNumberFor(transaction),
  };
}

/** Format USD cents as `$X.XX`. Returns "—" if cents is null. */
export function formatAmount(cents: number | null): string {
  if (cents == null) return "—";
  return `$${(cents / 100).toFixed(2)}`;
}

/** Format an ISO timestamp as `Mmm DD, YYYY`. */
export function formatPurchaseDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

/**
 * Build the default "Bill to" body for the invoice modal. Uses company
 * settings when present (landscaper case), otherwise falls back to the
 * profile name + email (homeowner / personal case). Each line is a
 * separate piece of the address block; users can freely edit before
 * generating the PDF.
 */
export function buildDefaultBillTo({
  user,
  profile,
  companySettings,
}: {
  user: Pick<User, "email">;
  profile: Pick<Profile, "full_name"> | null;
  companySettings: CompanySettings | null;
}): string {
  const lines: string[] = [];

  if (companySettings?.company_name) {
    lines.push(companySettings.company_name);
  } else if (profile?.full_name) {
    lines.push(profile.full_name);
  }

  if (user.email) lines.push(user.email);
  if (companySettings?.company_phone) lines.push(companySettings.company_phone);

  return lines.join("\n");
}
