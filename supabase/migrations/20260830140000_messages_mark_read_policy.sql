-- markAsRead has never marked a single message read.
--
-- public.messages has RLS enabled and only two policies, SELECT and INSERT.
-- No UPDATE policy was ever written, so every `update({is_read:true})`
-- matched zero rows and returned 200 with no error -- the silent-success
-- shape CLAUDE.md opens with, in its sixth confirmed instance. The unread
-- badge cleared optimistically in local state and came back on every reload,
-- permanently unclearable.
--
-- WHY NOT A PLAIN UPDATE POLICY. A permissive UPDATE policy carrying only a
-- participant predicate would let anyone in a conversation rewrite anyone
-- else's message text, which is a worse bug than the one being fixed. And a
-- policy cannot prevent it on its own: Postgres RLS `WITH CHECK` sees only
-- the NEW row, there is no OLD to compare against, so "content is unchanged"
-- is not expressible as a policy predicate at all.
--
-- WHY COLUMN-LEVEL GRANT. The privilege system enforces per-column UPDATE
-- independently of RLS, so `SET content = ...` is refused by the grant before
-- any policy is consulted, for every client and every query shape. It is
-- declarative, it fails LOUDLY (42501, not a silent no-op), and it fails
-- CLOSED: a column added later is not granted, so new columns are protected
-- by default rather than by remembering.
--
-- WHY NOT A TRIGGER. A BEFORE UPDATE trigger raising on changed columns also
-- works, but it is imperative, it must enumerate every column, and it fails
-- OPEN the day someone adds a column and forgets to list it -- the same
-- failure mode as the CHECK constraint duplicated in positions.ts. It also
-- adds a per-row function call to a table that only gets more write-heavy.
-- The grant expresses the same rule with nothing to keep in sync.

-- Idempotent: the platform re-applies migrations from the repo on sync, so
-- this must survive a second run. REVOKE/GRANT are naturally idempotent.
REVOKE UPDATE ON public.messages FROM authenticated;
GRANT  UPDATE (is_read) ON public.messages TO authenticated;

-- anon has table-level UPDATE too, and no policy has ever granted it a row.
-- Revoking outright rather than re-granting a column: nothing anonymous
-- should write to messages at all. Pure tightening, nothing can rely on it.
REVOKE UPDATE ON public.messages FROM anon;

DROP POLICY IF EXISTS "Participants can mark messages read" ON public.messages;
CREATE POLICY "Participants can mark messages read"
  ON public.messages
  FOR UPDATE
  TO authenticated
  -- Which rows may be targeted: messages in a conversation you belong to,
  -- that you did not send. Marking your own message read has no meaning, and
  -- the client already filters the same way; keeping the rule in the policy
  -- means it holds for callers that forget to.
  USING (
    is_conversation_participant(conversation_id)
    AND sender_id <> auth.uid()
  )
  -- Same predicate as WITH CHECK, deliberately. The column grant already
  -- stops conversation_id being rewritten, but CLAUDE.md records a case where
  -- USING without WITH CHECK let a caller move a row to a resource they did
  -- not own. Both halves, always.
  WITH CHECK (
    is_conversation_participant(conversation_id)
    AND sender_id <> auth.uid()
  );
