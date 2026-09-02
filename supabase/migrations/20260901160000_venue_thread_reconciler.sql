-- Group chat, step 3 of 5: venue threads and the reconciler that maintains them.
--
-- Membership is DERIVED, never stored and never hand-edited:
--     venues.owner_id  UNION  venue_staff WHERE status = 'active'
--
-- 'active' specifically. A pending affiliation is an unapproved request and
-- must not confer access to a venue's staff channel.
--
-- SIX PATHS change that set: approve, invite-accept, talent leave, manager
-- removal, the revoke downgrade, and venues.owner_id changing. A row-level
-- trigger covers all six because triggers fire for EVERY writer including
-- service-role edge functions, unlike RLS which service_role bypasses.
-- venue_staff_clear_check_in is the standing proof of that property on this
-- exact table.
--
-- WHY A WHOLE-SET RECONCILER rather than incremental add/remove in the
-- trigger: a missed event self-heals on the next event for that venue, the
-- same function repairs drift after any migration that does DISABLE TRIGGER,
-- and an audit can compare desired against actual without duplicating the
-- logic. Incremental patching has none of those -- one miss is permanent and
-- invisible, which is this project's most expensive failure shape.

-- ---------------------------------------------------------------------------
-- THE RECONCILER.
--
-- Idempotent and caller-agnostic ON PURPOSE. revoke_venue_claim fires this
-- twice -- once after downgrading staff, once after nulling owner_id, an
-- ordering that is deliberate and documented. That is fine and must stay
-- fine: a reconciler that knows about its callers is one that rots.
--
-- ZERO PARTICIPANTS IS A VALID STATE, NOT DRIFT. After a revoke a venue has
-- no owner and no active staff, so the desired set is empty and the thread is
-- left dormant with its history intact. It is reachable by venue_id and
-- revives when an owner returns. This is NOT the Tangra orphan shape: that row
-- was unreachable and unmanageable. A future audit query looking for
-- corruption must not treat an empty venue thread as something to "fix" by
-- deleting message history.
--
-- BACKFILL TRAP, and the two facts are only dangerous together: this function
-- never writes venues.owner_id, so its initial run is safe. But
-- prevent_venue_owner_change keys on auth.role(), which is NULL on a direct
-- connection, so ANY FUTURE MIGRATION that writes owner_id must wrap itself in
-- ALTER TABLE venues DISABLE TRIGGER / ENABLE TRIGGER. Doing so is itself the
-- drift scenario this reconciler exists to survive -- run it afterwards.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_venue_conversation(_venue_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  v_conv    uuid;
  v_desired uuid[];
BEGIN
  -- venue_staff.venue_id is nullable (a category 3 finding in CLAUDE.md), so a
  -- NULL can reach this from the trigger. Explicit no-op rather than an
  -- accidental one.
  IF _venue_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT coalesce(array_agg(DISTINCT uid), '{}'::uuid[]) INTO v_desired
    FROM (
      SELECT v.owner_id AS uid
        FROM venues v
       WHERE v.id = _venue_id AND v.owner_id IS NOT NULL
      UNION
      SELECT vs.user_id
        FROM venue_staff vs
       WHERE vs.venue_id = _venue_id
         AND vs.status = 'active'
         AND vs.user_id IS NOT NULL   -- nullable join key, dropped on purpose
    ) s;

  SELECT id INTO v_conv
    FROM conversations WHERE kind = 'venue' AND venue_id = _venue_id;

  IF v_conv IS NULL THEN
    -- LAZY CREATION, on first ACTIVE AFFILIATION rather than on ownership
    -- alone. A venue with an owner and no staff has nothing to coordinate, and
    -- a solo thread would be furniture in every manager's inbox.
    IF NOT EXISTS (
      SELECT 1 FROM venue_staff
       WHERE venue_id = _venue_id AND status = 'active' AND user_id IS NOT NULL
    ) THEN
      RETURN NULL;
    END IF;

    -- ON CONFLICT against the partial unique index makes two concurrent
    -- approvals impossible to race into two threads, rather than merely
    -- unlikely. DO NOTHING returns no row, hence the re-select.
    INSERT INTO conversations (kind, venue_id)
    VALUES ('venue', _venue_id)
    ON CONFLICT (venue_id) WHERE kind = 'venue' DO NOTHING
    RETURNING id INTO v_conv;

    IF v_conv IS NULL THEN
      SELECT id INTO v_conv
        FROM conversations WHERE kind = 'venue' AND venue_id = _venue_id;
    END IF;
  END IF;

  -- Add anyone missing. DO UPDATE rather than DO NOTHING so the reconciler
  -- repairs state drift too, but guarded so a converged row is not rewritten
  -- -- which is what makes the second consecutive call change zero rows.
  --
  -- A venue member cannot legitimately be anything but 'accepted': they start
  -- accepted, and the request-state policy only permits leaving 'pending'.
  INSERT INTO conversation_participants (conversation_id, user_id, state)
  SELECT v_conv, u, 'accepted' FROM unnest(v_desired) AS u
  ON CONFLICT (conversation_id, user_id) DO UPDATE
    SET state = 'accepted'
    WHERE conversation_participants.state <> 'accepted';

  -- Remove anyone no longer in the derived set.
  DELETE FROM conversation_participants cp
   WHERE cp.conversation_id = v_conv
     AND NOT (cp.user_id = ANY (v_desired));

  RETURN v_conv;
END;
$function$;

COMMENT ON FUNCTION public.sync_venue_conversation(uuid) IS
  'Whole-set reconciler for a venue staff thread. Membership = owner UNION active staff. Idempotent and caller-agnostic; safe to run standalone to repair drift after a DISABLE TRIGGER migration. A zero-participant venue thread is a valid dormant state, not corruption.';

-- ---------------------------------------------------------------------------
-- TRIGGER 1: venue_staff. Covers five of the six paths.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.venue_staff_sync_conversation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.sync_venue_conversation(OLD.venue_id);
    RETURN OLD;
  END IF;

  -- An UPDATE can in principle move a row between venues, which changes two
  -- member sets. Reconcile the one it left as well as the one it joined.
  IF TG_OP = 'UPDATE' AND OLD.venue_id IS DISTINCT FROM NEW.venue_id THEN
    PERFORM public.sync_venue_conversation(OLD.venue_id);
  END IF;

  PERFORM public.sync_venue_conversation(NEW.venue_id);
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS venue_staff_sync_conversation ON public.venue_staff;
CREATE TRIGGER venue_staff_sync_conversation
  AFTER INSERT OR UPDATE OR DELETE ON public.venue_staff
  FOR EACH ROW EXECUTE FUNCTION public.venue_staff_sync_conversation();

-- ---------------------------------------------------------------------------
-- TRIGGER 2: venues.owner_id. The sixth path, and the one that is not on
-- venue_staff at all.
--
-- prevent_venue_owner_change is more permissive than its name: it allows
-- NULL -> self for the initial claim, and returns early for service_role, so
-- BOTH admin-actions writes (approve sets owner_id, revoke nulls it) bypass it
-- entirely. Three doors, not one -- which is exactly why this trigger keys on
-- the column rather than on any assumption about who may change it.
--
-- UPDATE OF owner_id plus the WHEN clause so ordinary venue edits (name,
-- is_active, pricing) do not fire a reconcile for nothing.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.venues_sync_conversation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
BEGIN
  PERFORM public.sync_venue_conversation(NEW.id);
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS venues_sync_conversation ON public.venues;
CREATE TRIGGER venues_sync_conversation
  AFTER UPDATE OF owner_id ON public.venues
  FOR EACH ROW
  WHEN (OLD.owner_id IS DISTINCT FROM NEW.owner_id)
  EXECUTE FUNCTION public.venues_sync_conversation();

-- ---------------------------------------------------------------------------
-- BACKFILL. Idempotent by the reconciler's own nature, so a platform re-run
-- converges rather than duplicating. Creates a thread only for venues that
-- already have at least one ACTIVE affiliation.
-- ---------------------------------------------------------------------------
DO $backfill$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.venues LOOP
    PERFORM public.sync_venue_conversation(r.id);
  END LOOP;
END
$backfill$;
