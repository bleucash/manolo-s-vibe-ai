-- A33 enforcement half: a talent account cannot file a venue claim.
--
-- One account holds exactly one role, permanently (CLAUDE.md). Talent was
-- already kept away from both claim entry points in the UI (ec52ce5) and from
-- approval in admin-actions (findRoleConflict, 409), but the INSERT policy
-- itself checked only user_id and status, so a talent account could still file
-- a claim with a direct API call. This puts the role check at the database,
-- the same shape as the venue_staff "Talent request to work a venue" policy.
--
-- The rule is "not talent" rather than "guest or manager" on purpose: a
-- manager adding another venue is the same track and stays allowed, and both
-- existing gates (src/lib/roleClaims.ts, findRoleConflict in admin-actions)
-- treat talent as the only conflicting role. has_role_type is SECURITY
-- DEFINER, owned by postgres, search_path pinned, so the check does not depend
-- on profiles RLS.
--
-- A rejected INSERT raises 42501. It is not a silent zero-row result.
--
-- Safe to re-apply (A16): DROP IF EXISTS then CREATE, then a post-check that
-- fails the migration if the talent clause is missing or a second
-- INSERT-capable policy exists (permissive policies OR together, so a sibling
-- would make this one inert).

DROP POLICY IF EXISTS "Claimants create own pending claims" ON public.venue_claims;

CREATE POLICY "Claimants create own pending claims" ON public.venue_claims
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND status = 'pending'
    AND NOT has_role_type(auth.uid(), 'talent')
  );

DO $post$
DECLARE
  v_n     int;
  v_check text;
BEGIN
  SELECT count(*) INTO v_n FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'venue_claims' AND cmd IN ('INSERT', 'ALL');
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'A33: expected exactly one INSERT-capable policy on venue_claims, found %', v_n;
  END IF;

  SELECT with_check INTO v_check FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'venue_claims'
     AND policyname = 'Claimants create own pending claims';
  IF v_check IS NULL OR position('has_role_type(auth.uid(), ''talent''::text)' IN v_check) = 0 THEN
    RAISE EXCEPTION 'A33: talent check missing from venue_claims INSERT policy: %', v_check;
  END IF;
END
$post$;
