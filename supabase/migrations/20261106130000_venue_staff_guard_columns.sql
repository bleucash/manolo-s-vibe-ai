-- 20261106130000_venue_staff_guard_columns.sql
--
-- Fix 8: bound which venue_staff columns an end user can set or change, so
-- that nobody but the venue owner sets commission_rate, and nobody moves a
-- row to another person or venue.
--
-- Why. authenticated holds INSERT and UPDATE on every venue_staff column (the
-- Supabase default), and the policies bound only some of them:
--   * "Talent request to work a venue" (INSERT) does not constrain
--     commission_rate, and approval changes only status, so a talent's
--     self-chosen rate survived approval.
--   * "Talent respond to their own invitations" (UPDATE) checks user_id and
--     status, so a talent accepting an invite could also set venue_id,
--     commission_rate and staff_role.
--   * "Managers can update staff for their owned venues" (UPDATE) checks only
--     venue_id, so a manager could set user_id to any account, including a
--     guest, skipping the invite path's invitee-must-be-talent check.
-- Column grants cannot fix this: they are per role, and talent and managers
-- are both authenticated.
--
-- commission_rate is numeric, nullable, DEFAULT 10.00. A default of 10 means
-- "10% commission", not "no commission", so a talent-created row gets NULL:
-- the only value that means no rate was set. It is forced, not refused,
-- because Postgres fills the default before a BEFORE trigger runs, so the
-- app's own request (which sends no rate) arrives carrying 10.00.
-- Downstream, NULL reads as 0% in StaffCommissionEditor, which the owner can
-- then set; stripe-webhook computes 0; calculate_ticket_commission falls back
-- to venues.standard_commission (that conflict is fix 7, unchanged here).
-- No pay-gate logic is added; that is product logic review area 3.
--
-- What the app changes (checked 2026-11-06): owners insert invites
-- (InviteTalentModal) and change status, staff_role and commission_rate;
-- talent insert requests (RequestToWorkModal: user, venue, status, staff_role)
-- and change status only; admin-actions changes status as service_role.
-- Nothing changes id, created_at, user_id or venue_id. Nothing here blocks
-- any of that.
--
-- Rules, enforced only when auth.role() is 'authenticated' or 'anon':
--   INSERT: if the caller does not own the venue, commission_rate := NULL.
--   UPDATE: nobody changes id, created_at, user_id or venue_id; the venue's
--           owner may change status, staff_role and commission_rate; anyone
--           else may change status only.
-- service_role (admin-actions) and direct connections (migrations, where
-- auth.role() is NULL) pass through, so no migration trips this guard.
--
-- A refused UPDATE RAISEs 42501, a real error, never a silent zero-row
-- result. Existing rows are not touched (the 2 live rows keep 10.00).
-- Safe to run twice.

CREATE OR REPLACE FUNCTION public.guard_venue_staff_columns()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_is_owner boolean;
BEGIN
  IF coalesce(auth.role(), '') NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    SELECT (owner_id = auth.uid()) INTO v_is_owner
    FROM public.venues WHERE id = NEW.venue_id;
    IF NOT coalesce(v_is_owner, false) THEN
      NEW.commission_rate := NULL;
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.venue_id IS DISTINCT FROM OLD.venue_id THEN
    RAISE EXCEPTION 'venue_staff: id, created_at, user_id and venue_id cannot be changed'
      USING ERRCODE = '42501';
  END IF;

  SELECT (owner_id = auth.uid()) INTO v_is_owner
  FROM public.venues WHERE id = OLD.venue_id;

  IF coalesce(v_is_owner, false) THEN
    RETURN NEW;
  END IF;

  IF NEW.staff_role IS DISTINCT FROM OLD.staff_role
     OR NEW.commission_rate IS DISTINCT FROM OLD.commission_rate THEN
    RAISE EXCEPTION 'venue_staff: only the venue owner can change staff_role or commission_rate'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.guard_venue_staff_columns() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.guard_venue_staff_columns() FROM anon;
REVOKE EXECUTE ON FUNCTION public.guard_venue_staff_columns() FROM authenticated;

DROP TRIGGER IF EXISTS venue_staff_guard_columns ON public.venue_staff;
CREATE TRIGGER venue_staff_guard_columns
  BEFORE INSERT OR UPDATE ON public.venue_staff
  FOR EACH ROW EXECUTE FUNCTION public.guard_venue_staff_columns();

-- POST-CHECK
DO $post$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.venue_staff'::regclass
      AND tgname = 'venue_staff_guard_columns'
      AND tgenabled = 'O'
      AND NOT tgisinternal
      AND (tgtype & 4) <> 0    -- INSERT
      AND (tgtype & 16) <> 0   -- UPDATE
      AND (tgtype & 2) <> 0    -- BEFORE
  ) THEN
    RAISE EXCEPTION 'post-check: venue_staff_guard_columns missing, disabled, or not BEFORE INSERT OR UPDATE';
  END IF;
END
$post$;
