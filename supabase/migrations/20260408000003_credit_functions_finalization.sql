-- Migration: Extend credit functions to support video_finalization_id
--
-- The video_finalization_id column was added to credit_transactions in
-- 20260408000001_finalize_video.sql, but the deduct_credits / refund_credits
-- functions weren't updated to write to it. This migration adds the new
-- p_video_finalization_id parameter to both functions so finalize credit
-- transactions are properly linked to their video_finalizations row.

CREATE OR REPLACE FUNCTION public.deduct_credits(
  p_user_id UUID,
  p_amount INTEGER,
  p_video_generation_id UUID DEFAULT NULL,
  p_generation_id UUID DEFAULT NULL,
  p_description TEXT DEFAULT 'AI generation',
  p_video_finalization_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_balance INTEGER;
BEGIN
  IF p_amount <= 0 THEN
    RETURN FALSE;
  END IF;

  SELECT credits_balance INTO v_balance
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF v_balance IS NULL OR v_balance < p_amount THEN
    RETURN FALSE;
  END IF;

  UPDATE public.profiles
  SET credits_balance = credits_balance - p_amount,
      updated_at = now()
  WHERE id = p_user_id;

  INSERT INTO public.credit_transactions
    (user_id, amount, type, description, generation_id, video_generation_id, video_finalization_id)
  VALUES
    (p_user_id, -p_amount, 'generation', p_description, p_generation_id, p_video_generation_id, p_video_finalization_id);

  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.refund_credits(
  p_user_id UUID,
  p_amount INTEGER,
  p_video_generation_id UUID DEFAULT NULL,
  p_generation_id UUID DEFAULT NULL,
  p_description TEXT DEFAULT 'Failed generation refund',
  p_video_finalization_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.profiles
  SET credits_balance = credits_balance + p_amount,
      updated_at = now()
  WHERE id = p_user_id;

  INSERT INTO public.credit_transactions
    (user_id, amount, type, description, generation_id, video_generation_id, video_finalization_id)
  VALUES
    (p_user_id, p_amount, 'refund', p_description, p_generation_id, p_video_generation_id, p_video_finalization_id);
END;
$$;
