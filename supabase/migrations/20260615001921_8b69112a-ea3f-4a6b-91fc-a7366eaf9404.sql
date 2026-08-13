-- 1. Profiles: prevent users from changing privileged columns unless service_role
CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NEW.role_type IS DISTINCT FROM OLD.role_type THEN
    RAISE EXCEPTION 'Not authorized to change role_type';
  END IF;
  IF NEW.is_verified_talent IS DISTINCT FROM OLD.is_verified_talent THEN
    RAISE EXCEPTION 'Not authorized to change is_verified_talent';
  END IF;
  IF NEW.is_verified_manager IS DISTINCT FROM OLD.is_verified_manager THEN
    RAISE EXCEPTION 'Not authorized to change is_verified_manager';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_prevent_privilege_escalation ON public.profiles;
CREATE TRIGGER profiles_prevent_privilege_escalation
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_privilege_escalation();

-- 2. Venues: prevent owner_id changes unless service_role
CREATE OR REPLACE FUNCTION public.prevent_venue_owner_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Allow initial claim (NULL -> self) via existing RLS policy, but never reassignment between users
  IF OLD.owner_id IS NOT NULL AND NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN
    RAISE EXCEPTION 'Not authorized to change venue owner_id';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS venues_prevent_owner_change ON public.venues;
CREATE TRIGGER venues_prevent_owner_change
BEFORE UPDATE ON public.venues
FOR EACH ROW EXECUTE FUNCTION public.prevent_venue_owner_change();

-- 3. Tickets: user-self SELECT policy already exists ("Users can view their own tickets"
--    and "Users see own tickets"). No change required. No existing restrictive policies dropped.