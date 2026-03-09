-- Migration: Credit functions (all SECURITY DEFINER)

CREATE OR REPLACE FUNCTION public.deduct_credit(p_user_id UUID, p_generation_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_balance INTEGER;
BEGIN
  -- Lock the user's row to prevent concurrent deductions
  SELECT credits_balance INTO v_balance
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF v_balance IS NULL THEN
    RETURN FALSE;
  END IF;

  IF v_balance < 1 THEN
    RETURN FALSE;
  END IF;

  -- Deduct the credit
  UPDATE public.profiles
  SET credits_balance = credits_balance - 1,
      updated_at = now()
  WHERE id = p_user_id;

  -- Record the transaction
  INSERT INTO public.credit_transactions (user_id, amount, type, description, generation_id)
  VALUES (p_user_id, -1, 'generation', 'AI generation', p_generation_id);

  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.refund_credit(p_user_id UUID, p_generation_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.profiles
  SET credits_balance = credits_balance + 1,
      updated_at = now()
  WHERE id = p_user_id;

  INSERT INTO public.credit_transactions (user_id, amount, type, description, generation_id)
  VALUES (p_user_id, 1, 'refund', 'Failed generation refund', p_generation_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.add_credits(
  p_user_id UUID,
  p_amount INTEGER,
  p_type TEXT,
  p_description TEXT,
  p_stripe_event_id TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Idempotency check for Stripe events
  IF p_stripe_event_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.processed_stripe_events WHERE event_id = p_stripe_event_id) THEN
      RETURN FALSE; -- Already processed
    END IF;
    INSERT INTO public.processed_stripe_events (event_id, event_type)
    VALUES (p_stripe_event_id, p_type);
  END IF;

  UPDATE public.profiles
  SET credits_balance = credits_balance + p_amount,
      updated_at = now()
  WHERE id = p_user_id;

  INSERT INTO public.credit_transactions (user_id, amount, type, description, stripe_event_id)
  VALUES (p_user_id, p_amount, p_type, p_description, p_stripe_event_id);

  RETURN TRUE;
END;
$$;
