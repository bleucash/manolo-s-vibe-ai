-- Build 4: managers invite talent. The reverse of Build 2.
--
-- Build 2's INSERT policy is scoped to auth.uid() = user_id AND status =
-- 'pending' AND has_role_type(auth.uid(),'talent'), which by design excludes
-- a manager creating a row for somebody else. This adds the other direction.
-- RLS policies are permissive and OR together, so each still enforces its own
-- status: neither can be used to reach the other's shape.
--
-- All three clauses are load-bearing:
--
--   status = 'pending_talent_action'
--     Pins the invite to "awaiting the talent". Without it a manager could
--     insert a row already 'active' and put someone on staff who never
--     agreed, which is the mirror image of the self-approval hole Build 2
--     closed on the talent side.
--
--   venue_id IN (owned AND business_verified)
--     Ownership is the security boundary: without it a manager could invite
--     into a venue that is not theirs. business_verified matches the existing
--     manager UPDATE/DELETE policies, so invites are gated exactly like
--     approvals rather than opening a side door around Tier 2.
--
--   has_role_type(user_id, 'talent')
--     Note user_id, NOT auth.uid(). The check is on the INVITEE, not the
--     caller. Without it a manager could create venue_staff rows for guests
--     or for other managers, conscripting accounts that never asked to be
--     staff anywhere.
--
-- Deliberately no UPDATE policy is added. Re-inviting somebody who declined
-- moves their existing 'ignored' row back to 'pending_talent_action', which
-- the existing "Managers can update staff for their owned venues" policy
-- already permits. unique_venue_user_connection is UNIQUE (venue_id, user_id),
-- so a declined row persists and would otherwise block re-invitation forever.

DROP POLICY IF EXISTS "Managers invite talent to their venue" ON public.venue_staff;

CREATE POLICY "Managers invite talent to their venue"
  ON public.venue_staff
  FOR INSERT
  TO authenticated
  WITH CHECK (
    status = 'pending_talent_action'
    AND venue_id IN (
      SELECT id FROM public.venues
      WHERE owner_id = auth.uid() AND business_verified
    )
    AND public.has_role_type(user_id, 'talent')
  );
