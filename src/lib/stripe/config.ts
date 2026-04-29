/**
 * Credit pack definitions — one-time purchases via Stripe Checkout.
 *
 * Pricing is anchored to ~$0.10/credit cost (Gemini image gen at 2K + Veo
 * 3.1 Fast 720p balance). Retail starts at $0.30/credit on the smallest
 * pack and scales down with quantity.
 *
 * The `id` is stored in Stripe Checkout Session metadata for fulfillment.
 * Adding a pack here is sufficient — fulfillment looks the pack up by id.
 */
export interface CreditPack {
  id: string;
  /** USD cents — what the customer pays */
  priceCents: number;
  /** Credits granted on successful purchase */
  credits: number;
  /** Display label */
  name: string;
  /** One-line description */
  blurb: string;
  /** Optional badge (e.g. "Most popular", "Best value") */
  badge?: string;
}

export const CREDIT_PACKS: readonly CreditPack[] = [
  {
    id: "credits-15",
    priceCents: 1500,
    credits: 50,
    name: "Starter pack",
    blurb: "Try a few designs and a video.",
  },
  {
    id: "credits-30",
    priceCents: 3000,
    credits: 105,
    name: "Popular pack",
    blurb: "Full yard with several options.",
    badge: "Most popular",
  },
  {
    id: "credits-60",
    priceCents: 6000,
    credits: 225,
    name: "Pro pack",
    blurb: "Multiple clients or a big project.",
  },
  {
    id: "credits-100",
    priceCents: 10000,
    credits: 400,
    name: "Studio pack",
    blurb: "Best value per credit.",
    badge: "Best value",
  },
] as const;

export type CreditPackId = (typeof CREDIT_PACKS)[number]["id"];

export function findCreditPack(id: string): CreditPack | undefined {
  return CREDIT_PACKS.find((p) => p.id === id);
}

/** Per-credit price in dollars, used for "save N%" labels. */
export function pricePerCredit(pack: CreditPack): number {
  return pack.priceCents / 100 / pack.credits;
}

/** Discount % vs. the smallest pack's per-credit price. */
export function discountPercent(pack: CreditPack): number {
  const base = CREDIT_PACKS[0];
  if (pack.id === base.id) return 0;
  const basePer = pricePerCredit(base);
  const thisPer = pricePerCredit(pack);
  return Math.round(((basePer - thisPer) / basePer) * 100);
}
