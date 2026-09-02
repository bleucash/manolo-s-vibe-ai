-- Group chat, step 2 of 5: manual groups. Creation, addition, removal.
--
-- Deliberately BEFORE the venue-thread reconciler, which is the larger piece:
-- both produce multi-party threads, but this path has stored membership and no
-- triggers, so it surfaces the three-participant rendering problems while the
-- six-path reconciler is still ahead of us rather than behind.
--
-- Nothing here touches venue threads. kind = 'group' only.

-- ---------------------------------------------------------------------------
-- created_by: WHO MADE THIS GROUP.
--
-- REFERENCES profiles(id), NOT auth.users(id), and the distinction is the
-- whole reason this comment exists. `events.created_by` is the same column
-- name in this same schema and points at auth.users, and CLAUDE.md records the
-- cost: PostgREST cannot embed a profile through it, so CEODashboard fetches
-- creators in a second call keyed on the id. Three FKs here already have that
-- shape (venues.owner_id, events.created_by, profiles.id). This one is
-- deliberately not a fourth.
--
-- ON DELETE SET NULL, chosen against two worse options. CASCADE would destroy
-- a group and every message in it because one person's account went away,
-- punishing the other members for someone else's exit. RESTRICT would block
-- account deletion for a reason nobody would connect to messaging.
--
-- SET NULL leaves an ADMINLESS group: nobody can add or remove, messaging
-- still works. That is a degraded state and it is accepted, because unlike the
-- Tangra orphan it is visible to every member, still functions, and is
-- escapable -- remove_group_member below lets any member remove THEMSELVES,
-- which is what keeps this bounded rather than a trap. Nothing in this app
-- deletes accounts today; this decides the constraint, not a live path.
--
-- No CHECK ties kind = 'group' to created_by IS NOT NULL. SET NULL would
-- violate it later, so this invariant is carried by comment rather than by the
-- database -- weaker than the biconditional on venue_id, and said plainly
-- rather than left looking guarded.
-- ---------------------------------------------------------------------------
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS created_by uuid;

ALTER TABLE public.conversations DROP CONSTRAINT IF EXISTS conversations_created_by_fkey;
ALTER TABLE public.conversations
  ADD CONSTRAINT conversations_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.conversations.created_by IS
  'Manual groups only. NULL on a group means the creator''s account is gone: membership is frozen, messaging still works, and members can still remove themselves. NULL is also normal for dm and venue kinds, which have no creator.';

-- ---------------------------------------------------------------------------
-- THE BOUND, written once.
--
-- "This person is active staff at SOME venue I own." Any venue, not a specific
-- one: a multi-venue manager coordinating across their own venues is a real
-- use case, and mixing staff across owned venues was already accepted.
--
-- Defined as a function rather than inlined twice so creation and
-- addition-after-creation CANNOT DRIFT. If they could, a manager would create
-- a group with one valid member and then add anyone, which makes the bound
-- decorative. Sharing the definition is what makes them identical by
-- construction instead of by review.
--
-- status = 'active' specifically. A pending affiliation is an unapproved
-- request and must not confer group access.
--
-- The two IS NOT NULL predicates are REDUNDANT AND DELIBERATE. venue_staff's
-- user_id and venue_id are both nullable -- one of the six nullable join keys
-- recorded as a category 3 finding in CLAUDE.md. A row with either one NULL
-- already fails this test, because `vs.user_id = _member` is NULL rather than
-- true and the join drops a NULL venue_id. So the behaviour is correct without
-- them; they are here so it is correct ON PURPOSE rather than by accident,
-- which is the difference between a property and a coincidence.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_addable_group_member(_owner uuid, _member uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = public
AS $function$
  SELECT EXISTS (
    SELECT 1
      FROM venue_staff vs
      JOIN venues v ON v.id = vs.venue_id
     WHERE vs.user_id  IS NOT NULL
       AND vs.venue_id IS NOT NULL
       AND vs.user_id = _member
       AND vs.status  = 'active'
       AND v.owner_id = _owner
  );
$function$;

-- ---------------------------------------------------------------------------
-- CREATE.
--
-- The 50 cap is A JUDGMENT CALL, not a derived limit: high enough that no real
-- venue staff roster reaches it, low enough to bound the abuse case when
-- talent creation ships. It lives here from the start rather than being
-- retrofitted, because retrofitting a cap onto live groups means either
-- breaking them or grandfathering a hole.
--
-- Everyone joins ACCEPTED. The request gate is per-person and does not apply
-- inside a group; the membership bound is what makes skipping it safe, since
-- every member already has a manager-approved relationship with the creator.
--
-- ACCEPTED LIMITATION: no idempotency guard. Unlike start_conversation there
-- is no natural uniqueness key for a group, so a double-submitted form makes
-- two groups. Group creation is a deliberate action behind a form rather than
-- a one-tap button, so this is tolerable -- but note there is no group
-- deletion either, so a duplicate is permanent. Both point at the same backlog
-- item (see CLAUDE.md: ownership transfer or group deletion).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_group_conversation(_title text, _member_ids uuid[])
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  v_caller  uuid := auth.uid();
  v_title   text := btrim(coalesce(_title, ''));
  v_members uuid[];
  v_bad     uuid;
  v_total   int;
  v_conv    uuid;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'create_group_conversation requires an authenticated caller'
      USING ERRCODE = '42501';
  END IF;

  IF char_length(v_title) < 1 OR char_length(v_title) > 60 THEN
    RAISE EXCEPTION 'A group needs a name between 1 and 60 characters'
      USING ERRCODE = '22023';
  END IF;

  -- Deduplicate, drop NULLs, and drop the caller: they are added separately
  -- and must not be able to inflate the member count with their own id.
  SELECT array_agg(DISTINCT m) INTO v_members
    FROM unnest(coalesce(_member_ids, '{}'::uuid[])) AS m
   WHERE m IS NOT NULL AND m <> v_caller;
  v_members := coalesce(v_members, '{}'::uuid[]);

  IF array_length(v_members, 1) IS NULL THEN
    RAISE EXCEPTION 'A group needs at least one other member'
      USING ERRCODE = '22023';
  END IF;

  v_total := array_length(v_members, 1) + 1;  -- + the creator
  IF v_total > 50 THEN
    RAISE EXCEPTION 'A group is limited to 50 members, including you (got %)', v_total
      USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM venues WHERE owner_id = v_caller) THEN
    RAISE EXCEPTION 'Only a venue owner can create a group'
      USING ERRCODE = '42501';
  END IF;

  SELECT m INTO v_bad
    FROM unnest(v_members) AS m
   WHERE NOT public.is_addable_group_member(v_caller, m)
   LIMIT 1;

  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'Every member must be active staff at a venue you own'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO conversations (kind, title, created_by)
  VALUES ('group', v_title, v_caller)
  RETURNING id INTO v_conv;

  INSERT INTO conversation_participants (conversation_id, user_id, state)
  SELECT v_conv, u, 'accepted' FROM unnest(v_members || ARRAY[v_caller]) AS u;

  RETURN v_conv;
