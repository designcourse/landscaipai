-- Migration: Auto-profile trigger + seed data

-- Trigger function: create profile row on new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_free_credits INTEGER;
BEGIN
  -- Create profile row
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.raw_user_meta_data ->> 'avatar_url'
  );

  -- Read free signup credits from admin settings
  SELECT (value::TEXT)::INTEGER INTO v_free_credits
  FROM public.admin_settings
  WHERE key = 'free_signup_credits';

  -- Default to 3 if setting not found
  IF v_free_credits IS NULL THEN
    v_free_credits := 3;
  END IF;

  -- Add free credits to the new profile
  IF v_free_credits > 0 THEN
    UPDATE public.profiles
    SET credits_balance = v_free_credits
    WHERE id = NEW.id;

    INSERT INTO public.credit_transactions (user_id, amount, type, description)
    VALUES (NEW.id, v_free_credits, 'free_signup', 'Free credits on signup');
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger on auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Seed default admin settings
INSERT INTO public.admin_settings (key, value) VALUES
  ('free_signup_credits', '3'),
  ('max_image_upload_size_mb', '20');
