-- "Venue managers can view venue followers" on venue_followers can never
-- match, for two independent reasons. Confirmed live 2026-08-09.
--
-- Current predicate:
--   EXISTS (SELECT 1 FROM venue_staff
--           WHERE venue_staff.venue_id = venue_followers.venue_id
--             AND venue_staff.user_id = auth.uid()
--             AND venue_staff.status = 'approved')
--
-- 1. `venue_staff.status = 'approved'` is a value nothing ever writes. Live
--    data holds exactly one distinct value, 'active' (2 rows).
--    ManagerApprovalPanel writes 'active', TalentDashboard writes
--    'active'/'ignored'. 'approved' appears nowhere outside this policy.
-- 2. It keys off venue_staff membership rather than venues.owner_id. Every
--    other manager-scoped policy in this schema uses ownership. An owner who
--    has no venue_staff row of their own sees nothing regardless of status.
--
-- Replaced with the ownership predicate used everywhere else. Note this is
-- the actual mechanism behind the CLAUDE.md line that described a
-- "venue_followers status mismatch": venue_followers has no status column at
-- all, the dependency was on venue_staff's.
--
-- Nothing else on this table is touched. The other five policies are correct:
-- INSERT and DELETE are already self-scoped to auth.uid() = follower_id, and
-- SELECT already allows public read plus own-rows read.

DROP POLICY IF EXISTS "Venue managers can view venue followers" ON public.venue_followers;

CREATE POLICY "Venue managers can view venue followers"
ON public.venue_followers
FOR SELECT
TO authenticated
USING (
  venue_id IN (SELECT id FROM public.venues WHERE owner_id = auth.uid())
);
