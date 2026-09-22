-- A8: venues are readable by everyone, always. One SELECT policy, nothing else.
--
-- WHY (owner decision, 2026-09-22, recorded in A8)
-- A venue is a real public place. Hiding its row protects nothing: a bar's
-- name, address and category are public facts, and a closed bar is still
-- somewhere people look up. venues.is_active means open for business right
-- now. It drives a badge, Discovery's ordering and the presence rule in
-- src/lib/presence.ts, and it must never decide whether a row can be read.
-- Venues have no directory; talent does. So there is no listed-versus-unlisted
-- state for a venue to be in, and no reading of is_active as "on the platform"
-- is correct.
--
-- WHAT THIS REVERSES, AND WHAT IT KEEPS
-- A1 phase 1 (20260920120000, a688980) added owner, admin and active-staff
-- SELECT policies. A1 phase 2 (20260921120000, 4d99d2d) dropped the two
-- USING (true) policies, which narrowed venues to those three plus the two
-- is_active policies. This file reverses that narrowing, deliberately, and it
-- is a decision rather than a correction of a mistake.
--
-- What A1 found still stands, and its result is kept. A1's defect was two
-- USING (true) policies sitting beside narrower ones that were therefore
-- inert, so the narrower ones looked like a boundary and were not. The end
-- state here is the opposite of that trap, not a return to it: ONE policy that
-- admits every row and says exactly that. The five SELECT policies are removed
-- in the same statement batch precisely because leaving any of them beside a
-- true policy would recreate the trap.
--
-- After this file, public.venues carries:
--   "Venues are readable by everyone"     SELECT, PERMISSIVE, TO public, true
--   "Managers can update their own venue" UPDATE, unchanged
-- Row access is now uniform. The only remaining boundary on this table is the
-- column layer (A31): every readable row still exposes all 28 columns,
-- including commission_rate, standard_commission and table_min_spend, so the
-- separation between a venue's public profile and its commercial terms lives
-- entirely in column grants, with nothing behind it.
--
-- The helper public.is_active_venue_staff(uuid) is dropped with the policy
-- that was its only caller. Measured 2026-09-22: pg_depend lists exactly one
-- dependent, "policy Active staff read their venue on table venues", and a
-- search of every function body in the database for the name returns zero
-- rows, which matters because pg_depend does not track PL/pgSQL bodies.
-- Dropped without CASCADE, so anything unexpected that depends on it fails
-- loudly rather than being silently carried away.
--
-- NAMING, deliberate: the new policy is "Venues are readable by everyone",
-- which is neither of the two names A1 phase 2 drops ("Allow public read
-- access for venues", "Enable read access for all users"). Under A16 we do not
-- control which runner re-applies an older migration, and 20260921120000 is
-- written with DROP POLICY IF EXISTS against those two names. A different name
-- means a re-run of that file can never remove this policy.
--
-- IDEMPOTENT, per A16: DROP POLICY IF EXISTS before CREATE POLICY, because
-- CREATE POLICY has no IF NOT EXISTS, and IF EXISTS on every drop. A re-apply
-- rewrites the policy to this text and the drops become no-ops.
--
-- ORDER: the new policy is created before the old ones are dropped, so no
-- statement in this file ever leaves venues readable by fewer callers than
-- before. DDL is transactional, so this is belt and braces.

DROP POLICY IF EXISTS "Venues are readable by everyone" ON public.venues;
CREATE POLICY "Venues are readable by everyone"
  ON public.venues
  FOR SELECT
  TO public
  USING (true);

DROP POLICY IF EXISTS "Anyone can view active venues" ON public.venues;
DROP POLICY IF EXISTS "Public venues are viewable by everyone" ON public.venues;
DROP POLICY IF EXISTS "Owners read their own venues" ON public.venues;
DROP POLICY IF EXISTS "Admins read all venues" ON public.venues;
DROP POLICY IF EXISTS "Active staff read their venue" ON public.venues;

-- After the policy above is gone, nothing calls this. No CASCADE on purpose.
DROP FUNCTION IF EXISTS public.is_active_venue_staff(uuid);

-- Post-assert. Any failure raises and rolls the whole file back. No total
-- policy count is asserted: that would break the first time anyone adds an
-- unrelated policy to venues and this file is re-applied.
DO $postcheck$
DECLARE
  leftover text[];
  n_new int;
  n_update int;
BEGIN
  SELECT count(*) INTO n_new
    FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'venues'
     AND policyname = 'Venues are readable by everyone'
     AND cmd = 'SELECT' AND permissive = 'PERMISSIVE'
     AND qual = 'true' AND roles::text = '{public}';
  IF n_new <> 1 THEN
    RAISE EXCEPTION 'A8 post-check failed: "Venues are readable by everyone" is not present as a PERMISSIVE SELECT policy TO public with qual true';
  END IF;

  SELECT array_agg(p.policyname ORDER BY p.policyname) INTO leftover
    FROM pg_policies p
   WHERE p.schemaname = 'public' AND p.tablename = 'venues'
     AND p.policyname IN ('Anyone can view active venues',
                          'Public venues are viewable by everyone',
                          'Owners read their own venues',
                          'Admins read all venues',
                          'Active staff read their venue');
  IF leftover IS NOT NULL THEN
    RAISE EXCEPTION 'A8 post-check failed: these policies were not removed: %', leftover;
  END IF;

  SELECT count(*) INTO n_update
    FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'venues'
     AND policyname = 'Managers can update their own venue' AND cmd = 'UPDATE';
  IF n_update <> 1 THEN
    RAISE EXCEPTION 'A8 post-check failed: the UPDATE policy "Managers can update their own venue" is missing';
  END IF;

  IF to_regprocedure('public.is_active_venue_staff(uuid)') IS NOT NULL THEN
    RAISE EXCEPTION 'A8 post-check failed: public.is_active_venue_staff(uuid) still exists';
  END IF;
END
$postcheck$;
