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
