-- A46, database half: an owned venue never moves straight to another owner.
--
-- venues.owner_id may change only through NULL: unowned -> owner (claim
-- approval) and owner -> unowned (revoke). A direct owner -> different owner
-- write is refused for every caller, service role included, so moving a venue
-- between accounts takes an explicit revoke followed by an approval.
--
-- Before this, the guard returned early for service role, so admin-actions'
-- approve_venue_claim could overwrite an existing owner. What stopped that in
-- practice was an accident of A7 (UNIQUE (venue_id, status) on venue_claims),
-- not a rule. This check is placed BEFORE the service-role early return on
-- purpose; the post-check below fails the migration if that order is lost.
--
-- Same value is not a change: owner -> same owner passes, which is what lets
-- admin-actions retry an approval that already set the owner.
--
-- Everything after the new check is the previous body, unchanged: for every
-- other caller an owned venue's owner_id cannot change at all, and RLS
-- ("Managers can update their own venue") keeps ordinary users off unowned
-- venues. Direct connections (migrations, psql) see auth.role() as NULL, so
-- they were already held by that second check and still are.
--
-- Safe to re-apply (A16): CREATE OR REPLACE keeps the owner, grants and the
-- trigger binding, and the post-check is read-only.

CREATE OR REPLACE FUNCTION public.prevent_venue_owner_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- A46: refused for every caller, so it must stay above the early return.
  IF OLD.owner_id IS NOT NULL AND NEW.owner_id IS NOT NULL
     AND NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN
    RAISE EXCEPTION 'venue % already has an owner; revoke it before approving another claim', OLD.id;
  END IF;

  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Allow initial claim (NULL -> self) via existing RLS policy, but never reassignment between users
  IF OLD.owner_id IS NOT NULL AND NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN
    RAISE EXCEPTION 'Not authorized to change venue owner_id';
  END IF;

  RETURN NEW;
END;
$function$;

-- POST-CHECK
DO $post$
DECLARE
  v_src    text;
  v_def    boolean;
  v_cfg    text[];
  v_owner  text;
  v_a46    int;
  v_early  int;
  v_trig   int;
BEGIN
  SELECT prosrc, prosecdef, proconfig, pg_get_userbyid(proowner)
    INTO v_src, v_def, v_cfg, v_owner
    FROM pg_proc WHERE oid = 'public.prevent_venue_owner_change()'::regprocedure;

  v_a46   := position('AND NEW.owner_id IS NOT NULL' IN v_src);
  v_early := position('IF auth.role() = ''service_role'' THEN' IN v_src);
  IF v_a46 = 0 OR v_early = 0 OR v_a46 > v_early THEN
    RAISE EXCEPTION 'A46: owner-to-owner check missing or not above the service-role return (a46 at %, early return at %)', v_a46, v_early;
  END IF;
  IF NOT v_def OR v_owner <> 'postgres' OR v_cfg IS DISTINCT FROM ARRAY['search_path=public'] THEN
    RAISE EXCEPTION 'A46: guard lost its definer, owner or search_path (definer %, owner %, config %)', v_def, v_owner, v_cfg;
  END IF;

  SELECT count(*) INTO v_trig FROM pg_trigger t
   WHERE t.tgrelid = 'public.venues'::regclass AND t.tgname = 'venues_prevent_owner_change'
     AND t.tgfoid = 'public.prevent_venue_owner_change()'::regprocedure
     AND t.tgenabled = 'O' AND NOT t.tgisinternal;
  IF v_trig <> 1 THEN
    RAISE EXCEPTION 'A46: venues_prevent_owner_change is missing, disabled or bound elsewhere';
  END IF;
END
$post$;
