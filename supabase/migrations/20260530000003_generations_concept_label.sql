-- Label for AI-planner concepts (e.g. "Budget-Friendly", "Premium") so the
-- canvas card can show which tier/strategy a variation represents.
ALTER TABLE public.generations
  ADD COLUMN IF NOT EXISTS concept_label text;
