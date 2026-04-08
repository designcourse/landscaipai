-- Migration: Finalize Video feature
-- Adds:
--   1. actual_* media metadata columns on video_generations (probed at completion)
--   2. company_settings table (1:1 with profiles) for landscaper/admin branding
--   3. video_finalizations table for Remotion Lambda render jobs
--   4. company-logos and finalized-videos storage buckets with RLS policies

-- ============================================================
-- 1. Extend video_generations with actual media metadata
-- ============================================================
ALTER TABLE public.video_generations
  ADD COLUMN actual_duration_seconds NUMERIC,
  ADD COLUMN actual_fps NUMERIC,
  ADD COLUMN actual_width INTEGER,
  ADD COLUMN actual_height INTEGER;

-- ============================================================
-- 2. company_settings table (1:1 with profiles)
-- ============================================================
CREATE TABLE public.company_settings (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_name TEXT,
  company_phone TEXT,
  logo_path TEXT,
  default_note TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company settings" ON public.company_settings
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can insert own company settings" ON public.company_settings
  FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update own company settings" ON public.company_settings
  FOR UPDATE USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can delete own company settings" ON public.company_settings
  FOR DELETE USING ((SELECT auth.uid()) = user_id);

-- ============================================================
-- 3. video_finalizations table
-- ============================================================
CREATE TABLE public.video_finalizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  video_generation_id UUID NOT NULL REFERENCES public.video_generations(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'rendering', 'downloading', 'completed', 'failed')),
  -- Lambda render tracking
  lambda_render_id TEXT,
  lambda_bucket_name TEXT,
  lambda_function_name TEXT,
  lambda_serve_url TEXT,
  -- Output (set when status='completed')
  output_storage_path TEXT,
  -- Cache + replay
  input_props_snapshot JSONB NOT NULL,
  input_props_hash TEXT NOT NULL,
  -- Cost tracking
  cost_credits INTEGER NOT NULL,
  cost_cents INTEGER,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_video_finalizations_video_generation_id
  ON public.video_finalizations(video_generation_id);
CREATE INDEX idx_video_finalizations_user_id
  ON public.video_finalizations(user_id);
CREATE INDEX idx_video_finalizations_status
  ON public.video_finalizations(status);
CREATE INDEX idx_video_finalizations_input_hash
  ON public.video_finalizations(input_props_hash);

-- Prevent concurrent renders of the same source video
CREATE UNIQUE INDEX idx_video_finalizations_active_uniq
  ON public.video_finalizations(video_generation_id)
  WHERE status IN ('pending', 'rendering', 'downloading');

-- Link credit_transactions to video_finalizations for audit trail
ALTER TABLE public.credit_transactions
  ADD COLUMN video_finalization_id UUID REFERENCES public.video_finalizations(id);

ALTER TABLE public.video_finalizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own video finalizations" ON public.video_finalizations
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can insert own video finalizations" ON public.video_finalizations
  FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update own video finalizations" ON public.video_finalizations
  FOR UPDATE USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can delete own video finalizations" ON public.video_finalizations
  FOR DELETE USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Video finalizations in shared projects are readable" ON public.video_finalizations
  FOR SELECT USING (EXISTS (
    SELECT 1
    FROM public.video_generations vg
    JOIN public.projects p ON p.id = vg.project_id
    WHERE vg.id = video_finalizations.video_generation_id
      AND p.is_shared = true
  ));

-- ============================================================
-- 4. Storage buckets
-- ============================================================

-- company-logos: private, 2 MB max, image formats only
-- Path structure: {user_id}/logo.{ext}
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'company-logos',
  'company-logos',
  false,
  2097152,
  ARRAY['image/png', 'image/svg+xml', 'image/webp', 'image/jpeg']
)
ON CONFLICT (id) DO NOTHING;

-- finalized-videos: private, 200 MB max, mp4 only
-- Path structure: {user_id}/{project_id}/{finalization_id}.mp4
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'finalized-videos',
  'finalized-videos',
  false,
  209715200,
  ARRAY['video/mp4']
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 5. Storage RLS policies
-- ============================================================

-- company-logos: client uploads, so insert/update/select/delete all owner-only
CREATE POLICY "company_logos_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'company-logos'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

CREATE POLICY "company_logos_select_own" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'company-logos'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

CREATE POLICY "company_logos_update_own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'company-logos'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

CREATE POLICY "company_logos_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'company-logos'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

-- finalized-videos: server-side (admin client) uploads, no insert policy needed.
-- Owner read/delete + shared-project public read.
CREATE POLICY "finalized_videos_select_own" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'finalized-videos'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

CREATE POLICY "finalized_videos_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'finalized-videos'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

CREATE POLICY "finalized_videos_select_shared" ON storage.objects
  FOR SELECT TO public
  USING (
    bucket_id = 'finalized-videos'
    AND EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = ((storage.foldername(name))[2])::uuid
        AND projects.is_shared = true
    )
  );
