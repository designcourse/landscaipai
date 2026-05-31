-- Mark HD-finalized generations so the UI shows a "done" badge instead of
-- offering to finalize again.
ALTER TABLE public.generations
  ADD COLUMN IF NOT EXISTS is_finalized boolean NOT NULL DEFAULT false;
