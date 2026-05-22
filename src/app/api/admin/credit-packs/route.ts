import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CREDIT_PACKS } from "@/lib/stripe/config";
import { getCreditPackOverrides } from "@/lib/billing/packs";

const OVERRIDES_KEY = "credit_pack_overrides";
const STRIPE_USD_MIN_CENTS = 50;

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) };
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("user_type")
    .eq("id", user.id)
    .single();
  if (profile?.user_type !== "admin") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { user };
}

export async function GET() {
  const gate = await requireAdmin();
  if ("error" in gate) return gate.error;
  const { overrides } = await getCreditPackOverrides();
  return NextResponse.json({ overrides });
}

export async function PUT(request: Request) {
  const gate = await requireAdmin();
  if ("error" in gate) return gate.error;

  let body: {
    overrides?: Record<string, { price_cents?: unknown; credits?: unknown }>;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const incoming = body.overrides ?? {};
  const validIds = new Set(CREDIT_PACKS.map((p) => p.id));
  const cleaned: Record<string, { price_cents?: number; credits?: number }> = {};

  for (const [id, val] of Object.entries(incoming)) {
    if (!validIds.has(id) || !val || typeof val !== "object") continue;
    const out: { price_cents?: number; credits?: number } = {};
    if (val.price_cents != null) {
      const n = Number(val.price_cents);
      if (!Number.isInteger(n) || n < STRIPE_USD_MIN_CENTS) {
        return NextResponse.json(
          {
            error: `Price for ${id} must be at least $0.50 (Stripe USD minimum).`,
          },
          { status: 400 }
        );
      }
      out.price_cents = n;
    }
    if (val.credits != null) {
      const n = Number(val.credits);
      if (!Number.isInteger(n) || n < 1) {
        return NextResponse.json(
          { error: `Credits for ${id} must be a positive integer.` },
          { status: 400 }
        );
      }
      out.credits = n;
    }
    if (Object.keys(out).length > 0) cleaned[id] = out;
  }

  const admin = createAdminClient();
  const { error } = await admin.from("admin_settings").upsert({
    key: OVERRIDES_KEY,
    value: cleaned,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ overrides: cleaned });
}
