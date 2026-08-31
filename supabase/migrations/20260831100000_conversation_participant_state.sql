-- Message requests, part 1 of 2: the state and everything that guards it.
-- Part 2 (20260831100100) rewrites start_conversation and the summary view.
--
-- The decided design (CLAUDE.md) was that a guest messaging someone who does
-- not follow them back lands in a REQUEST QUEUE. What shipped was a hard
-- reject. This is the queue.
--
-- WHY THE PARTICIPANT ROW, not conversations and not a separate table.
-- Pending is asymmetric: the thread is pending for the recipient and entirely
-- ordinary for the sender. A column on `conversations` cannot say whose, and
-- it collapses completely once group chat lands (three invitees, three
-- independent states), which CLAUDE.md records as a real direction. A separate
-- requests table would make the request and the thread different objects, so
-- accepting would have to migrate content between them -- insert-then-
-- participants again, two writes and an orphan window. This is the same shape
-- as venue_staff, a relationship table carrying its own status, which is
-- already proven by Builds 2-4.
--
-- WHY NOT THE VALUE 'active'. CLAUDE.md has an entire section on "active"
-- already meaning three unrelated things (affiliation, tapped in, open).
-- 'accepted' keeps this a request lifecycle and refuses to make it four.

-- Text + CHECK rather than an enum, per CLAUDE.md: app_role is the standing
-- proof of how expensive a wrong enum value is to remove.
ALTER TABLE public.conversation_participants
  ADD COLUMN IF NOT EXISTS state text;

-- Backfill before anything reads it. Every existing row predates the queue and
-- is a real, mutually visible thread. Idempotent by the IS NULL predicate: a
-- second run matches nothing.
UPDATE public.conversation_participants SET state = 'accepted' WHERE state IS NULL;

ALTER TABLE public.conversation_participants ALTER COLUMN state SET DEFAULT 'accepted';
ALTER TABLE public.conversation_participants ALTER COLUMN state SET NOT NULL;

ALTER TABLE public.conversation_participants
  DROP CONSTRAINT IF EXISTS conversation_participants_state_allowed;
ALTER TABLE public.conversation_participants
  ADD CONSTRAINT conversation_participants_state_allowed
  CHECK (state IN ('accepted', 'pending', 'declined'));

-- ---------------------------------------------------------------------------
-- Grants. Same finding as messages: authenticated and anon both hold FULL
-- table-level privileges here. RLS has been masking that, because the only
-- policy is SELECT and every write is denied whatever the grant says. Adding
-- an UPDATE policy below removes that cover, so the broad grant has to go
-- first or the column grant is decoration.
--
-- start_conversation is unaffected: SECURITY DEFINER executes as the owner, so
-- its inserts do not consult the authenticated role's privileges at all.
-- ---------------------------------------------------------------------------
REVOKE INSERT, UPDATE, DELETE ON public.conversation_participants FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.conversation_participants FROM anon;

-- Exactly one writable column, for exactly one role. A participant may move
-- their own state and nothing else; user_id and conversation_id are not
-- reachable through this door. Fails loudly (42501) and fails closed: a column
-- added later is not granted.
GRANT UPDATE (state) ON public.conversation_participants TO authenticated;

-- ---------------------------------------------------------------------------
-- The helper split. is_conversation_participant stays exactly as it is and
-- keeps guarding READS -- the recipient must be able to see a request to judge
-- it, so membership regardless of state is correct there.
--
-- This new one guards WRITES. Without it, messages INSERT checks only
-- membership, and a pending recipient could reply straight past the gate
-- without ever accepting.
--
-- Read with any state, write only when accepted.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_accepted_conversation_participant(_conversation_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
      FROM public.conversation_participants
     WHERE conversation_id = _conversation_id
       AND user_id = auth.uid()
       AND state = 'accepted'
  );
$function$;

-- ---------------------------------------------------------------------------
-- The state machine, expressed declaratively.
--
-- USING sees the OLD row and WITH CHECK sees the NEW one, and that asymmetry
-- is the whole mechanism: you may only leave 'pending', only into 'accepted'
-- or 'declined', and only on your own row. There is no path back INTO pending,
-- so a sender cannot re-request their way past a decline.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Participants can respond to their own request" ON public.conversation_participants;
CREATE POLICY "Participants can respond to their own request"
  ON public.conversation_participants
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() AND state = 'pending')
  WITH CHECK (user_id = auth.uid() AND state IN ('accepted', 'declined'));

-- ---------------------------------------------------------------------------
-- Write paths on messages move to the accepted-only helper. SELECT policies
-- are deliberately NOT changed: a pending recipient still reads the thread.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can insert messages in their chats" ON public.messages;
CREATE POLICY "Users can insert messages in their chats"
  ON public.messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND public.is_accepted_conversation_participant(conversation_id)
  );

-- Marking read is a write too. A pending recipient previewing a request must
-- not silently consume its unread count.
DROP POLICY IF EXISTS "Participants can mark messages read" ON public.messages;
CREATE POLICY "Participants can mark messages read"
  ON public.messages
  FOR UPDATE
  TO authenticated
  USING (
    public.is_accepted_conversation_participant(conversation_id)
    AND sender_id <> auth.uid()
  )
  WITH CHECK (
    public.is_accepted_conversation_participant(conversation_id)
    AND sender_id <> auth.uid()
  );
