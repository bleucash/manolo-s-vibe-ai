-- Closes the charge/uncharge pump. Before this, handleChargeToggle deleted
-- the row on uncharge and inserted a fresh one on recharge, so a user could
-- toggle a single post repeatedly and each re-insert would credit +1 to the
-- talent's heat_score. A unique constraint alone cannot stop that: no two
-- rows ever coexist, the row is simply recreated.
--
-- Fix is soft delete. The row is created exactly once per (post_id, user_id)
-- and flipped thereafter, so heat_score credit can hang off AFTER INSERT and
-- be structurally unrepeatable.
--
-- Three pieces, all load-bearing together:
--
-- 1. is_active, the soft-delete flag. Defaults true so any future plain
--    INSERT is a charge.
--
-- 2. UNIQUE (post_id, user_id), which ALREADY EXISTS as
--    post_likes_post_id_user_id_key and is therefore not created here.
--    Worth stating rather than assuming: it is the enforcement backbone of
--    this design, the thing that makes "one row ever" true, which is what
--    makes "credit once" true. Without it a direct API call could insert a
--    second row for the same pair and farm the credit again. Do not drop it
--    on the reasoning that a toggle cannot produce duplicates; under soft
--    delete it is load-bearing.
--
-- 3. Dropping the DELETE policy. Also load-bearing, not tidying. If clients
--    can still hard-delete their own row, the original pump survives
--    untouched: delete, re-insert, get credited again. Users lose nothing,
--    uncharging is now is_active = false, which the new UPDATE policy allows.

ALTER TABLE public.post_likes
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- Needed for the upsert's ON CONFLICT DO UPDATE path; there was no UPDATE
-- policy at all before this, only INSERT/DELETE/SELECT.
DROP POLICY IF EXISTS "Users can update their own likes" ON public.post_likes;
CREATE POLICY "Users can update their own likes"
ON public.post_likes
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- See note 3 above: this is what forces uncharge down the soft-delete path.
DROP POLICY IF EXISTS "Users can delete their own likes" ON public.post_likes;
