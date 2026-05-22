import { NextResponse } from "next/server";
import { getCreditPacks } from "@/lib/billing/packs";

// Resolved credit pack list (defaults + any admin overrides). Public — used
// by pricing UIs to keep display in sync with what the checkout API actually
// charges. Short cache so admin pricing tweaks propagate quickly.
export const revalidate = 0;

export async function GET() {
  const packs = await getCreditPacks();
  return NextResponse.json(
    { packs },
    {
      headers: {
        "Cache-Control": "public, max-age=0, s-maxage=15, stale-while-revalidate=60",
      },
    }
  );
}
