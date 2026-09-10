-- A9. Bound WHICH COLUMNS the existing profiles UPDATE policy can rewrite.
--
-- Third application of the pattern in 20260830140000 (messages) and
-- 20260831100000 (conversation_participants), read from those files rather
-- than recalled. Sequence is always revoke, then grant specific columns,
-- then the policy. Adding a policy alone silently makes every column
-- writable to anyone the policy admits.
--
-- WHAT IS ACTUALLY BROKEN. The UPDATE policy admits the row on
-- auth.uid() = id and NOTHING bounds which of the 22 columns it may rewrite,
-- because a policy cannot restrict itself to a column and the grant is
-- table-level: relacl holds arwdDxtm for anon and authenticated, and
-- column_privileges shows 22 of 22 for every grantee, which is that table
-- grant expanded per column rather than a real column grant. The policy also
-- carries no explicit WITH CHECK, so Postgres falls back to USING: id stays
-- pinned, and nothing else is constrained at all.
--
-- The concrete consequence is heat_score. It is maintained by
-- apply_talent_charge() on post_likes with a 3-hour half-life, deliberately
-- in a trigger so the decay cannot be duplicated or gamed. A direct PATCH
-- writes it outright and skips the trigger entirely. It is not rendered
-- anywhere today, so this is a LATENT incentive; it goes live the moment
-- Spotlight cuts over to heat_score (backlog C3), which is the worst possible
-- time to be finding this.
--
-- THE COLUMN LIST IS DERIVED FROM THE CODE, not from what seems reasonable.
-- Every .update() in src/ was enumerated and resolved to its table. Exactly
-- three target profiles:
--   TalentManage.tsx:82         display_name, sub_role, bio
--   TalentDashboard.tsx:212     is_active, current_venue_id, active_at
--   InteractiveHeroReel.tsx:76  hero_reel_url   (entityType === 'talent')
-- The third writes to a VARIABLE table name and is the one a naive grep
-- misses. There is no INSERT or UPSERT on profiles from src/ at all; row
-- creation is entirely handle_new_user().
--
-- avatar_url is the eighth and has NO writer today. It is rendered on
-- TalentProfile with no write path anywhere, which is an omission rather than
-- a decision, so it is granted now to keep an avatar editor from shipping
-- straight into a 42501.
--
-- NOT GRANTED, and why each is deliberate:
--   heat_score, heat_updated_at  maintained by apply_talent_charge()
--   role_type                    admin-actions only, as service_role
--   id                           the key; the policy already pins it
--   updated_at                   set by update_profiles_updated_at
--   sort_name                    GENERATED; Postgres rejects writes (428C9)
--   username, full_name, website, location, city, banner_url,
--   total_lifetime_spend, venue_id
--                                no writer exists in src/ today
--
-- PROVEN BEFORE SHIPPING, in transactions that rolled back:
--   * All four real write shapes succeed as authenticated, each affecting
--     exactly 1 row, through RLS and both profiles triggers. Rows affected
--     checked, not absence of error, because an RLS denial returns success
--     with zero rows.
--   * The heat_score write is DENIED with 42501. Demonstrated, not assumed.
--   * updated_at is still stamped by update_profiles_updated_at even though
--     authenticated cannot name that column, which was the open question.
--     Column privileges are checked against the columns named in the
--     statement, not against what a BEFORE trigger writes afterward.
--   * Neither anon nor authenticated is a member of any role, so neither can
--     inherit UPDATE around the revoke. Memberships run downward from
--     postgres, not upward.
--
-- THE COUPLING THIS CREATES, recorded because it is the cost of the change.
-- After this migration, heat_score integrity depends on apply_talent_charge()
-- remaining SECURITY DEFINER owned by postgres (the profiles owner). Verified
-- live at ship time: prosecdef=true, owner=postgres, search_path=public, and
-- postgres holds implicit owner UPDATE on heat_score despite rolsuper=false.
-- Flipping that function to SECURITY INVOKER, or changing its owner, makes
-- every post like fail with 42501: loud, since the trigger is AFTER INSERT
-- and the raise aborts the like. Before this migration that flag was inert,
-- because authenticated could write heat_score directly. That is the whole
-- point of the change, and this is its cost.
--
-- MAINTENANCE COST, stated because it is real: a new profile field means a
-- new GRANT, and forgetting one fails loudly at runtime with 42501. The
-- behaviour it replaces failed silently and permissively.
REVOKE UPDATE ON public.profiles FROM authenticated;
REVOKE UPDATE ON public.profiles FROM anon;

GRANT UPDATE (
  display_name,
  bio,
  sub_role,
  hero_reel_url,
  avatar_url,
  is_active,
  current_venue_id,
  active_at
) ON public.profiles TO authenticated;
