-- Message requests, part 2 of 2: behaviour. Part 1 (20260831100000) added the
-- state and the policies that guard it.
--
-- start_conversation stops raising for the velvet rope. A guest messaging
-- someone who does not follow them back now creates the thread with the
-- RECIPIENT's row pending, instead of a 42501 the sender sees as a refusal.
-- The rope moves from allow-vs-raise to accepted-vs-pending.
--
-- Talent and managers stay exempt exactly as before. The exemption is a
-- property of the sender's role; it now decides the recipient's initial state
-- rather than whether the call succeeds, so a talent messaging a guest still
-- lands directly in that guest's inbox.
--
-- ACCEPTED CONSEQUENCE: a guest can now open unlimited pending threads with
-- strangers, where previously the rope refused them. That is inherent to a
-- request queue and matches the model this is copied from. There is no rate
-- limit, and at hand-gatekept launch scale that is deliberate, not an
-- oversight.

CREATE OR REPLACE FUNCTION public.start_conversation(target_user_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
    v_caller       uuid := auth.uid();
    v_role         text;
    v_conv_id      uuid;
    v_target_state text;
BEGIN
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

    -- Serialize on the unordered pair so two near-simultaneous presses cannot
    -- both miss the lookup and both insert. Ordering makes both directions
    -- take the same lock. Released at commit or rollback.
    PERFORM pg_advisory_xact_lock(
        hashtext(least(v_caller::text, target_user_id::text)),
        hashtext(greatest(v_caller::text, target_user_id::text))
    );

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

    IF v_conv_id IS NOT NULL THEN
        -- THE RECOVERY PATH, and it must happen before the early return.
        --
        -- Initiating a conversation is itself an acceptance: if the caller had
        -- declined this thread, or had a pending request sitting in it from
        -- the other person, reaching out flips THEIR OWN row to accepted. That
        -- is the only way out of 'declined', which means only the decliner can
        -- undo their own decline, and a sender can never re-request past it.
        --
        -- `user_id = v_caller` is load-bearing, not incidental. This function
        -- is SECURITY DEFINER, so RLS does not constrain it and nothing else
        -- stops this statement reaching the other participant's row. Pinning
        -- user_id is what guarantees a caller can only ever raise their own
        -- state. `state <> 'accepted'` keeps the no-op case from writing.
        UPDATE conversation_participants
           SET state = 'accepted'
         WHERE conversation_id = v_conv_id
           AND user_id = v_caller
           AND state <> 'accepted';

        RETURN v_conv_id;
    END IF;

    SELECT role_type::text INTO v_role FROM profiles WHERE id = v_caller;

    -- Three roles only: guest, talent, manager (CLAUDE.md, single source of
    -- truth). venue_manager is deliberately NOT listed: it is cruft with no
    -- rows, and repeating it here would spread it into new code.
    --
    -- The rope, restated as a state rather than a refusal. Talent and managers
    -- are exempt; a guest is exempt only when the target already follows them,
    -- which is checked in that direction on purpose -- target follows caller.
    IF v_role IN ('talent', 'manager')
       OR EXISTS (
            SELECT 1 FROM followers
            WHERE follower_id = target_user_id
              AND following_id = v_caller
          )
    THEN
        v_target_state := 'accepted';
    ELSE
        v_target_state := 'pending';
    END IF;

    INSERT INTO conversations DEFAULT VALUES RETURNING id INTO v_conv_id;

    -- The caller is always accepted in a thread they opened.
    INSERT INTO conversation_participants (conversation_id, user_id, state)
    VALUES (v_conv_id, v_caller, 'accepted'),
           (v_conv_id, target_user_id, v_target_state);

    RETURN v_conv_id;
END;
$function$;

-- ---------------------------------------------------------------------------
-- The summary view carries the VIEWER'S OWN state so the client can split the
-- inbox from the requests surface. Deliberately not the counterparty's: a
-- sender is never told their message is sitting in a request queue.
--
-- DROP then CREATE rather than CREATE OR REPLACE: replace can only append
-- columns, and being explicit here means the shape is whatever this file says
-- on a re-run rather than depending on what was there before. security_invoker
-- is re-asserted afterwards because DROP discards it, and without it the view
-- silently bypasses RLS -- the exact defect closed on 2026-08-22.
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS public.conversation_summary;

CREATE VIEW public.conversation_summary AS
 SELECT c.id AS conversation_id,
    c.updated_at,
    cp.user_id AS participant_id,
    cp.state AS participant_state,
    other.display_name,
    other.avatar_url,
    m.content AS last_message_content,
    m.created_at AS last_message_at,
    m.is_read,
    m.sender_id AS last_sender_id,
    COALESCE(( SELECT count(*)::integer AS count
           FROM messages um
          WHERE um.conversation_id = c.id
            AND um.sender_id <> cp.user_id
            AND COALESCE(um.is_read, false) = false), 0) AS unread_count
   FROM conversations c
     JOIN conversation_participants cp ON cp.conversation_id = c.id AND cp.user_id = auth.uid()
     LEFT JOIN LATERAL ( SELECT
                CASE WHEN count(*) = 1 THEN min(p2.display_name) ELSE NULL::text END AS display_name,
                CASE WHEN count(*) = 1 THEN min(p2.avatar_url)   ELSE NULL::text END AS avatar_url
           FROM conversation_participants ocp
             JOIN profiles p2 ON p2.id = ocp.user_id
          WHERE ocp.conversation_id = c.id AND ocp.user_id <> cp.user_id) other ON true
     LEFT JOIN LATERAL ( SELECT messages.content,
            messages.created_at,
            messages.is_read,
            messages.sender_id
           FROM messages
          WHERE messages.conversation_id = c.id
          ORDER BY messages.created_at DESC
         LIMIT 1) m ON true;

ALTER VIEW public.conversation_summary SET (security_invoker = true);
