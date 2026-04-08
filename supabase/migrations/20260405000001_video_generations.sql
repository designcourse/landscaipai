-- Migration: Video generation feature
-- Adds video_generations table, videos storage bucket, and variable-cost credit functions

-- ============================================================
-- video_generations table
-- ============================================================
CREATE TABLE public.video_generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  -- Start/end sources can be either an original image OR an existing generation.
  -- Exactly one of (start_image_id, start_generation_id) is set; same for end.
  start_image_id UUID REFERENCES public.images(id) ON DELETE SET NULL,
  start_generation_id UUID REFERENCES public.generations(id) ON DELETE SET NULL,
  end_image_id UUID REFERENCES public.images(id) ON DELETE SET NULL,
  end_generation_id UUID REFERENCES public.generations(id) ON DELETE SET NULL,
  -- Video settings
  model TEXT NOT NULL,
  duration_seconds INTEGER NOT NULL,
  resolution TEXT NOT NULL CHECK (resolution IN ('720p', '1080p')),
  aspect_ratio TEXT,
  camera_preset TEXT,
  transition_preset TEXT,
  motion_prompt TEXT NOT NULL,
  generate_audio BOOLEAN NOT NULL DEFAULT false,
  -- Display dimensions (inherited from source frames, for canvas layout)
  width INTEGER,
  height INTEGER,
  -- Storage (set when status='completed')
  storage_path TEXT,
  -- Veo operation tracking
  operation_metadata JSONB,
  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message TEXT,
  cost_credits INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_video_generations_project_id ON public.video_generations(project_id);
CREATE INDEX idx_video_generations_user_id ON public.video_generations(user_id);
CREATE INDEX idx_video_generations_status ON public.video_generations(status);

-- Link credit_transactions to video_generations for audit trail
ALTER TABLE public.credit_transactions
  ADD COLUMN video_generation_id UUID REFERENCES public.video_generations(id);

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE public.video_generations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own video generations" ON public.video_generations
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Video generations in shared projects are readable" ON public.video_generations
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.projects WHERE id = project_id AND is_shared = true
  ));

-- ============================================================
-- Credit functions: variable-cost versions
-- ============================================================
CREATE OR REPLACE FUNCTION public.deduct_credits(
  p_user_id UUID,
  p_amount INTEGER,
  p_video_generation_id UUID DEFAULT NULL,
  p_generation_id UUID DEFAULT NULL,
  p_description TEXT DEFAULT 'AI generation'
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

  -- Lock the user's row to prevent concurrent deductions
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
    (user_id, amount, type, description, generation_id, video_generation_id)
  VALUES
    (p_user_id, -p_amount, 'generation', p_description, p_generation_id, p_video_generation_id);

  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.refund_credits(
  p_user_id UUID,
  p_amount INTEGER,
  p_video_generation_id UUID DEFAULT NULL,
  p_generation_id UUID DEFAULT NULL,
  p_description TEXT DEFAULT 'Failed generation refund'
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
    (user_id, amount, type, description, generation_id, video_generation_id)
  VALUES
    (p_user_id, p_amount, 'refund', p_description, p_generation_id, p_video_generation_id);
END;
$$;

-- ============================================================
-- Storage bucket: videos
-- Path structure: {user_id}/{project_id}/{video_generation_id}.mp4
-- 100 MB file size limit (Veo 8s 1080p ~5-15 MB, 2k larger)
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('videos', 'videos', false, 104857600, ARRAY['video/mp4'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "videos_select_own" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'videos'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

CREATE POLICY "videos_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'videos'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

CREATE POLICY "videos_select_shared" ON storage.objects
  FOR SELECT TO public
  USING (
    bucket_id = 'videos'
    AND EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = ((storage.foldername(name))[2])::uuid
      AND projects.is_shared = true
    )
  );
