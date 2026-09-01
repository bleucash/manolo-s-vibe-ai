-- Group chat, step 1 of 5: schema plus the view rebuild.
-- Steps 2-5: create_group_conversation RPC, the venue-thread reconciler, the
-- presentation surfaces (#3/#5/#6), then sender attribution (#2).
--
-- Nothing here creates a group. This step only gives conversations a kind, an
-- optional venue anchor, and a title, and teaches the view to resolve one name
-- per thread whatever its kind.

-- ---------------------------------------------------------------------------
-- kind: text + CHECK, not a Postgres enum.
--
-- CLAUDE.md settles this and gives the reason: app_role is the standing proof
-- of how expensive a wrong enum value is to remove. Six values, three of them
-- cruft, and the collapse is STILL deferred because removing one means
-- dropping and recreating a function and an index on a no-rollback production
-- database. Nothing about `kind` is more certain today than app_role looked
-- when it was created, and a broadcast/announcement kind is a plausible
-- addition. text + CHECK changes in one DROP/ADD pair.
--
-- CAUTION, same shape as positions.ts: this value list will exist in BOTH the
-- CHECK constraint and a TypeScript union, and the two must change together.
-- That duplication has already bitten once in this codebase.
-- ---------------------------------------------------------------------------
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS kind text;
UPDATE public.conversations SET kind = 'dm' WHERE kind IS NULL;
ALTER TABLE public.conversations ALTER COLUMN kind SET DEFAULT 'dm';
ALTER TABLE public.conversations ALTER COLUMN kind SET NOT NULL;

ALTER TABLE public.conversations DROP CONSTRAINT IF EXISTS conversations_kind_allowed;
ALTER TABLE public.conversations
  ADD CONSTRAINT conversations_kind_allowed CHECK (kind IN ('dm', 'venue', 'group'));

-- ---------------------------------------------------------------------------
-- venue_id: a REAL foreign key, ON DELETE CASCADE.
--
-- The three FKs in this schema pointing at auth.users instead of profiles
-- exist because the referenced thing genuinely IS an auth user. That ambiguity
-- does not arise here: a venue thread references a venue.
--
-- DELETION BEHAVIOUR, held deliberately by the owner (2026-09-01): deleting a
-- venue DESTROYS its staff thread and every message in it, irreversibly, on a
-- database with no rollback. conversation_participants and messages already
-- cascade from conversations, so the whole subtree goes in one step.
--
-- SET NULL was rejected as the decisive alternative: it leaves a thread with
-- kind='venue' and no venue -- nameless because its name derives from
-- venues.name, and emptied by the reconciler because its membership derives
-- from venue_staff for a venue that no longer exists. That is the Tangra
-- shape exactly, a relationship row whose anchor is gone, invisible to every
-- scoped query but still counting. This codebase already spent a dedicated
-- pass cleaning up one of those.
--
-- RESTRICT was rejected as making venue deletion mysteriously impossible for
-- a reason nobody would connect to messaging.
--
-- Note nothing in the app deletes venues today. This is about what the
-- constraint says, not a path anyone currently exercises.
-- ---------------------------------------------------------------------------
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS venue_id uuid;

ALTER TABLE public.conversations DROP CONSTRAINT IF EXISTS conversations_venue_id_fkey;
ALTER TABLE public.conversations
  ADD CONSTRAINT conversations_venue_id_fkey
  FOREIGN KEY (venue_id) REFERENCES public.venues(id) ON DELETE CASCADE;

-- One thread per venue. The reconciler creates venue threads LAZILY, on first
-- active affiliation, which is precisely the shape that races two threads into
-- existence under concurrent approvals. A partial unique index makes that
-- impossible rather than unlikely -- the same reasoning as the advisory lock
-- in start_conversation, expressed as a constraint because here it can be.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_conversation_per_venue
  ON public.conversations (venue_id) WHERE kind = 'venue';

-- kind and venue_id must agree. A venue thread without a venue, or a DM
-- carrying one, are both incoherent states rather than merely unused ones.
ALTER TABLE public.conversations DROP CONSTRAINT IF EXISTS conversations_venue_id_matches_kind;
ALTER TABLE public.conversations
  ADD CONSTRAINT conversations_venue_id_matches_kind
  CHECK ((kind = 'venue') = (venue_id IS NOT NULL));

-- ---------------------------------------------------------------------------
-- title: manual groups only.
--
-- Required AT CREATION and enforced there by the step 2 RPC, not by NOT NULL,
-- because the creator may later clear it and fall back to a member list. So
-- NULL is a legitimate state; empty or whitespace is not.
--
-- Venue threads ignore this column entirely -- their name derives from
-- venues.name through the FK, so a venue rename propagates rather than going
-- stale. DMs ignore it too.
-- ---------------------------------------------------------------------------
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS title text;

ALTER TABLE public.conversations DROP CONSTRAINT IF EXISTS conversations_title_shape;
ALTER TABLE public.conversations
  ADD CONSTRAINT conversations_title_shape
  CHECK (title IS NULL OR char_length(btrim(title)) BETWEEN 1 AND 60);

COMMENT ON COLUMN public.conversations.kind IS
  'dm | venue | group. Value list is duplicated in a TypeScript union; both must change together.';
COMMENT ON COLUMN public.conversations.venue_id IS
  'Set only when kind = venue. ON DELETE CASCADE: deleting a venue destroys its thread and all its messages.';
COMMENT ON COLUMN public.conversations.title IS
  'Manual groups only, max 60 chars. NULL means the client falls back to a member list. Venue threads derive their name from venues.name instead.';

-- ---------------------------------------------------------------------------
-- Grants. THIRD table found carrying full table-level write privileges for
-- both authenticated and anon -- after messages (20260830140000) and
-- conversation_participants (20260831100000). Masked here today only because
-- the sole policy is SELECT, so every write is denied whatever the grant says.
--
-- This is a Supabase default, not anyone's error. But it means every table in
-- this database that has never had a policy added is one policy away from
-- being writable, and the ones nobody has touched still are. STANDING CHECK:
-- before adding a policy to a table that has never had one, read its grants
-- first. The policy is not the boundary if the grant is wide open behind it.
--
-- Revoking now rather than later is the point. The columns added above are
-- exactly the ones a future group-rename feature will want writable, and at
-- that moment the broad grant becomes the only thing between a member and
-- rewriting venue_id to a venue they do not own. Nothing in the client writes
-- conversations -- start_conversation is SECURITY DEFINER and unaffected --
-- so this costs nothing today and removes the trap before it is armed.
-- ---------------------------------------------------------------------------
REVOKE INSERT, UPDATE, DELETE ON public.conversations FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.conversations FROM anon;

-- ---------------------------------------------------------------------------
-- The view. Third rebuild, so: DROP + CREATE, then RE-ASSERT security_invoker,
-- which DROP discards. Without it the view silently bypasses RLS, which is the
-- defect closed on 2026-08-22 and the reason this is verified by reading
-- pg_class.reloptions back rather than trusting the ALTER.
--
-- ALL TEN EXISTING COLUMNS KEEP THEIR NAMES, TYPES AND POSITIONS (1-10). The
-- four new ones are appended at 11-14.
--
-- THE DM PATH IS UNCHANGED BY CONSTRUCTION. display_name, avatar_url and
-- unread_count are copied verbatim from the previous definition -- the
-- count(*) = 1 group signal and the read-cursor arithmetic are not touched.
-- thread_title is a NEW column that merely mirrors display_name for a dm, so
-- nothing a dm consumer reads today can change as a side effect of the title
-- logic.
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
            AND um.created_at > COALESCE(cp.last_read_at, '-infinity'::timestamp with time zone)), 0) AS unread_count,
    -- 11-14, new.
    c.kind,
    c.venue_id,
    -- One resolved name per thread, whatever its kind. Venue name comes
    -- through the FK so a rename propagates; a group uses its stored title;
    -- a dm mirrors the counterparty's display_name, which keeps every dm
    -- consumer reading exactly what it reads today.
    CASE c.kind
      WHEN 'venue' THEN v.name
      WHEN 'group' THEN c.title
      ELSE other.display_name
    END AS thread_title,
    -- AT MOST THREE. This is deliberately NOT the full membership -- it is
    -- what an avatar stack renders, and one round trip beats N. Do not treat
    -- its length as a member count: a truncated array that looks complete is
    -- exactly the kind of thing that gets misread. NULLs are kept so the
    -- client renders its fallback icon in position.
    av.member_avatars
   FROM conversations c
     JOIN conversation_participants cp ON cp.conversation_id = c.id AND cp.user_id = auth.uid()
     LEFT JOIN venues v ON v.id = c.venue_id
     LEFT JOIN LATERAL ( SELECT
                CASE
                    WHEN count(*) = 1 THEN min(p2.display_name)
                    ELSE NULL::text
                END AS display_name,
                CASE
                    WHEN count(*) = 1 THEN min(p2.avatar_url)
                    ELSE NULL::text
                END AS avatar_url
           FROM conversation_participants ocp
             JOIN profiles p2 ON p2.id = ocp.user_id
          WHERE ocp.conversation_id = c.id AND ocp.user_id <> cp.user_id) other ON true
     LEFT JOIN LATERAL ( SELECT array_agg(a.avatar_url) AS member_avatars
           FROM ( SELECT p3.avatar_url
                    FROM conversation_participants ocp2
                      JOIN profiles p3 ON p3.id = ocp2.user_id
                   WHERE ocp2.conversation_id = c.id AND ocp2.user_id <> cp.user_id
                   ORDER BY ocp2.created_at
                   LIMIT 3) a) av ON true
     LEFT JOIN LATERAL ( SELECT messages.content,
            messages.created_at,
            messages.sender_id
           FROM messages
          WHERE messages.conversation_id = c.id
          ORDER BY messages.created_at DESC
         LIMIT 1) m ON true;

ALTER VIEW public.conversation_summary SET (security_invoker = true);
