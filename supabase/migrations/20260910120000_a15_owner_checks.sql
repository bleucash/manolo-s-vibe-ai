-- A15. Owner checks on get_unpaid_commissions and check_in_guest, and
-- EXECUTE revoked from anon and PUBLIC on both.
--
-- WHAT A15 IS. Both functions are SECURITY DEFINER, so both bypass RLS on
-- tickets and profiles entirely, and both were EXECUTE-granted to anon,
-- authenticated, authenticator, service_role and PUBLIC. Neither checked the
-- caller at all. get_unpaid_commissions returned promoter names, usernames,
-- ticket counts and unpaid commission totals for ANY venue id, and venue ids
-- are world-readable (backlog A1), so there was nothing to guess.
-- check_in_guest marked a ticket used for anyone holding its QR code. Bodies,
-- attributes and ACLs read live 2026-09-10, and re-verified unchanged by body
-- hash before this file was written.
--
-- OWNER-ONLY IS A PARTIAL IMPLEMENTATION OF THE RULING, NOT THE RULING. The
-- owner ruled that payouts are visible to the venue owner and managers only.
-- The schema cannot represent a manager who does not own the venue (backlog
-- A17), so the only per-venue authority expressible today is
-- venues.owner_id. Closing A17 is what would let this gate follow the ruling;
-- the ruling itself is unchanged. Nor does this migration satisfy the ruling
-- on its own: three tickets policies still let active venue staff read
-- commission_earned and promoter_id directly (recorded in A15). They are
-- deliberately out of scope here.
--
-- A NON-OWNER GETS AN ERROR, NOT AN EMPTY RESULT. Both checks raise SQLSTATE
-- 42501. An empty result from get_unpaid_commissions would render in
-- PayoutsPanel as "All accounts settled", a false statement to someone who
-- simply may not see the data. check_in_guest raises the same code the grant
-- check now returns to a caller with no session, so one client branch can
-- explain both; its json result vocabulary is unchanged (success,
-- already_used, invalid, wrong_venue). The scanner currently shows "Ledger
-- Sync Failure" for any error; a client change to explain 42501 is separate.
--
-- WHY NOT EXISTS, AND NOT AN INEQUALITY. Both checks are written as
-- NOT EXISTS (SELECT 1 FROM public.venues WHERE id = <venue> AND
-- owner_id = auth.uid()). If auth.uid() is NULL, as for a call carrying no
-- user in its token, then owner_id = NULL is NULL, the EXISTS finds no row,
-- NOT EXISTS is TRUE, and the check raises. An inequality test between the
-- owner and auth.uid() evaluates to NULL in that case, and IF treats NULL as
-- false, so it would fail OPEN: it would never raise and the call would go
-- through. The same NOT EXISTS also raises for a venue id that is NULL or
-- does not exist.
--
-- SERVICE_ROLE HOLDS EXECUTE BUT CANNOT PASS EITHER OWNER CHECK. auth.uid()
-- reads the token's user sub (request.jwt.claim.sub, falling back to
-- request.jwt.claims->>'sub'), and a service-role client carries no user sub,
-- so auth.uid() is NULL, the NOT EXISTS finds no row, and the check raises
-- 42501. The grant is retained because it matches the schema default and
-- nothing calls these functions as service_role today, but the grant and the
-- body disagree: anything needing service-role access to this data must
-- query the tables directly, not through these functions.
--
-- DEFECT FOUND AND CLOSED IN THE LINE BEING REWRITTEN. check_in_guest
-- compared ticket_record.venue_id != current_venue_id. When the caller passed
-- a NULL current_venue_id, that comparison is NULL, IF treats NULL as false,
-- the wrong_venue branch was skipped, and the ticket was marked used.
-- tickets.venue_id is NOT NULL (measured), so only the parameter could
-- trigger it, and it meant a QR could be burned without supplying any venue
-- id at all. The comparison is now IS DISTINCT FROM, which treats NULL as a
-- value and is TRUE whenever the two sides differ, including when exactly one
-- is NULL. The owner check below also refuses a NULL venue id before this
-- line is reached, but the comparison is corrected in its own right rather
-- than left relying on that. Found by reading the live body under SQL null
-- semantics, not by executing it.
--
-- ORDER IN check_in_guest. Ownership of current_venue_id, the venue whose
-- door is being scanned, is checked BEFORE the ticket lookup, and the
-- ticket's venue must then match it. Every successful scan therefore still
-- requires owning the ticket's venue; a non-owner is refused before any
-- ticket data is read; and an owner scanning another venue's ticket still
-- gets wrong_venue ("Invalid sector") rather than a permission error. The
-- response shape is deliberately unchanged, including the full ticket row on
-- wrong_venue and already_used; that is logged separately.
--
-- A13 IS CLOSED AS A SIDE EFFECT. A13 recorded both functions as SECURITY
-- DEFINER with no pinned search_path. Both are now pinned. Every relation and
-- auth.uid() is schema-qualified, so the pin changes no resolution in normal
-- use. auth is not on the path, which is why auth.uid() must carry its
-- schema; seven existing SECURITY DEFINER functions pinned to public already
-- call it that way in production. public.venues is the only relation named
-- venues.
--
-- pg_temp IS PINNED LAST. Per the PostgreSQL documentation, a session's
-- temporary schema is searched FIRST for relation and type names unless it is
-- listed in search_path explicitly. A13 recorded as untested whether a
-- caller's temporary object could therefore shadow one of the unqualified
-- type names in get_unpaid_commissions' casts (::TEXT, ::BIGINT, ::NUMERIC).
-- Listing pg_temp last closes that whatever the answer. This differs from the
-- seven existing helpers, which pin public only.
--
-- CREATE OR REPLACE, NEVER DROP THEN CREATE. Measured default privileges: new
-- functions in public receive EXECUTE for anon, authenticated and
-- service_role, and no database-wide default removes the built-in EXECUTE for
-- PUBLIC. The live ACL on both functions,
-- {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres},
-- is exactly what creation produces. A drop and recreate would therefore
-- silently restore the anon and PUBLIC grants this migration revokes, and
-- under a platform re-apply (backlog A16: every migration is re-applied) it
-- would also leave a moment with no function at all. CREATE OR REPLACE keeps
-- the owner and the ACL, which is why both signatures below are identical to
-- today's: CREATE OR REPLACE cannot change argument types, input parameter
-- names, or returned columns. SECURITY DEFINER is restated explicitly on
-- both, because a replace that omits it silently turns the function into
-- SECURITY INVOKER.
--
-- IDEMPOTENT under re-apply. CREATE OR REPLACE re-runs to the same result, a
-- REVOKE of a privilege already absent is a no-op, and the GRANTs to
-- authenticated and service_role re-assert grants they already hold.
-- Signatures do not change, so src/integrations/supabase/types.ts needs no
-- regeneration.
--
-- Parameters are referenced as function_name.parameter inside SQL, so no
-- current or future column of the same name can make a reference ambiguous.

