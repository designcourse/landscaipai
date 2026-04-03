-- Fix foreign key constraints to allow image/generation deletion
-- credit_transactions.generation_id: SET NULL (keep audit trail, allow generation deletion)
-- generations.parent_generation_id: SET NULL (allow deleting parent without breaking children)

ALTER TABLE public.credit_transactions
  DROP CONSTRAINT credit_transactions_generation_id_fkey,
  ADD CONSTRAINT credit_transactions_generation_id_fkey
    FOREIGN KEY (generation_id) REFERENCES public.generations(id) ON DELETE SET NULL;

ALTER TABLE public.generations
  DROP CONSTRAINT generations_parent_generation_id_fkey,
  ADD CONSTRAINT generations_parent_generation_id_fkey
    FOREIGN KEY (parent_generation_id) REFERENCES public.generations(id) ON DELETE SET NULL;
