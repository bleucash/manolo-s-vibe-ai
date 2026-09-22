-- A1 phase 2: drop the two USING (true) SELECT policies on public.venues.
--
-- WHAT THIS DOES
-- Drops exactly "Allow public read access for venues" and "Enable read access
-- for all users" on public.venues, and nothing else. After it, venues is
-- readable through:
--   "Owners read their own venues"      (auth.uid() = owner_id)         phase 1
--   "Admins read all venues"            ((SELECT is_admin()))           phase 1
--   "Active staff read their venue"     (is_active_venue_staff(id))     phase 1
--   "Anyone can view active venues"     (is_active = true)              existing
--   "Public venues are viewable by everyone" (is_active = true)         existing
-- plus the UPDATE policy "Managers can update their own venue", untouched.
--
-- NOT TOUCHED, deliberately: venue_staff's own USING (true) policy, the two
-- is_active policies (duplicates of each other, left for a separate cleanup),
-- and the three phase 1 policies. Removing venue_staff's true policy breaks
-- the public roster and is a separate step. The rehearsal proved this exact
-- change and nothing broader.
--
-- PREREQUISITE: phase 1 (20260920120000, a688980) MUST already be applied.
-- Without its three policies, this migration would cut the owner off from
-- both closed venues, and with them the 20 policies across 7 tables that
-- filter through venues WHERE owner_id = auth.uid() under the caller's RLS:
-- tickets, venue_staff, events, payout_history, payout_requests,
-- venue_business_applications and venue_followers.
--
-- HOW THE PRECONDITION PROTECTS THE DROPS: the check and the two DROP POLICY
-- statements are in the same DO block, with the drops after the check. They
-- are reachable only if all three phase 1 policies are present. If any is
-- missing, the block raises before either drop, and nothing is dropped. That
-- holds whatever runs this file, the Management API, a platform sync, or psql
-- with or without ON_ERROR_STOP, because it does not rely on the runner
-- halting after an error. Under A16 we do not control which runner re-applies
-- it later.
--
-- REHEARSED 2026-09-21 on production, in one transaction that rolled back in
-- full, running as real roles with real claims (SET LOCAL ROLE, never postgres
-- or service_role). It dropped these two policies and returned the pass
-- sentinel:
--   A1 REHEARSAL PASSED: all 6 assertions | owner closed=2, update rows=1,
--   venue_staff=1, payout insert=1 and read back=1 | staff closed=2,
--   thread_titles=2 | admin venues=17 | anon venues=15 and closed=0
-- A read afterwards confirmed nothing persisted. That rehearsal also dropped
-- venue_staff's true policy, to make its venue_staff check meaningful; this
-- migration does not.
--
-- WHAT CHANGES FOR CALLERS, by design (from the 2026-09-16 reader survey):
-- the two closed venues stop being readable to anyone who is not their owner,
-- their active staff, or the admin. So for guests, anon and other talent they
-- drop off Discovery, their venue page renders blank (Venue.tsx returns null
-- on a missing row), posts tagged to them lose the venue embed, and a talent's
-- public gig list stops naming them for other viewers. Owners, their active
-- staff and the admin keep everything. Open venues are unaffected. Columns are
-- unaffected: every readable row still exposes all 28 columns (A31).
--
-- IDEMPOTENT, per A16: DROP POLICY IF EXISTS makes a re-apply a no-op, and the
-- precondition still passes on re-apply because it checks the phase 1
-- policies, which stay.

DO $phase2$
DECLARE
  missing text[];
BEGIN
  SELECT array_agg(req.name ORDER BY req.name) INTO missing
    FROM (VALUES ('Owners read their own venues'),
                 ('Admins read all venues'),
                 ('Active staff read their venue')) AS req(name)
   WHERE NOT EXISTS (
     SELECT 1 FROM pg_policies p
      WHERE p.schemaname = 'public'
        AND p.tablename  = 'venues'
        AND p.policyname = req.name
        AND p.cmd        = 'SELECT'
        AND p.permissive = 'PERMISSIVE'
   );

  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'A1 phase 2 aborted: phase 1 policies missing on public.venues: %. Apply 20260920120000 first. Nothing was dropped.', missing;
  END IF;

  -- Reachable only when all three phase 1 policies exist.
  DROP POLICY IF EXISTS "Allow public read access for venues" ON public.venues;
  DROP POLICY IF EXISTS "Enable read access for all users" ON public.venues;
END
$phase2$;
