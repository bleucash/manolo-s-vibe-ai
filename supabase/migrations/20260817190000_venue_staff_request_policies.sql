-- Build 2: let talent request work at a venue, and close the hole that
-- opens up the moment they can.
--
-- venue_staff had NO INSERT policy at all, for any role, which is why the
-- manager approval panel never received anything. Adding one is the point of
-- this build. But two permissive UPDATE policies already existed:
--
--   "Allow talent to accept invitations"              auth.uid() = user_id
--   "Enable updates for users assigned to connection" auth.uid() = user_id
--
-- Exact duplicates, and neither constrained which columns or which status
-- values. Once talent can insert a 'pending' row they could immediately
-- update it to 'active' themselves, making manager approval advisory. Both
-- are replaced by one policy that permits only the transition the invite
-- flow actually needs.

-- 1. status is free text today and this build starts depending on exact
--    values. Allowed set is what the code actually reads or writes:
--      pending               talent requested, awaiting manager (this build)
--      pending_talent_action manager invited, awaiting talent (Build 4;
--                            already read by ManagerApprovalPanel and
--                            TalentDashboard)
--      active                confirmed both ways
--      ignored               talent declined an invite (TalentDashboard)
--    'rejected' is deliberately NOT allowed: the panel deletes the row
--    instead of writing that value, so permitting it would invite a second,
--    divergent representation of the same outcome.
--    Live data holds only 'active', so nothing needs migrating.
ALTER TABLE public.venue_staff
  DROP CONSTRAINT IF EXISTS venue_staff_status_allowed;

ALTER TABLE public.venue_staff
  ADD CONSTRAINT venue_staff_status_allowed CHECK (
    status IS NULL OR status IN ('pending', 'pending_talent_action', 'active', 'ignored')
  );

-- 2. Talent may create their own request, pending only, and only if they
--    actually hold the talent role. Enforced here rather than only in the UI,
--    so a guest or manager cannot request talent work by calling the API
--    directly. has_role_type is SECURITY DEFINER with a pinned search_path,
--    which avoids recursing into profiles' own RLS.
DROP POLICY IF EXISTS "Talent request to work a venue" ON public.venue_staff;

CREATE POLICY "Talent request to work a venue"
  ON public.venue_staff
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND status = 'pending'
    AND public.has_role_type(auth.uid(), 'talent')
  );

-- 3. Replace the two blanket UPDATE policies with one narrow one.
--    USING restricts which rows can be touched: only the talent's own row,
--    and only while it is awaiting THEIR action. A 'pending' row, which is
--    awaiting the MANAGER, is not selectable here, so self-approval is
--    impossible rather than merely discouraged.
--    WITH CHECK restricts the result: accept ('active') or decline
--    ('ignored'), matching TalentDashboard's two buttons.
DROP POLICY IF EXISTS "Allow talent to accept invitations" ON public.venue_staff;
DROP POLICY IF EXISTS "Enable updates for users assigned to connection" ON public.venue_staff;
DROP POLICY IF EXISTS "Talent respond to their own invitations" ON public.venue_staff;

CREATE POLICY "Talent respond to their own invitations"
  ON public.venue_staff
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id AND status = 'pending_talent_action')
  WITH CHECK (auth.uid() = user_id AND status IN ('active', 'ignored'));

-- Manager UPDATE/DELETE policies are deliberately untouched. Their
-- business_verified requirement is a business gate, not an oversight; the
-- silent-success problem it caused is fixed in the client instead, by
-- checking rows affected rather than assuming the write landed.
