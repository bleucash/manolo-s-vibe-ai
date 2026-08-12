-- Closes a LIVE inflation gap. Discovery.tsx's handleCardClick writes an
-- interactions row on every card tap with no dedup, and get_talent_spotlight
-- reads interactions, so repeatedly tapping a talent's card inflates their
-- Spotlight ranking right now.
--
-- MUST dedupe first: the table already holds duplicates, so adding the
-- constraint to it as-is would fail. Confirmed live 2026-08-11:
--   28 rows total, 4 duplicate groups, 20 rows to remove.
--   venue: 3 groups, 21 rows, worst single group 13 taps.
--   talent: 1 group, 3 rows.
--
-- The DELETE keeps the EARLIEST row per group, not the latest. These are
-- duplicate taps, so the honest answer to "when did this user engage with
-- this target" is the first one, and get_talent_spotlight decays from
-- created_at, so keeping the earliest does not artificially freshen a score
-- that deduping is meant to deflate.
--
-- FUTURE: this constraint shape is right for charges and wrong for views.
-- Per the 2026-08-11 design, interactions is the intended raw signal for
-- venue profile-view tracking, where repeat views over time are meaningful
-- rather than spam. Whoever builds view tracking will need to revisit this,
-- probably by separating interaction_type semantics rather than by dropping
-- the constraint wholesale. That is a decision for that build, not this one.

DELETE FROM public.interactions a
USING public.interactions b
WHERE a.user_id = b.user_id
  AND a.target_id = b.target_id
  AND a.target_type = b.target_type
  AND a.interaction_type = b.interaction_type
  AND a.created_at > b.created_at;

ALTER TABLE public.interactions
  ADD CONSTRAINT interactions_unique_user_target_type
  UNIQUE (user_id, target_id, target_type, interaction_type);
