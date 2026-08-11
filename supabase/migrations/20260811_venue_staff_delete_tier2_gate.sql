-- Closes an approve/reject asymmetry found while building the Tier 2 blocked
-- states (part b of the filing UI).
--
-- ManagerApprovalPanel has two paths: approve writes venue_staff.status via
-- UPDATE, reject removes the row via DELETE. The Tier 2 migration
-- (20260809_tier2_business_verification.sql) gated the UPDATE policy on
-- business_verified but left the DELETE policy scoped to ownership only. Net
-- effect on an unverified venue: approve is refused by the database, reject
-- succeeds. Same button pair, same panel, opposite outcomes.
--
-- Disabling the buttons in the UI is not a substitute. RLS is the boundary;
-- the UI is not. A direct API call could still delete staff rows for an
-- unverified venue.
--
-- Blast radius: zero. venue_staff holds 2 rows, both status 'active', and no
-- venue is business_verified yet, so nothing currently relies on this DELETE
-- succeeding.

DROP POLICY IF EXISTS "Managers can delete staff for their owned venues" ON public.venue_staff;

CREATE POLICY "Managers can delete staff for their owned venues"
ON public.venue_staff
FOR DELETE
TO authenticated
USING (
  venue_id IN (SELECT id FROM public.venues WHERE owner_id = auth.uid() AND business_verified)
);
