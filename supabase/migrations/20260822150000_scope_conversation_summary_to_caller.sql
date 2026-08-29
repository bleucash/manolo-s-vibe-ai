-- Scope conversation_summary to the caller, and stop trusting the client.
--
-- Two defects died to one clause here, and both came from a single line in
-- useChat: `.neq("participant_id", currentUserId)`.
--
--   1. No scoping. The view returned a row per (conversation, participant)
--      for EVERY conversation in the database, and the client filtered only
--      "not me". Proven at the API with a session token: a conversation the
--      caller was not part of came back with last_message_content in full.
--      The UI happened not to paint those rows, so the leak was invisible on
--      screen while the message bodies crossed the network.
--
--   2. Inverted badge. Because the client read the row where participant_id
--      <> caller, unread_count on that row was how many messages the OTHER
--      party had not read. Proven: caller's unread at 0, counterparty's at 1,
--      badge still showed. It lit up when someone had not read YOUR message.
--
-- Both are fixed in the view rather than the client, deliberately. Client
-- discipline is exactly what failed, so the fix must not depend on it: with
-- `cp.user_id = auth.uid()` in the view body, the leak is closed no matter
-- what any client sends, and every row is the caller's own, so unread_count
-- is theirs by construction rather than by convention.
--
-- All ten columns keep their names, types and order. CREATE OR REPLACE VIEW
-- cannot reorder or drop columns, so a mistake here fails loudly rather than
-- silently reshaping the payload. What changes is where display_name and
-- avatar_url come from: previously the row's own participant (which, once
-- scoped to the caller, would have shown the caller their own name), now the
-- counterparty.
--
-- GROUP CHAT, deliberate and not a placeholder. Group threads are planned,
-- primarily venue-to-staff coordination. With exactly one other participant
-- the counterparty's profile is joined. With more than one, display_name and
-- avatar_url are NULL, so the client can branch on it. Picking a participant
-- deterministically was rejected: it would render one confidently wrong name
-- on a three-way thread, which is the same failure shape as the inverted
-- badge this migration removes. NULL is honest. The rest of the group-chat
-- design (thread naming, who adds and removes participants, whether venue
-- threads follow venue_staff affiliation, how roles surface) is still open.
--
-- security_invoker is turned on at the end, as defence in depth. It is only
-- possible now that 20260822140000 has broken the policy recursion; before
-- that it would have made every read fail with 42P17. The auth.uid() filter
-- above already closes the leak on its own, so this makes the database the
-- backstop rather than the only line.

CREATE OR REPLACE VIEW public.conversation_summary AS
 SELECT c.id AS conversation_id,
    c.updated_at,
    cp.user_id AS participant_id,
    other.display_name,
    other.avatar_url,
    m.content AS last_message_content,
    m.created_at AS last_message_at,
    m.is_read,
    m.sender_id AS last_sender_id,
    ( SELECT count(*)::integer
        FROM messages um
       WHERE um.conversation_id = c.id
         AND um.sender_id <> cp.user_id
         AND COALESCE(um.is_read, false) = false
    ) AS unread_count
   FROM conversations c
     -- The scoping clause. One row per conversation, always the caller's.
     JOIN conversation_participants cp
       ON cp.conversation_id = c.id
      AND cp.user_id = auth.uid()
     -- Counterparty identity, but only when there is exactly one of them.
     -- count(*) = 1 makes min() return that single participant's values;
     -- with 0 or 2+ others both columns come back NULL.
     LEFT JOIN LATERAL ( SELECT
              CASE WHEN count(*) = 1 THEN min(p2.display_name) END AS display_name,
              CASE WHEN count(*) = 1 THEN min(p2.avatar_url)   END AS avatar_url
            FROM conversation_participants ocp
              JOIN profiles p2 ON p2.id = ocp.user_id
           WHERE ocp.conversation_id = c.id
             AND ocp.user_id <> cp.user_id
         ) other ON true
     LEFT JOIN LATERAL ( SELECT messages.content,
            messages.created_at,
            messages.is_read,
            messages.sender_id
           FROM messages
          WHERE messages.conversation_id = c.id
          ORDER BY messages.created_at DESC
         LIMIT 1) m ON true;

ALTER VIEW public.conversation_summary SET (security_invoker = true);
