-- Stop unread_count claiming it can be null.
--
-- The aggregate cannot return NULL: count() over zero rows returns 0. Verified
-- against the database rather than inferred from the signature. The
-- nullability came entirely from views not propagating NOT NULL, so the type
-- said "possibly null" while the data said "never null", and the gap was
-- bridged by a comment.
--
-- COALESCE closes it at the source instead. Same principle as deriving
-- PostWithVenue from the generated types rather than casting to it: fix the
-- shape, do not annotate around it. Comments do not survive refactors.
--
-- Everything else is byte-identical to 20260822150000. All ten columns keep
-- their names, types and order; CREATE OR REPLACE VIEW cannot reorder or drop,
-- so a mistake fails loudly. security_invoker is re-asserted at the end
-- because CREATE OR REPLACE preserves reloptions, but stating it keeps this
-- file standalone and idempotent under the platform's auto-push.

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
    COALESCE(( SELECT count(*)::integer
        FROM messages um
       WHERE um.conversation_id = c.id
         AND um.sender_id <> cp.user_id
         AND COALESCE(um.is_read, false) = false
    ), 0) AS unread_count
   FROM conversations c
     JOIN conversation_participants cp
       ON cp.conversation_id = c.id
      AND cp.user_id = auth.uid()
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
