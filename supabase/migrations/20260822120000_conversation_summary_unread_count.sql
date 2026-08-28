-- Add a real unread_count to conversation_summary.
--
-- useChat has declared `unread_count: number` on its interface since it was
-- written, with the comment "Resolves TS2339 in Messages.tsx", and
-- Messages.tsx reads it through `(conv as any)`. No such column has ever
-- existed anywhere in the database, so the value was always undefined,
-- `unread_count || 0` pinned it to 0, and the badge gated on `> 0` could
-- never render. The field was invented to silence a type error and cast
-- around a second time at the render site; neither step checked the schema.
--
-- The backing data was always there. messages.is_read is real and
-- markAsRead maintains it correctly. Only the aggregate was missing.
--
-- CREATE OR REPLACE VIEW is idempotent, which the platform's auto-push
-- requires. Column order and names of the existing nine are preserved
-- exactly; REPLACE cannot reorder or drop columns anyway, it can only append,
-- so this is additive by construction.
--
-- SECURITY, unchanged and deliberately so: this view carries no
-- security_invoker option, so it keeps Postgres's default and executes with
-- the owner's rights (postgres), which BYPASSES row-level security on
-- messages. That is pre-existing behaviour and this migration does not alter
-- it. See the note in CLAUDE.md; it is being reported separately rather than
-- changed here, because flipping it would need the client query rewritten in
-- the same breath.
--
-- The count is scoped PER PARTICIPANT, not per conversation: the view already
-- returns one row per (conversation, participant), and cp.user_id is the
-- participant that row belongs to. Two people in one thread get different
-- counts, which is the point.
--
-- It excludes the participant's own messages (sender_id <> cp.user_id),
-- matching exactly what markAsRead writes: it flips is_read on rows in the
-- conversation NOT sent by the caller. Counting your own sent messages would
-- make every thread you spoke in show as unread to you.
--
-- COALESCE on is_read because the column is nullable. Its default is false,
-- so NULLs should not occur, but `is_read = false` would silently skip any
-- that did, undercounting rather than failing. Treating NULL as unread is the
-- safer direction for a badge.

CREATE OR REPLACE VIEW public.conversation_summary AS
 SELECT c.id AS conversation_id,
    c.updated_at,
    cp.user_id AS participant_id,
    p.display_name,
    p.avatar_url,
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
     JOIN conversation_participants cp ON c.id = cp.conversation_id
     JOIN profiles p ON cp.user_id = p.id
     LEFT JOIN LATERAL ( SELECT messages.content,
            messages.created_at,
            messages.is_read,
            messages.sender_id
           FROM messages
          WHERE messages.conversation_id = c.id
          ORDER BY messages.created_at DESC
         LIMIT 1) m ON true;
