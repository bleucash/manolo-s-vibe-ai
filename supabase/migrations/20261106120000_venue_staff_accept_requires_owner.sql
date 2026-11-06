-- 20261106120000_venue_staff_accept_requires_owner.sql
--
-- A talent may accept a staff invite only while the venue has an owner.
--
-- Why. revoke_venue_claim downgrades 'active' staff to 'pending' and then
-- releases the venue, but leaves 'pending_talent_action' invites in place.
-- The live policy "Talent respond to their own invitations" checks only that
-- the row is the caller's and that the new status is 'active' or 'ignored',
-- so a talent could accept such an invite after the revoke and become active
-- at a venue with no owner: the state CLAUDE.md says must never exist, and
-- one that still grants tap-in (profiles_enforce_check_in asks only for
-- status = 'active'). Live at the time of writing: 0 open invites anywhere,
-- 0 active affiliations at ownerless venues.
--
-- Based on the LIVE policy (pg_policy, read 2026-11-06), not on
-- 20260817190000, which created it. USING is unchanged. WITH CHECK keeps both
-- outcomes, but 'active' now also requires an owned venue. Declining
-- ('ignored') stays allowed at any venue: it confers nothing.
--
-- The ownership test goes through a SECURITY DEFINER helper rather than a
-- subquery on venues, for the same reason posts INSERT uses has_role_type: a
-- policy subquery runs with the caller's rights, so tightening venues SELECT
-- later would silently make every acceptance fail.
--
-- A WITH CHECK failure raises 42501 ("new row violates row-level security
-- policy"); it is not a silent zero-row result.
--
-- Safe to run twice: CREATE OR REPLACE, REVOKE/GRANT, DROP POLICY IF EXISTS
-- then CREATE POLICY, inside the migration's transaction. Touches no rows.

-- PRE-CHECK: the live policy must be the one this was written against (or
-- this migration's own result, on a re-run). Anything else means drift: stop.
DO $pre$
DECLARE
  v_using text;
  v_check text;
BEGIN
  SELECT pg_get_expr(polqual, polrelid), pg_get_expr(polwithcheck, polrelid)
    INTO v_using, v_check
  FROM pg_policy
  WHERE polrelid = 'public.venue_staff'::regclass
    AND polname = 'Talent respond to their own invitations'
    AND polcmd = 'w';

  IF v_using IS NULL THEN
    RAISE EXCEPTION 'pre-check: policy "Talent respond to their own invitations" not found';
  END IF;
  IF v_using <> '((auth.uid() = user_id) AND (status = ''pending_talent_action''::text))' THEN
    RAISE EXCEPTION 'pre-check: unexpected USING: %', v_using;
  END IF;
  IF v_check <> '((auth.uid() = user_id) AND (status = ANY (ARRAY[''active''::text, ''ignored''::text])))'
     AND v_check NOT LIKE '%venue_has_owner%' THEN
    RAISE EXCEPTION 'pre-check: unexpected WITH CHECK: %', v_check;
  END IF;
END
$pre$;

CREATE OR REPLACE FUNCTION public.venue_has_owner(p_venue_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.venues
    WHERE id = p_venue_id AND owner_id IS NOT NULL
  );
$function$;

REVOKE EXECUTE ON FUNCTION public.venue_has_owner(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.venue_has_owner(uuid) FROM anon;
GRANT  EXECUTE ON FUNCTION public.venue_has_owner(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Talent respond to their own invitations" ON public.venue_staff;

CREATE POLICY "Talent respond to their own invitations"
  ON public.venue_staff
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id AND status = 'pending_talent_action')
  WITH CHECK (
    auth.uid() = user_id
    AND (
      status = 'ignored'
      OR (status = 'active' AND public.venue_has_owner(venue_id))
    )
  );

-- POST-CHECK
DO $post$
DECLARE
  v_n     int;
  v_check text;
  v_roles text;
BEGIN
  SELECT count(*), max(pg_get_expr(polwithcheck, polrelid)),
         max((SELECT string_agg(rolname, ',') FROM pg_roles WHERE oid = ANY (polroles)))
    INTO v_n, v_check, v_roles
  FROM pg_policy
  WHERE polrelid = 'public.venue_staff'::regclass
    AND polname = 'Talent respond to their own invitations';

  IF v_n <> 1 THEN RAISE EXCEPTION 'post-check: expected 1 policy, found %', v_n; END IF;
  IF v_check NOT LIKE '%venue_has_owner(venue_id)%' THEN
    RAISE EXCEPTION 'post-check: WITH CHECK lacks the owner test: %', v_check;
  END IF;
  IF v_roles <> 'authenticated' THEN RAISE EXCEPTION 'post-check: roles are %', v_roles; END IF;
  IF has_function_privilege('anon', 'public.venue_has_owner(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'post-check: anon can execute venue_has_owner';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.venue_has_owner(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'post-check: authenticated cannot execute venue_has_owner';
  END IF;
END
$post$;
