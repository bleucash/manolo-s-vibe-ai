-- Let talent set their own position; keep role_type locked.
--
-- prevent_profile_privilege_escalation guarded both role_type and sub_role.
-- That made sub_role unwritable by its owner: TalentManage's save raised
-- "Not authorized to change sub_role" on every attempt, which is why the
-- column is NULL in every row. It also broke unrelated saves on that form,
-- since the component sent sub_role = '' against a NULL column and
-- '' IS DISTINCT FROM NULL is true.
--
-- Safe now because sub_role is CHECK-constrained to nine values by
-- profiles_sub_role_allowed, none of which confer any capability. It is a
-- label. role_type is the real boundary and stays guarded here.
--
-- INVARIANT, also recorded in CLAUDE.md: sub_role must never gate access. If
-- a position ever needs to control capability, that gate belongs on role_type
-- (guarded by this trigger), on venue_staff (manager-approved), or on its own
-- column. Wiring a capability to sub_role would make it self-assignable, and
-- nothing here would look wrong while it happened.

CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
begin
  if auth.role() = 'service_role' then
    return new;
  end if;
  if new.role_type is distinct from old.role_type then
    raise exception 'Not authorized to change role_type';
  end if;
  return new;
end;
$function$;
