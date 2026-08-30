-- Repairs public.start_conversation, which has never successfully run for a
-- guest or manager. Four defects, each verified against production before this
-- was written, not inferred from the migration history:
--
--   1. It queried public.follows. No such table exists (to_regclass returns
--      NULL); the real table is public.followers, with identical column names,
--      so only the relation was wrong. Every non-talent caller raised 42P01
--      before reaching the insert. Postgres does not check a plpgsql body
--      against the schema at CREATE time, so this shipped and stayed invisible.
--   2. The exempt-role list was ('talent','venue_manager'). venue_manager is
--      dead enum cruft with zero rows; the single row using it was remapped to
--      'manager' by 20260802203411. So the one real manager fell through to
--      the follower lookup and hit defect 1 as well.
--   3. SECURITY DEFINER with no pinned search_path, unlike has_role_type and
--      is_conversation_participant.
--   4. It created a conversation unconditionally. conversation_participants'
--      PK (conversation_id, user_id) prevents a duplicate participant but not
--      a duplicate thread, so a twice-pressed Message button produced two
--      threads for one pair, which conversation_summary then renders twice.
--
-- The velvet-rope POLICY is deliberately unchanged: still a hard reject, not
-- the request queue CLAUDE.md describes. That queue is its own feature and does
-- not belong inside a repair. Only the message and the broken lookup change.

-- Required by the idempotency lookup below, which filters on user_id. The only
-- existing index is the PK, leading on conversation_id, so that filter is a
-- sequential scan. Safe to add now: the table has zero rows.
CREATE INDEX IF NOT EXISTS idx_conversation_participants_user
    ON public.conversation_participants (user_id);

CREATE OR REPLACE FUNCTION public.start_conversation(target_user_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
    v_caller  uuid := auth.uid();
    v_role    text;
    v_conv_id uuid;
BEGIN
    -- auth.uid() is NULL outside PostgREST: migrations, psql, service-role
    -- connections. Failing loudly beats creating a conversation belonging to
    -- nobody, which is precisely the orphan shape being repaired here.
    IF v_caller IS NULL THEN
        RAISE EXCEPTION 'start_conversation requires an authenticated caller'
            USING ERRCODE = '42501';
    END IF;

    IF target_user_id IS NULL OR target_user_id = v_caller THEN
        RAISE EXCEPTION 'You cannot start a conversation with yourself'
            USING ERRCODE = '22023';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = target_user_id) THEN
        RAISE EXCEPTION 'That user no longer exists'
            USING ERRCODE = '22023';
    END IF;

    -- Serialize on the unordered pair for the life of this transaction, so two
    -- near-simultaneous presses cannot both miss the lookup below and both
    -- insert. Ordering the pair makes both directions take the same lock. The
    -- lookup alone is not enough: it is a read, and two concurrent reads both
    -- see no thread. Released automatically at commit or rollback.
    PERFORM pg_advisory_xact_lock(
        hashtext(least(v_caller::text, target_user_id::text)),
        hashtext(greatest(v_caller::text, target_user_id::text))
    );

    -- Idempotent: return an existing thread whose participant set is EXACTLY
    -- these two people. The count = 2 condition is load-bearing, not defensive
    -- decoration. Without it, a group thread that happens to contain both would
    -- be handed back as their private DM, and group chat is a stated direction
    -- (CLAUDE.md), not hypothetical.
    SELECT cp.conversation_id INTO v_conv_id
    FROM conversation_participants cp
    WHERE cp.user_id = v_caller
      AND EXISTS (
          SELECT 1 FROM conversation_participants cp2
          WHERE cp2.conversation_id = cp.conversation_id
            AND cp2.user_id = target_user_id
      )
      AND (
          SELECT count(*) FROM conversation_participants cp3
          WHERE cp3.conversation_id = cp.conversation_id
      ) = 2
    LIMIT 1;

    -- Checked BEFORE the velvet rope, deliberately. An existing thread stays
    -- reachable even if the follow was later withdrawn: both people can already
    -- see it in their conversation list, so refusing to reopen it here would
    -- contradict what the app already shows them.
    IF v_conv_id IS NOT NULL THEN
        RETURN v_conv_id;
    END IF;

    SELECT role_type::text INTO v_role FROM profiles WHERE id = v_caller;

    -- Three roles only: guest, talent, manager (CLAUDE.md, single source of
    -- truth). venue_manager is deliberately NOT listed. It is cruft with no
    -- rows, and repeating it here would spread it into new code rather than
    -- letting the eventual enum collapse touch one file.
    IF v_role IS DISTINCT FROM 'talent' AND v_role IS DISTINCT FROM 'manager' THEN
        IF NOT EXISTS (
            SELECT 1 FROM followers
            WHERE follower_id = target_user_id
              AND following_id = v_caller
        ) THEN
            RAISE EXCEPTION 'They need to follow you back before you can message them'
                USING ERRCODE = '42501';
        END IF;
    END IF;

    INSERT INTO conversations DEFAULT VALUES RETURNING id INTO v_conv_id;

    INSERT INTO conversation_participants (conversation_id, user_id)
    VALUES (v_conv_id, v_caller), (v_conv_id, target_user_id);

    RETURN v_conv_id;
END;
$function$;
