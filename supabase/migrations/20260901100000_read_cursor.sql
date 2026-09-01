-- Replaces per-message read state with a per-participant read cursor.
--
-- WHY. messages.is_read is ONE boolean per message, shared by everyone in the
-- thread. For a DM that happens to work. For three people it is wrong by
-- construction: the first person to open a thread marks it read for everyone,
-- and the other members silently lose their unread count. The mark-read policy
-- actively permits this -- `sender_id <> auth.uid()` lets any member flip any
-- other member's message. Group chat is not buildable on this column, so this
-- lands before it, not alongside it.
--
-- This deliberately supersedes 20260830140000, verified six days ago. The
-- column grant and policy from that migration were correct for the model they
-- guarded; the model is what changes.
--
-- STRUCTURAL PROPERTY WORTH NAMING: a cursor on your own participant row makes
-- the entire class of cross-member damage impossible. The worst a caller can
-- do is mis-set their own cursor. Under is_read, one member's action silently
-- changed what every other member saw.

ALTER TABLE public.conversation_participants
  ADD COLUMN IF NOT EXISTS last_read_at timestamptz;

-- Serves three seq scans that exist today: the unread count below, the message
-- history fetch's ORDER BY created_at, and the view's last-message lateral.
-- messages currently carries only its primary key.
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created
  ON public.messages (conversation_id, created_at);

-- Backfill from is_read while it still means something. Faithful rather than
-- convenient: a member's cursor goes to the newest message they had marked
-- read, so genuinely-unread messages stay unread. Where they had read nothing,
-- the cursor stays NULL and everything is unread.
--
-- Carries the old model's defect forward, and cannot do better: is_read was
-- shared, so a message another member marked read reads as read for you too.
-- The information to distinguish them was never stored.
--
-- `last_read_at IS NULL` is the load-bearing guard, and not for the usual
-- reason. The platform re-applies migrations from the repo on sync, so this
-- may run again LATER, after cursors have legitimately moved forward. Without
-- the guard a re-run would drag every cursor back to its backfill value and
-- resurrect read messages as unread. Idempotent here has to mean "safe to
-- re-run after the data has moved on", not merely "does not error".
UPDATE public.conversation_participants cp
   SET last_read_at = sub.max_read
  FROM (
    SELECT cp2.conversation_id, cp2.user_id, max(m.created_at) AS max_read
      FROM public.conversation_participants cp2
      JOIN public.messages m
        ON m.conversation_id = cp2.conversation_id
       AND m.sender_id <> cp2.user_id
       AND COALESCE(m.is_read, false)
     GROUP BY cp2.conversation_id, cp2.user_id
  ) sub
 WHERE cp.conversation_id = sub.conversation_id
   AND cp.user_id         = sub.user_id
   AND cp.last_read_at IS NULL;

-- ---------------------------------------------------------------------------
-- The cursor is advanced by an RPC, NOT by a column grant plus policy.
--
-- WHY NOT the established grant+policy pattern, which was right for is_read
-- and for state: conversation_participants already has an UPDATE policy, and
-- it is the request state machine -- USING (user_id = auth.uid() AND state =
-- 'pending'). Permissive policies OR together, so adding a second UPDATE
-- policy permissive enough to allow a cursor write on an ACCEPTED row would
-- also re-open every accepted row to a state change, and a declined member
-- could set themselves back to accepted. A policy cannot restrict itself to a
-- column; the grant is per-role, not per-policy. That is the loosest-policy-
-- wins trap CLAUDE.md documents, and it would have been introduced by the
-- obvious change.
--
-- So the verified state machine stays EXACTLY as it is, last_read_at is never
-- client-writable, and this function is the only writer.
--
-- It also removes the client's clock from the picture. Had the client supplied
-- a timestamp, a skewed clock could set a cursor far in the future and
-- suppress that user's unread badge permanently and invisibly. The cursor is
-- set from the newest message's own created_at -- server-generated data,
-- semantically exact ("read up to this message"), and monotonic by the guard
-- in the UPDATE.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mark_conversation_read(_conversation_id uuid)
 RETURNS timestamptz
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  v_caller uuid := auth.uid();
  v_state  text;
  v_newest timestamptz;
  v_cursor timestamptz;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'mark_conversation_read requires an authenticated caller'
      USING ERRCODE = '42501';
  END IF;

  SELECT state INTO v_state
    FROM conversation_participants
   WHERE conversation_id = _conversation_id AND user_id = v_caller;

  -- Not a member at all. Raise rather than return quietly, so a caller
  -- probing for thread existence gets the same answer as RLS would give.
  IF v_state IS NULL THEN
    RAISE EXCEPTION 'Not a participant in that conversation'
      USING ERRCODE = '42501';
  END IF;

  -- A member who has not accepted yet may READ a request but must not consume
  -- its unread count by previewing it. Same rule the superseded mark-read
  -- policy enforced, kept deliberately.
  IF v_state <> 'accepted' THEN
    RETURN NULL;
  END IF;

  SELECT max(created_at) INTO v_newest
    FROM messages WHERE conversation_id = _conversation_id;

  IF v_newest IS NULL THEN
    RETURN NULL;  -- empty thread, nothing to read
  END IF;

  UPDATE conversation_participants
     SET last_read_at = v_newest
   WHERE conversation_id = _conversation_id
     AND user_id = v_caller
     AND (last_read_at IS NULL OR last_read_at < v_newest);

  SELECT last_read_at INTO v_cursor
    FROM conversation_participants
   WHERE conversation_id = _conversation_id AND user_id = v_caller;

  RETURN v_cursor;
END;
$function$;

-- ---------------------------------------------------------------------------
-- Nothing writes messages.is_read any more, so the write path goes with it.
-- Leaving a live grant and policy on a column nothing reads is precisely the
-- dead-check shape this codebase keeps finding.
--
-- The COLUMN is deliberately kept for now and dropped in a follow-up once the
-- cutover is verified: the database has no rollback, and a column drop is the
-- one step here that cannot be undone. It is unmaintained from this point, and
-- an unmaintained column that still looks meaningful is how the next person
-- builds on a lie -- hence the comment, and the CLAUDE.md entry.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Participants can mark messages read" ON public.messages;
REVOKE UPDATE ON public.messages FROM authenticated;

COMMENT ON COLUMN public.messages.is_read IS
  'SUPERSEDED 2026-09-01 by conversation_participants.last_read_at. Not maintained: nothing writes this column and nothing should read it. Kept only because this database has no rollback; scheduled for removal.';

COMMENT ON COLUMN public.conversation_participants.last_read_at IS
  'Read cursor. Unread = messages in the conversation from other members with created_at > this. NULL means nothing read. Written only by mark_conversation_read().';

-- ---------------------------------------------------------------------------
-- The view switches to the cursor and stops exposing is_read at all.
-- DROP + CREATE, then re-assert security_invoker, which DROP discards -- and
-- without which the view silently bypasses RLS, the defect closed 2026-08-22.
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
    m.sender_id AS last_sender_id,
    COALESCE(( SELECT count(*)::integer AS count
           FROM messages um
          WHERE um.conversation_id = c.id
            AND um.sender_id <> cp.user_id
            AND um.created_at > COALESCE(cp.last_read_at, '-infinity'::timestamptz)), 0) AS unread_count
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
            messages.sender_id
           FROM messages
          WHERE messages.conversation_id = c.id
          ORDER BY messages.created_at DESC
         LIMIT 1) m ON true;

ALTER VIEW public.conversation_summary SET (security_invoker = true);
