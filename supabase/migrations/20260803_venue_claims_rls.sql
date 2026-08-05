-- venue_claims had NO row security at all (confirmed 2026-08-03:
-- pg_class.relrowsecurity = false, pg_policies returns zero rows). Any
-- authenticated user could read every claim, including legal_name /
-- business_email / business_phone (Tier 2 PII), and could insert, update or
-- delete arbitrary rows - including self-approving their own claim by
-- flipping status to 'approved'.
--
-- ADMIN IDENTITY: per the 2026-08-03 decision, admin does not live in
-- role_type. The DB has no access to the ADMIN_USER_ID edge function
-- secret, so the only admin signal available inside a policy is the JWT
-- email claim - the same mechanism CEORoute already uses. is_admin() exists
-- so that email appears exactly ONCE in the database rather than being
-- inlined into every policy. Note this is a THIRD copy of the admin
-- identity (CEORoute's email, the ADMIN_USER_ID secret, now this), which
-- widens the already-accepted desync risk logged in CLAUDE.md. Flagged
-- deliberately, not overlooked.
--
-- No SECURITY DEFINER: is_admin() reads only the request JWT, it touches no
-- tables, so it needs no elevated rights.

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(auth.jwt() ->> 'email', '') = 'jbray131@gmail.com';
$$;

ALTER TABLE public.venue_claims ENABLE ROW LEVEL SECURITY;

-- SELECT: a claimant sees only their own claims. Admin sees all, which is
-- what CEODashboard needs (it reads pending claims over the normal
-- authenticated client, not the service role).
DROP POLICY IF EXISTS "Claimants read own claims" ON public.venue_claims;
CREATE POLICY "Claimants read own claims"
ON public.venue_claims
FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR public.is_admin());

-- INSERT: a user may only file a claim as themselves, and only as
-- 'pending'. Without the status predicate a claimant could insert a row
-- pre-set to 'approved' and grant themselves a venue outright.
DROP POLICY IF EXISTS "Claimants create own pending claims" ON public.venue_claims;
CREATE POLICY "Claimants create own pending claims"
ON public.venue_claims
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid() AND status = 'pending');

-- Deliberately NO update or delete policy for `authenticated`. Status
-- transitions (approve/reject) happen only through the admin-actions edge
-- function, which uses the service role key and bypasses RLS entirely, so
-- it keeps working untouched. With RLS enabled and no matching policy,
-- every client-side UPDATE or DELETE on venue_claims is denied by default,
-- including a claimant trying to approve their own claim.
