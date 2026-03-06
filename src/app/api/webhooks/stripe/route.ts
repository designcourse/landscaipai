import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  // TODO: Verify Stripe signature, process webhook events
  console.log("Stripe webhook received", body.length, "bytes");

  return NextResponse.json({ received: true });
}
