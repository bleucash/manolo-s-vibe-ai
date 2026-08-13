-- Build order item 4, stage 1: talent onboarding needs a request-and-approve
-- table. Today there is no path for a user to request talent status at all;
-- admin-actions' approve_talent already writes role_type = 'talent'
-- correctly, it just has nothing feeding it.
--
-- Confirmed before writing (2026-08-03): no table named talent_applications
-- or anything close exists (full public table list checked, nothing with
-- "talent" or "application" in the name).
--
-- RLS mirrors 20260804232027_venue_claims_rls.sql exactly: self-scoped SELECT with
-- an is_admin() escape hatch so CEODashboard can read all pending rows over
-- the normal authenticated client, self-scoped INSERT that also pins
-- status = 'pending' so nobody can insert a pre-approved row, and NO update
-- or delete policy at all. With RLS on and no matching policy, every
-- client-side UPDATE/DELETE is denied by default; approve/reject runs only
-- through admin-actions on the service role key, which bypasses RLS.
--
-- THREE DELIBERATE DEVIATIONS FROM venue_claims, each flagged rather than
-- silently copied:
--
-- 1. NO equivalent of venue_claims' `unique_venue_claim UNIQUE (venue_id,
--    status)`. That constraint is subtly broken: it permits only one row per
--    (venue, status) pair, so a venue can never have two rejected claims,
--    meaning a second applicant can never be rejected for a venue someone
--    was already rejected for. Copying its shape here as
--    UNIQUE (user_id, status) would be worse: a user could never be
--    rejected twice and could never re-apply after rejection. Replaced with
--    a partial unique index that expresses the actual intent, at most one
--    OPEN application per user, while leaving history unconstrained.
--    (venue_claims' own constraint is a separate pre-existing bug, logged,
--    not touched here.)
--
-- 2. user_id is NOT NULL. venue_claims allows NULL, which permits an
--    orphan claim with no applicant. There is no such thing as a talent
--    application without an applicant, and the RLS INSERT policy already
--    forces user_id = auth.uid() for clients, so this only closes the
--    service-role path.
--
-- 3. gen_random_uuid() rather than venue_claims' uuid_generate_v4(). Both
--    are in use in this DB (posts uses gen_random_uuid()); the former is
--    core Postgres and carries no uuid-ossp extension dependency.
--
-- The user_id FK targets profiles(id), matching venue_claims_user_id_fkey,
-- not auth.users. Safe now that handle_new_user guarantees every auth user
-- has a profiles row.

CREATE TABLE IF NOT EXISTS public.talent_applications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  instagram_handle text,
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

-- At most one open application per user. Rejected/approved history is
-- unconstrained, so a rejected applicant can re-apply later.
CREATE UNIQUE INDEX IF NOT EXISTS talent_applications_one_pending_per_user
ON public.talent_applications (user_id)
WHERE status = 'pending';

-- Admin reads all pending rows; CEODashboard needs this ordering.
CREATE INDEX IF NOT EXISTS talent_applications_status_created_idx
ON public.talent_applications (status, created_at DESC);

ALTER TABLE public.talent_applications ENABLE ROW LEVEL SECURITY;

-- SELECT: an applicant sees only their own applications. Admin sees all,
-- which is what CEODashboard needs (it reads over the normal authenticated
-- client, not the service role).
DROP POLICY IF EXISTS "Applicants read own applications" ON public.talent_applications;
CREATE POLICY "Applicants read own applications"
ON public.talent_applications
FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR public.is_admin());

-- INSERT: a user may only apply as themselves, and only as 'pending'.
-- Without the status predicate an applicant could insert a row pre-set to
-- 'approved' and hand themselves talent status outright.
DROP POLICY IF EXISTS "Applicants create own pending applications" ON public.talent_applications;
CREATE POLICY "Applicants create own pending applications"
ON public.talent_applications
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid() AND status = 'pending');

-- Deliberately NO update or delete policy for `authenticated`, same as
-- venue_claims. Status transitions happen only through admin-actions on the
-- service role key.
