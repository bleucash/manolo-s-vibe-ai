-- Build 3: check-in requires approved staff status, and talent can leave.
--
-- profiles.current_venue_id was freely self-writable. The only UPDATE policy
-- on profiles is "Users can update own profile" (USING auth.uid() = id, no
-- WITH CHECK, no column restriction), and prevent_profile_privilege_escalation
-- was narrowed in Build 1 to guard role_type only. TalentDashboard's picker
-- does filter to active affiliations, so the client was already correct; the
-- database enforced nothing, and anyone calling the API directly could mark
-- themselves present at any venue.
--
-- A trigger rather than RLS, deliberately:
--   * It keys on the TRANSITION. A WITH CHECK applies to the resulting row on
--     every profile update, so someone removed from a venue while still
--     checked in would find unrelated edits (bio, display name) failing
--     because the row still carried the stale venue.
--   * It RAISEs. RLS denial is a filter, which returns 200 with zero rows
--     affected and no error. That silent-success shape has already caused
--     two bugs in this project; the check-in gate must not add a third.
-- A CHECK constraint cannot be used at all, since it may not query
-- venue_staff.

-- 1. Going active somewhere requires an approved link to that venue.
CREATE OR REPLACE FUNCTION public.enforce_check_in_requires_active_staff()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
begin
  if auth.role() = 'service_role' then
    return new;
  end if;

  -- Untouched value: let every unrelated profile edit through.
  if new.current_venue_id is not distinct from old.current_venue_id then
    return new;
  end if;

  -- Checking out is always allowed, whatever the staff status. Someone
  -- removed from a venue must still be able to clear their own check-in.
  if new.current_venue_id is null then
    return new;
  end if;

  if not exists (
    select 1 from public.venue_staff vs
    where vs.user_id = new.id
      and vs.venue_id = new.current_venue_id
      and vs.status = 'active'
  ) then
    raise exception 'Not approved to go active at this venue';
  end if;

  return new;
end;
$function$;

DROP TRIGGER IF EXISTS profiles_enforce_check_in ON public.profiles;
CREATE TRIGGER profiles_enforce_check_in
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_check_in_requires_active_staff();

-- 2. Losing the link clears the check-in.
--
-- Nothing did this before, so a manager removing talent left the profile
-- pointing at that venue: still on the Active Nodes feed, still on Discovery,
-- still shown on the public profile as being there, and CreatePostDialog
-- would keep auto-tagging posts to it.
--
-- One trigger covers manager removal, talent leave and talent withdraw,
-- because all three are a DELETE on venue_staff. The UPDATE branch covers a
-- row leaving 'active' by any other route.
--
-- Clears all three check-in columns together, matching what checking out
-- writes: is_active true with a null venue would be a state no surface knows
-- how to render.
CREATE OR REPLACE FUNCTION public.clear_check_in_on_staff_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
begin
  if tg_op = 'DELETE' then
    update public.profiles
      set current_venue_id = null, is_active = false, active_at = null
      where id = old.user_id and current_venue_id = old.venue_id;
    return old;
  end if;

  if old.status = 'active' and new.status is distinct from 'active' then
    update public.profiles
      set current_venue_id = null, is_active = false, active_at = null
      where id = new.user_id and current_venue_id = new.venue_id;
  end if;

  return new;
end;
$function$;

DROP TRIGGER IF EXISTS venue_staff_clear_check_in ON public.venue_staff;
CREATE TRIGGER venue_staff_clear_check_in
  AFTER UPDATE OR DELETE ON public.venue_staff
  FOR EACH ROW EXECUTE FUNCTION public.clear_check_in_on_staff_change();

-- 3. Talent can remove their own link: withdraw a pending request, or leave a
--    venue they were approved at. Both are the same DELETE, since
--    unique_venue_user_connection is UNIQUE (venue_id, user_id) and rejection
--    already deletes rather than writing a terminal status.
--
--    Deliberately not restricted by status. That same unique constraint means
--    a stranded row of ANY status permanently blocks a future relationship
--    with that venue, so a talent left holding an 'ignored' row after
--    declining an invite could never be re-invited. auth.uid() = user_id
--    only ever exposes their own row.
DROP POLICY IF EXISTS "Talent remove their own venue link" ON public.venue_staff;

CREATE POLICY "Talent remove their own venue link"
  ON public.venue_staff
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
