import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createStripeClient } from "@/lib/stripe/client";
import { findResolvedPack } from "@/lib/billing/packs";

/**
 * POST /api/billing/checkout
 *
 * Creates a Stripe Checkout Session for a one-time credit pack purchase.
 * Body: { packId: string, successUrl: string, cancelUrl: string }
 *
 * Fulfillment happens in the Stripe webhook (checkout.session.completed),
 * which calls add_credits() with the Stripe event id for idempotency.
 */
export async function POST(request: Request) {
  // Auth
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Parse + validate input
  let body: { packId?: string; successUrl?: string; cancelUrl?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.packId) {
    return NextResponse.json({ error: "Missing packId" }, { status: 400 });
  }
  // Resolve against admin overrides (admin_settings.credit_pack_overrides) so
  // the price + credits we send to Stripe match what the pricing UI shows and
  // what the webhook will grant.
  const pack = await findResolvedPack(body.packId);
  if (!pack) {
    return NextResponse.json({ error: "Unknown pack" }, { status: 400 });
  }

  // Restrict redirect URLs to the configured app origin to prevent open-redirect
  // abuse via crafted successUrl / cancelUrl payloads.
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    request.headers.get("origin") ||
    "http://localhost:3000";

  function safeUrl(input: string | undefined, fallback: string): string {
    if (!input) return fallback;
    try {
      const u = new URL(input, appUrl);
      const base = new URL(appUrl);
      if (u.origin !== base.origin) return fallback;
      return u.toString();
    } catch {
      return fallback;
    }
  }

  const successUrl = safeUrl(
    body.successUrl,
    `${appUrl}/dashboard?purchase=success`
  );
  const cancelUrl = safeUrl(
    body.cancelUrl,
    `${appUrl}/dashboard?purchase=canceled`
  );

  // Look up or create Stripe customer for this user
  const admin = createAdminClient();
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("stripe_customer_id, email")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    return NextResponse.json(
      { error: "Profile not found" },
      { status: 500 }
    );
  }

  const stripe = createStripeClient();

  let customerId = profile.stripe_customer_id as string | null;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: profile.email || user.email || undefined,
      metadata: { user_id: user.id },
    });
    customerId = customer.id;
    await admin
      .from("profiles")
      .update({ stripe_customer_id: customerId })
      .eq("id", user.id);
  }

  // Create the Checkout Session. Use inline price_data so packs can be added
  // without managing Stripe Products/Prices in the dashboard.
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer: customerId,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: pack.priceCents,
            product_data: {
              name: `${pack.name} — ${pack.credits} credits`,
              description: pack.blurb,
            },
          },
        },
      ],
      // Metadata is what the webhook reads to grant credits. Putting it on
      // both the session and payment_intent makes either event easy to
      // reconcile.
      metadata: {
        user_id: user.id,
        pack_id: pack.id,
        credits: String(pack.credits),
      },
      payment_intent_data: {
        metadata: {
          user_id: user.id,
          pack_id: pack.id,
          credits: String(pack.credits),
        },
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
      allow_promotion_codes: true,
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "Stripe did not return a checkout URL" },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Stripe error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
