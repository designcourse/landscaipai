import { cache } from "react";
import { createClient } from "./server";
import { BUCKET_COMPANY_LOGOS } from "@/lib/utils/storage";
import type { CompanySettings, CreditTransaction, Profile } from "@/types";

/**
 * Cached per-request: fetches the authenticated user and their profile.
 * Safe to call from multiple server components in the same render —
 * React `cache()` deduplicates across the request.
 */
export const getAuthenticatedProfile = cache(async () => {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { user: null, profile: null };
  }

  const { data } = await supabase
    .from("profiles")
    .select("id, email, full_name, credits_balance, avatar_url, user_type")
    .eq("id", user.id)
    .single();

  return {
    user,
    profile: data as Pick<Profile, "id" | "email" | "full_name" | "credits_balance" | "avatar_url" | "user_type"> | null,
  };
});

const SIGNED_LOGO_URL_EXPIRY_SECONDS = 4 * 60 * 60; // 4 hours

/**
 * Cached per-request: fetches the authenticated user's company branding
 * settings (used by the Finalize Video feature) along with a signed URL
 * for their uploaded logo.
 */
export const getCompanySettings = cache(async (): Promise<{
  settings: CompanySettings | null;
  logoUrl: string | null;
}> => {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { settings: null, logoUrl: null };

  const { data } = await supabase
    .from("company_settings")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!data) return { settings: null, logoUrl: null };

  let logoUrl: string | null = null;
  if (data.logo_path) {
    const { data: urlData } = await supabase.storage
      .from(BUCKET_COMPANY_LOGOS)
      .createSignedUrl(data.logo_path, SIGNED_LOGO_URL_EXPIRY_SECONDS);
    logoUrl = urlData?.signedUrl ?? null;
  }

  return { settings: data as CompanySettings, logoUrl };
});

/**
 * Cached per-request: fetches the authenticated user's billing history —
 * one-time credit pack purchases, newest first. Subscriptions are not yet
 * fulfilled, so they're filtered out.
 */
export const getBillingHistory = cache(async (): Promise<CreditTransaction[]> => {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("credit_transactions")
    .select("*")
    .eq("user_id", user.id)
    .eq("type", "purchase")
    .order("created_at", { ascending: false });

  return (data ?? []) as CreditTransaction[];
});
