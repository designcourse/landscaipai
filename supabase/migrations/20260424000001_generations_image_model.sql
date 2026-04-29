-- Track which AI image model was used for each generation so we can
-- distinguish results when comparing providers in the editor.
-- Values: 'gemini' (Nano Banana 2) | 'openai' (gpt-image-2)
ALTER TABLE public.generations
  ADD COLUMN IF NOT EXISTS image_model text;

CREATE INDEX IF NOT EXISTS generations_image_model_idx
  ON public.generations (image_model);
