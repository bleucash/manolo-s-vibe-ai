-- A1 phase 1: add the three SELECT policies venues will need, remove nothing.
--
-- WHAT PHASE 1 IS
-- venues currently carries four SELECT policies: two are USING (true) and two
-- are USING (is_active = true), so the narrower pair is inert and every row is
-- world-readable. Phase 2 removes the two true policies. Nothing may be removed
-- until the readers that depend on them have a policy of their own, because
-- permissive policies OR together: adding these three changes no caller's
-- result while the true policies remain, and it is the removal that flips
-- behaviour. This file is the add half.
--
-- WHY THESE THREE, and who falls outside them (measured 2026-09-16):
--   owner  - 3 venues have an owner, all one manager account, 2 of them closed.
--            No existing SELECT policy mentions owner_id, so the owner reads
--            its own closed venues only through the true policies today. That
--            covers reads and also writes: an UPDATE with a WHERE clause must
--            pass the SELECT policies too.
--   admin  - the admin account owns nothing and holds role_type 'guest'. Of the
--            three admin-identity mechanisms in A6, only is_admin() exists
--            inside the database; CEORoute is client-side and ADMIN_USER_ID is
--            an edge function secret. CEODashboard reads venues through RLS as
--            an ordinary authenticated caller, so is_admin() is the only thing
--            that can admit it.
--   staff  - one talent account holds both venue_staff rows, both active, both
--            at closed venues it does not own. Without this policy it loses the
--            venue names on its own gigs, its public profile shows gigs with no
--            venue, and conversation_summary returns a NULL thread_title for
--            both venue threads it participates in.
-- status = 'active' only, decided by the owner: a pending invitee has accepted
-- nothing, and a venues row carries commission_rate, standard_commission and
-- table_min_spend.
--
-- All three are scoped to authenticated. None of the predicates can match a
-- null auth.uid(), and is_admin() reads a JWT claim, so anon would evaluate
-- them to false anyway; naming the role keeps anon out of the evaluation.
--
-- THE STAFF POLICY GOES THROUGH A SECURITY DEFINER HELPER, AND THE RECURSION
-- IT AVOIDS WAS MEASURED, NOT ASSUMED. Five venue_staff policies read venues in
-- their USING or WITH CHECK. A venues policy reading venue_staff directly would
-- close that cycle. Tested 2026-09-20 on temp tables inside a rolled-back
-- transaction, never on the real tables: a cycle between two tables raises
-- 42P17 "infinite recursion detected in policy for relation", and it raises it
-- just the same when the second table also carries a permissive USING (true).
-- So venue_staff's existing true policy would NOT have masked the cycle, and
-- the failure would have arrived at phase 2 or earlier. The helper runs as its
-- owner, which bypasses RLS on venue_staff, so no policy is re-entered. Same
-- fix as is_conversation_participant, which is what ended the 42P17 outage on
-- the messaging tables.
-- The helper breaks the recursion only because its owner reads venue_staff past
-- RLS. Measured 2026-09-13, that owner is postgres, which owns venue_staff and
-- holds BYPASSRLS, and RLS is not forced on venue_staff. BYPASSRLS overrides
-- FORCE ROW LEVEL SECURITY, so forcing RLS on venue_staff would not by itself
-- bring the cycle back. The cycle returns if this function is ever owned by a
-- role that is subject to venue_staff's policies, or is made SECURITY INVOKER.
--
-- HELPER CONVENTIONS, per A15: CREATE OR REPLACE and never DROP, so the owner
-- and ACL survive and no window exists where the function is missing;
-- search_path pinned to public, pg_temp with pg_temp last; every relation
-- schema-qualified; auth.uid() carries its schema; EXECUTE revoked from PUBLIC
-- and anon, because new functions in public receive EXECUTE to PUBLIC by
-- default. authenticated needs EXECUTE: a policy's function runs as the caller.
--
-- IDEMPOTENCY, per A16: the platform re-applies every migration on sync, and
-- CREATE POLICY has no IF NOT EXISTS. This file uses DROP POLICY IF EXISTS
-- before each CREATE rather than a DO block that checks pg_policies, for two
-- reasons. The file stays authoritative: a re-apply converges the live policy
-- to the text here, whereas an existence check would leave a drifted policy in
-- place, and this schema has a recorded history of live objects drifting from
-- their files. And DDL is transactional, so the drop and create commit
-- together and no session ever sees the policy missing. Each DROP names only a
-- policy this file creates. Neither true policy is named anywhere in it.
--
-- WHAT THIS CHANGES TODAY: nothing observable. While the two true policies
-- stand, every caller already reads every row, and these three only add
-- alternatives that are ORed in. Phase 2, in its own migration, does the
-- removal, and is rehearsed first in a rolled-back fixture.

CREATE OR REPLACE FUNCTION public.is_active_venue_staff(_venue_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
  SELECT EXISTS (
    SELECT 1
      FROM public.venue_staff s
     WHERE s.venue_id = _venue_id
       AND s.user_id = auth.uid()
       AND s.status = 'active'
  );
$function$;

REVOKE EXECUTE ON FUNCTION public.is_active_venue_staff(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_active_venue_staff(uuid) FROM anon;
GRANT  EXECUTE ON FUNCTION public.is_active_venue_staff(uuid) TO authenticated, service_role;

-- 1. Owner. Null-safe by construction: a NULL owner_id yields NULL, which is
--    not true, so unowned venues are not admitted here.
DROP POLICY IF EXISTS "Owners read their own venues" ON public.venues;
CREATE POLICY "Owners read their own venues"
  ON public.venues
  FOR SELECT
  TO authenticated
  USING (auth.uid() = owner_id);

-- 2. Admin. Wrapped in a scalar subquery so it is evaluated once per statement
--    rather than once per row.
DROP POLICY IF EXISTS "Admins read all venues" ON public.venues;
CREATE POLICY "Admins read all venues"
  ON public.venues
  FOR SELECT
  TO authenticated
  USING ((SELECT public.is_admin()));

-- 3. Active staff, through the helper. Never a direct read of venue_staff.
DROP POLICY IF EXISTS "Active staff read their venue" ON public.venues;
CREATE POLICY "Active staff read their venue"
  ON public.venues
  FOR SELECT
  TO authenticated
  USING (public.is_active_venue_staff(venues.id));
