import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { createStripeClient } from "@/lib/stripe/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { findCreditPack } from "@/lib/stripe/config";

/**
 * POST /api/webhooks/stripe
 *
 * Handles Stripe webhook events. Currently fulfills credit-pack purchases on
 * `checkout.session.completed` (mode=payment). Idempotency is enforced via
 * the `processed_stripe_events` table inside add_credits().
 *
 * Required env: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
 */
export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json(
      { error: "Webhook secret not configured" },
      { status: 500 }
    );
  }

  const rawBody = await request.text();
  const stripe = createStripeClient();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid signature";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        await handleCheckoutCompleted(event);
        break;
      }
      default:
        // Ignore unhandled event types
        break;
    }
  } catch (err) {
    console.error(`Webhook handler error for ${event.type}:`, err);
    // Return 500 so Stripe retries
    const message = err instanceof Error ? err.message : "Handler error";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function handleCheckoutCompleted(event: Stripe.Event) {
  const session = event.data.object as Stripe.Checkout.Session;

  // Only fulfill one-time payments — subscriptions go through a different
  // (not yet implemented) handler.
  if (session.mode !== "payment") return;
  if (session.payment_status !== "paid") return;

  const metadata = session.metadata ?? {};
  const userId = metadata.user_id;
  const packId = metadata.pack_id;
  const creditsRaw = metadata.credits;

  if (!userId || !packId || !creditsRaw) {
    console.warn(
      `[stripe webhook] checkout.session.completed missing metadata`,
      { sessionId: session.id, metadata }
    );
    return;
  }

  // Verify the credits granted match what the pack actually offers — defends
  // against tampered metadata in the off-chance the session is forged.
  const pack = findCreditPack(packId);
  if (!pack) {
    console.warn(`[stripe webhook] unknown pack_id ${packId}`);
    return;
  }
  const credits = pack.credits;
  if (Number(creditsRaw) !== credits) {
    console.warn(
      `[stripe webhook] credits mismatch for pack ${packId}: metadata=${creditsRaw} expected=${credits}`
    );
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("add_credits", {
    p_user_id: userId,
    p_amount: credits,
    p_type: "purchase",
    p_description: `Credit pack: ${pack.name} (${credits} credits)`,
    p_stripe_event_id: event.id,
  });

  if (error) {
    console.error(`[stripe webhook] add_credits failed:`, error);
    throw error;
  }

  // add_credits returns FALSE when the event was already processed
  // (idempotent re-delivery). Still ack 200.
  if (data === false) {
    console.log(
      `[stripe webhook] event ${event.id} already processed — skipping`
    );
  } else {
    console.log(
      `[stripe webhook] credited user ${userId} with ${credits} credits (pack=${packId})`
    );
  }
}
