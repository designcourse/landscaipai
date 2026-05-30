-- Multi-variation generation: group the sibling variants produced by one
-- request so the UI can display them together and we can audit batches.
ALTER TABLE public.generations
  ADD COLUMN IF NOT EXISTS batch_id uuid,
  ADD COLUMN IF NOT EXISTS variant_index integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS generations_batch_id_idx ON public.generations (batch_id);
