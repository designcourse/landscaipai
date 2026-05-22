import { NextResponse } from "next/server";
import { getCreditPacks } from "@/lib/billing/packs";

// Resolved credit pack list (defaults + any admin overrides). Public — used
// by pricing UIs to keep display in sync with what the checkout API actually
// charges. No caching so admin override saves propagate to every surface on
// the next page mount.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const packs = await getCreditPacks();
  return NextResponse.json(
    { packs },
    { headers: { "Cache-Control": "no-store" } }
  );
}
