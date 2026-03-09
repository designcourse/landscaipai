import { cache } from "react";
import { createClient } from "./server";
import type { Profile } from "@/types";

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
