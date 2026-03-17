-- ============================================================
-- Storage buckets and RLS policies
-- ============================================================

-- Create three private buckets with appropriate limits
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('uploads',     'uploads',     false, 20971520, ARRAY['image/jpeg','image/png','image/webp','image/heic']),
  ('thumbnails',  'thumbnails',  false, 5242880,  ARRAY['image/webp']),
  ('generations', 'generations', false, 20971520, ARRAY['image/webp']);

-- ============================================================
-- UPLOADS bucket policies
-- Path structure: {user_id}/{project_id}/{image_id}.{ext}
-- ============================================================

CREATE POLICY "uploads_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'uploads'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

CREATE POLICY "uploads_select_own" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'uploads'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

CREATE POLICY "uploads_update_own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'uploads'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

CREATE POLICY "uploads_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'uploads'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

-- Anyone can read uploads from shared projects
CREATE POLICY "uploads_select_shared" ON storage.objects
  FOR SELECT TO public
  USING (
    bucket_id = 'uploads'
    AND EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = ((storage.foldername(name))[2])::uuid
      AND projects.is_shared = true
    )
  );

-- ============================================================
-- THUMBNAILS bucket policies
-- Path structure: {user_id}/{project_id}/{image_id}_thumb.webp
-- Inserts happen server-side (admin client), so no insert policy needed.
-- ============================================================

CREATE POLICY "thumbnails_select_own" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'thumbnails'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

CREATE POLICY "thumbnails_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'thumbnails'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

-- Anyone can read thumbnails from shared projects
CREATE POLICY "thumbnails_select_shared" ON storage.objects
  FOR SELECT TO public
  USING (
    bucket_id = 'thumbnails'
    AND EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = ((storage.foldername(name))[2])::uuid
      AND projects.is_shared = true
    )
  );

-- ============================================================
-- GENERATIONS bucket policies
-- Path structure: {user_id}/{project_id}/{generation_id}.webp
-- Inserts happen server-side (admin client), so no insert policy needed.
-- ============================================================

CREATE POLICY "generations_select_own" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'generations'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

CREATE POLICY "generations_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'generations'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

-- Anyone can read generations from shared projects
CREATE POLICY "generations_select_shared" ON storage.objects
  FOR SELECT TO public
  USING (
    bucket_id = 'generations'
    AND EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = ((storage.foldername(name))[2])::uuid
      AND projects.is_shared = true
    )
  );
