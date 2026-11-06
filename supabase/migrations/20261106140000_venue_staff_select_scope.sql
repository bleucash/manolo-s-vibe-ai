-- 20261106140000_venue_staff_select_scope.sql
--
-- Fix 9, first patch: venue_staff stops being readable in full by anyone.
--
-- Today "Enable read access for all users" (USING true, role public) lets
-- anon and every signed-in user read every venue_staff row: pending requests,
-- declined invites, staff_role and commission_rate included. Being
-- permissive, it also makes the three narrower SELECT policies beside it do
-- nothing (backlog A1).
--
-- After this patch (rows only; columns are a separate choice, see the
-- dispatch report):
--   * anyone, signed in or not, sees ACTIVE rows (the public roster);
--   * a talent sees their own rows at any status ("Talent view own status",
--     unchanged, now in effect);
--   * a venue owner sees every row at their venues (the two existing manager
--     policies, unchanged, now in effect).
-- Pending requests, invites awaiting an answer and declined invites become
-- visible only to that talent and that venue's owner.
--
-- Every reader keeps working with no code change (checked 2026-11-06):
--   public roster, active only: Discovery.tsx:206 (venues embed, filters
--     venue_staff.status = active), Venue.tsx:93, TalentProfile.tsx:65;
--   own rows: Venue.tsx:104, TalentDashboard.tsx:79, and the four tickets
--     policies that key on the caller's own venue_staff row;
--   owner rows: ManagerApprovalPanel.tsx:48, ManagerDashboard.tsx:131,
--     StaffCommissionEditor.tsx:22, InviteTalentModal.tsx:51, and both
--     realtime subscriptions (realtime delivers only rows the subscriber can
--     read);
--   definer functions (enforce_check_in_requires_active_staff,
--     is_addable_group_member, sync_venue_conversation) and service_role
--     callers (admin-actions, stripe-webhook) are unaffected.
-- No venues policy reads venue_staff, so this adds no policy cycle.
--
-- Added before the old policy is dropped, in one transaction. Safe to run
-- twice. Touches no rows.

-- PRE-CHECK: the policies this relies on must be live as read on 2026-11-06.
DO $pre$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = 'public.venue_staff'::regclass
                 AND polname = 'Talent view own status' AND polcmd = 'r'
                 AND pg_get_expr(polqual, polrelid) = '(auth.uid() = user_id)') THEN
    RAISE EXCEPTION 'pre-check: "Talent view own status" missing or changed';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = 'public.venue_staff'::regclass
                 AND polname = 'Managers can view staff for their owned venues' AND polcmd = 'r') THEN
    RAISE EXCEPTION 'pre-check: "Managers can view staff for their owned venues" missing';
  END IF;
END
$pre$;

DROP POLICY IF EXISTS "Public can see active staff" ON public.venue_staff;
CREATE POLICY "Public can see active staff"
  ON public.venue_staff
  FOR SELECT
  TO anon, authenticated
  USING (status = 'active');

DROP POLICY IF EXISTS "Enable read access for all users" ON public.venue_staff;

-- POST-CHECK
DO $post$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = 'public.venue_staff'::regclass
             AND polcmd IN ('r', '*') AND pg_get_expr(polqual, polrelid) = 'true') THEN
    RAISE EXCEPTION 'post-check: a USING (true) SELECT policy remains on venue_staff';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = 'public.venue_staff'::regclass
                 AND polname = 'Public can see active staff') THEN
    RAISE EXCEPTION 'post-check: "Public can see active staff" missing';
  END IF;
END
$post$;
