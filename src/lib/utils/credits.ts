import { createAdminClient } from "@/lib/supabase/admin";

export async function deductCredit(userId: string, generationId: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("deduct_credit", {
    p_user_id: userId,
    p_generation_id: generationId,
  });

  if (error) throw error;
  return data as boolean;
}

export async function refundCredit(userId: string, generationId: string) {
  const supabase = createAdminClient();
  const { error } = await supabase.rpc("refund_credit", {
    p_user_id: userId,
    p_generation_id: generationId,
  });

  if (error) throw error;
}

/**
 * Variable-cost credit deduction (for video generation).
 * Returns true if the deduction succeeded, false if insufficient balance.
 */
export async function deductCredits(
  userId: string,
  amount: number,
  opts: { videoGenerationId?: string; generationId?: string; description?: string } = {}
) {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("deduct_credits", {
    p_user_id: userId,
    p_amount: amount,
    p_video_generation_id: opts.videoGenerationId ?? null,
    p_generation_id: opts.generationId ?? null,
    p_description: opts.description ?? "AI generation",
  });

  if (error) throw error;
  return data as boolean;
}

export async function refundCredits(
  userId: string,
  amount: number,
  opts: { videoGenerationId?: string; generationId?: string; description?: string } = {}
) {
  const supabase = createAdminClient();
  const { error } = await supabase.rpc("refund_credits", {
    p_user_id: userId,
    p_amount: amount,
    p_video_generation_id: opts.videoGenerationId ?? null,
    p_generation_id: opts.generationId ?? null,
    p_description: opts.description ?? "Failed generation refund",
  });

  if (error) throw error;
}
