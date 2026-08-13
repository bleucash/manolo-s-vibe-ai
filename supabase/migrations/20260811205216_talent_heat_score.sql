-- Talent Spotlight scoring, per the 2026-08-11 design: Spotlight ranks on
-- explicit charge/like actions only, never on click-through or view data.
--
-- SCOPE: this builds the score and keeps it current. It deliberately does NOT
-- touch get_talent_spotlight, which keeps its existing interactions-based
-- logic unchanged. The explicit charge buttons that would feed heat_score do
-- not exist yet on Discovery cards or talent profile pages, and post_likes
-- currently holds 0 rows, so cutting the RPC over now would empty Spotlight.
-- The cutover is its own deliberate step once those buttons ship.
--
-- Half-life is 3 hours: a score decays by half every 3 hours, so 0.5 is
-- exactly "one charge, three hours ago", which is the confirmed
-- minimum-trending threshold for the eventual cutover.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS heat_score numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS heat_updated_at timestamptz NOT NULL DEFAULT now();

-- A TRIGGER rather than application code, deliberately. post_likes already
-- has one writer (Index.tsx's handleChargeToggle) and the design adds two
-- more (Discovery cards, talent profile pages). Putting decay in the app
-- would mean duplicating it in all three and keeping them in sync forever.
-- It also matches how this codebase already handles cross-table invariants:
-- handle_new_user, prevent_profile_privilege_escalation,
-- venues_require_business_verified.
--
-- SECURITY DEFINER is required: the charging user is not the talent, so the
-- "Users can update own profile" policy would reject this write. Owned by
-- postgres, which also owns profiles, and profiles is not FORCE ROW LEVEL
-- SECURITY, so the owner bypasses RLS here. Kept narrow to justify that: one
-- lookup, one UPDATE, no dynamic SQL.
--
-- This UPDATE touches neither role_type nor sub_role, so it passes
-- prevent_profile_privilege_escalation untouched.
--
-- CREDIT-ONCE, and why AFTER INSERT is sufficient rather than incidental.
-- Paired with 20260811202026_post_likes_soft_delete.sql, a (post_id, user_id) pair
-- gets exactly one row for its lifetime: created once, then flipped between
-- is_active true/false forever. Uncharging is an UPDATE and recharging is an
-- UPDATE, and neither fires this trigger. So the +1 lands on the genuine
-- first charge and can never be farmed by toggling.
-- Uncharging deliberately does NOT subtract. The time decay already handles
-- fading relevance; subtracting would let a user erase credit they granted,
-- which is a different kind of manipulation.
-- The client upserts with ON CONFLICT DO UPDATE. Postgres fires AFTER INSERT
-- only for rows actually inserted and AFTER UPDATE for rows that took the
-- conflict path, so the upsert gets these semantics for free in one round
-- trip. This correctness depends on the UNIQUE (post_id, user_id) constraint
-- added in that migration; without it a second INSERT would re-credit.

CREATE OR REPLACE FUNCTION public.apply_talent_charge()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_talent uuid;
BEGIN
  SELECT user_id INTO target_talent FROM public.posts WHERE id = NEW.post_id;

  -- Post deleted or missing author: nothing to credit, never block the like.
  IF target_talent IS NULL THEN
    RETURN NEW;
  END IF;

  -- Decay what is already there by elapsed time, then add this charge.
  UPDATE public.profiles
  SET heat_score = (heat_score * power(0.5, extract(epoch from (now() - heat_updated_at)) / 3600 / 3)) + 1,
      heat_updated_at = now()
  WHERE id = target_talent;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS post_likes_apply_talent_charge ON public.post_likes;
CREATE TRIGGER post_likes_apply_talent_charge
AFTER INSERT ON public.post_likes
FOR EACH ROW EXECUTE FUNCTION public.apply_talent_charge();
