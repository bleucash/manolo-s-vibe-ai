-- 20261107100000_venue_staff_private.sql
--
-- Fix 9 part 2, step 2b: venue_staff becomes private. Applied only after
-- step 2a (venue_roster) is live and the three public readers have been
-- switched to it and checked in the preview; until then they would show
-- empty rosters.
--
-- After this:
--   * the venue owner sees every row at their venues, all columns (the two
--     existing manager policies; consistent with A15, payouts and pay terms
--     visible to the owner and managers only);
--   * a talent sees their own rows, all columns, including their own
--     commission_rate and staff_role ("Talent view own status");
--   * everyone else reads rosters only through venue_roster (venue_id,
--     user_id of active staff).
-- Realtime: the two manager subscriptions (ManagerApprovalPanel,
-- ManagerDashboard) are unfiltered on venue_staff; realtime delivers only
-- rows the subscriber can read, so they now receive their own venues' rows
-- only. Today, under "Public can see active staff", they also receive every
-- other venue's active rows, commission_rate included.
--
-- anon loses every privilege on venue_staff. No policy ever admitted anon
-- (each one keys on auth.uid(), NULL for anon) and no anon caller remains
-- once the public readers use venue_roster, so this only removes a path
-- nothing should use. Safe to run twice; touches no rows.

-- PRE-CHECK: the public roster must exist and be readable by anon first.
DO $pre$
BEGIN
  IF to_regclass('public.venue_roster') IS NULL
     OR NOT has_table_privilege('anon', 'public.venue_roster', 'SELECT') THEN
    RAISE EXCEPTION 'pre-check: public.venue_roster missing or not readable by anon; apply step 2a first';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = 'public.venue_staff'::regclass
                 AND polname = 'Talent view own status' AND polcmd = 'r') THEN
    RAISE EXCEPTION 'pre-check: "Talent view own status" missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = 'public.venue_staff'::regclass
                 AND polname = 'Managers can view staff for their owned venues' AND polcmd = 'r') THEN
    RAISE EXCEPTION 'pre-check: "Managers can view staff for their owned venues" missing';
  END IF;
END
$pre$;

DROP POLICY IF EXISTS "Public can see active staff" ON public.venue_staff;

REVOKE ALL ON public.venue_staff FROM anon;

-- POST-CHECK
DO $post$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = 'public.venue_staff'::regclass
             AND polcmd IN ('r', '*')
             AND polname NOT IN ('Talent view own status',
                                 'Managers can view staff for their owned venues',
                                 'Managers view venue staff')) THEN
    RAISE EXCEPTION 'post-check: an unexpected SELECT policy remains on venue_staff';
  END IF;
  IF has_table_privilege('anon', 'public.venue_staff', 'SELECT')
     OR has_table_privilege('anon', 'public.venue_staff', 'INSERT')
     OR has_table_privilege('anon', 'public.venue_staff', 'UPDATE')
     OR has_table_privilege('anon', 'public.venue_staff', 'DELETE') THEN
    RAISE EXCEPTION 'post-check: anon still holds a privilege on venue_staff';
  END IF;
END
$post$;