CREATE OR REPLACE FUNCTION public.get_unpaid_commissions(venue_id_input uuid)
 RETURNS TABLE(full_name text, promoter_id uuid, ticket_count bigint, total_unpaid numeric, username text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
BEGIN
  -- Owner check first. NOT EXISTS, so a NULL auth.uid() or a NULL or unknown
  -- venue id raises rather than slipping through (see header).
  IF NOT EXISTS (
    SELECT 1
      FROM public.venues v
     WHERE v.id = get_unpaid_commissions.venue_id_input
       AND v.owner_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not authorized to view payouts for this venue'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    p.full_name::TEXT,
    t.promoter_id,
    COUNT(t.id)::BIGINT as ticket_count,
    SUM(COALESCE(t.commission_earned, 0))::NUMERIC as total_unpaid,
    p.username::TEXT
  FROM public.tickets t
  JOIN public.profiles p ON t.promoter_id = p.id
  WHERE t.venue_id = get_unpaid_commissions.venue_id_input
    AND t.promoter_id IS NOT NULL
    AND t.commission_earned > 0
    -- Exclude tickets that have already been recorded in a payout
    AND NOT EXISTS (
      SELECT 1
      FROM public.payout_history ph
      WHERE ph.promoter_id = t.promoter_id
      AND ph.venue_id = t.venue_id
    )
  GROUP BY p.full_name, t.promoter_id, p.username;
END;
$function$;

CREATE OR REPLACE FUNCTION public.check_in_guest(qr_input text, current_venue_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
  ticket_record RECORD;
BEGIN
  -- Check 0: does the caller own the venue whose door is being scanned?
  -- Before the ticket lookup, so a non-owner reads no ticket data. NOT EXISTS,
  -- so a NULL auth.uid() or a NULL venue id raises (see header).
  IF NOT EXISTS (
    SELECT 1
      FROM public.venues v
     WHERE v.id = check_in_guest.current_venue_id
       AND v.owner_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not authorized to check in guests at this venue'
      USING ERRCODE = '42501';
  END IF;

  -- Find the ticket by QR code
  SELECT * INTO ticket_record
  FROM public.tickets
  WHERE qr_code = check_in_guest.qr_input
  LIMIT 1;

  -- Check 1: Does the ticket exist?
  IF NOT FOUND THEN
    RETURN json_build_object('result', 'invalid');
  END IF;

  -- Check 2: Is the ticket for this venue? IS DISTINCT FROM, not !=, so a
  -- NULL on either side counts as a mismatch (see header).
  IF ticket_record.venue_id IS DISTINCT FROM check_in_guest.current_venue_id THEN
    RETURN json_build_object(
      'result', 'wrong_venue',
      'ticket', row_to_json(ticket_record)
    );
  END IF;

  -- Check 3: Has the ticket already been scanned?
  IF ticket_record.status = 'used' THEN
    RETURN json_build_object(
      'result', 'already_used',
      'ticket', row_to_json(ticket_record)
    );
  END IF;

  -- SUCCESS: Mark ticket as used and set timestamp
  UPDATE public.tickets
  SET
    status = 'used',
    scanned_at = NOW()
  WHERE id = ticket_record.id;

  RETURN json_build_object(
    'result', 'success',
    'ticket', json_build_object(
      'id', ticket_record.id,
      'venue_name', ticket_record.venue_name,
      'event_name', ticket_record.event_name,
      'status', 'used',
      'scanned_at', NOW()
    )
  );
END;
$function$;

-- EXECUTE: remove PUBLIC and anon, keep authenticated and service_role. The
-- GRANT re-asserts what both already hold, so re-applying changes nothing.
REVOKE EXECUTE ON FUNCTION public.get_unpaid_commissions(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_unpaid_commissions(uuid) FROM anon;
GRANT  EXECUTE ON FUNCTION public.get_unpaid_commissions(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.check_in_guest(text, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.check_in_guest(text, uuid) FROM anon;
GRANT  EXECUTE ON FUNCTION public.check_in_guest(text, uuid) TO authenticated, service_role;
