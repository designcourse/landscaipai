import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Whether a user's generated images should be CLEAN (no free-tier watermark).
 *
 * True if they've ever paid us — a one-time credit-pack purchase or a
 * subscription grant — or they're an admin (so owner/testing accounts aren't
 * watermarked). Free-trial users who have never paid get the watermark.
 *
 * Subscriptions aren't fulfilled yet (today the only real signal is a "purchase"
 * transaction), but "subscription" is included so this stays correct once they
 * are. Fails closed (treats the user as unpaid → watermark) on error so the
 * free-tier moat holds even if the lookup hiccups.
 */
export async function isPayingCustomer(
  admin: SupabaseClient,
  userId: string,
): Promise<boolean> {
  try {
    const { data: profile } = await admin
      .from("profiles")
      .select("user_type")
      .eq("id", userId)
      .single();
    if (profile?.user_type === "admin") return true;

    const { data: paidTxn } = await admin
      .from("credit_transactions")
      .select("id")
      .eq("user_id", userId)
      .in("type", ["purchase", "subscription"])
      .limit(1)
      .maybeSingle();

    return !!paidTxn;
  } catch {
    return false; // fail closed → watermark applied
  }
}