END;
$function$;

-- ---------------------------------------------------------------------------
-- ADD. Same bound as creation, re-checked at add time via the shared function.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.add_group_member(_conversation_id uuid, _user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  v_caller  uuid := auth.uid();
  v_kind    text;
  v_creator uuid;
  v_total   int;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'add_group_member requires an authenticated caller'
      USING ERRCODE = '42501';
  END IF;

  SELECT kind, created_by INTO v_kind, v_creator
    FROM conversations WHERE id = _conversation_id;

  IF v_kind IS NULL THEN
    RAISE EXCEPTION 'No such conversation' USING ERRCODE = '42501';
  END IF;

  IF v_kind <> 'group' THEN
    RAISE EXCEPTION 'Only a manual group takes members; venue threads derive theirs'
      USING ERRCODE = '22023';
  END IF;

  -- v_creator IS NULL means the creator's account is gone. Comparing against
  -- NULL yields NULL, so this must be an explicit false rather than relying on
  -- the IF, or an adminless group would silently accept anyone.
  IF coalesce(v_caller = v_creator, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'Only the group creator can add members'
      USING ERRCODE = '42501';
  END IF;

  IF NOT public.is_addable_group_member(v_caller, _user_id) THEN
    RAISE EXCEPTION 'That person must be active staff at a venue you own'
      USING ERRCODE = '42501';
  END IF;

  SELECT count(*) INTO v_total
    FROM conversation_participants WHERE conversation_id = _conversation_id;

  IF v_total >= 50 THEN
    RAISE EXCEPTION 'A group is limited to 50 members' USING ERRCODE = '22023';
  END IF;

  INSERT INTO conversation_participants (conversation_id, user_id, state)
  VALUES (_conversation_id, _user_id, 'accepted')
  ON CONFLICT (conversation_id, user_id) DO NOTHING;

  RETURN FOUND;
END;
$function$;

-- ---------------------------------------------------------------------------
-- REMOVE. The creator removes anyone but themselves; anyone removes themselves.
--
-- SELF-REMOVAL IS LOAD-BEARING, not a convenience. It is the escape hatch that
-- makes an adminless group (created_by NULL) bounded rather than a trap, which
-- is the entire argument for choosing SET NULL over CASCADE or RESTRICT. It
-- has to keep working when there is no creator at all.
--
-- Hence coalesce(...) below: with v_creator NULL, `v_caller = v_creator` is
-- NULL, and `NULL OR false` is NULL, which an IF treats as false and would
-- therefore NOT raise -- letting any member remove any other member from an
-- adminless group. Three-valued logic turning a guard into a hole is exactly
-- the shape that hides.
--
-- LIMITATION, deliberate: the creator cannot remove themselves, because doing
-- so would orphan management on purpose rather than by accident. Getting out
-- needs ownership transfer or group deletion; neither is in scope, and both
-- are on the backlog.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.remove_group_member(_conversation_id uuid, _user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  v_caller  uuid := auth.uid();
  v_kind    text;
  v_creator uuid;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'remove_group_member requires an authenticated caller'
      USING ERRCODE = '42501';
  END IF;

  SELECT kind, created_by INTO v_kind, v_creator
    FROM conversations WHERE id = _conversation_id;

  IF v_kind IS NULL THEN
    RAISE EXCEPTION 'No such conversation' USING ERRCODE = '42501';
  END IF;

  IF v_kind <> 'group' THEN
    RAISE EXCEPTION 'Only a manual group has removable members'
      USING ERRCODE = '22023';
  END IF;

  IF coalesce(_user_id = v_creator, false) THEN
    RAISE EXCEPTION 'The group creator cannot be removed'
      USING ERRCODE = '22023';
  END IF;

  IF NOT (coalesce(v_caller = v_creator, false) OR v_caller = _user_id) THEN
    RAISE EXCEPTION 'Only the group creator can remove other members'
      USING ERRCODE = '42501';
  END IF;

  DELETE FROM conversation_participants
   WHERE conversation_id = _conversation_id AND user_id = _user_id;

  RETURN FOUND;
END;
$function$;
