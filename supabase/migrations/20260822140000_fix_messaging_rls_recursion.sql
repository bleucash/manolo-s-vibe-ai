-- Fix infinite recursion in the messaging policies.
--
-- conversation_participants' SELECT policy queried its own table, and Postgres
-- applies RLS to that inner query, so it recursed forever:
--
--   42P17  infinite recursion detected in policy for relation
--          "conversation_participants"
--
-- It is not confined to that table. conversations SELECT, messages SELECT and
-- the messages INSERT WITH CHECK all query conversation_participants, so all
-- four fail the same way. **All three messaging tables are currently
-- unreadable by any authenticated user.**
--
-- The feature works at all only because conversation_summary is
-- security_invoker = false and bypasses RLS entirely. That view is not merely
-- permissive, it is the sole reason messaging functions, which is why turning
-- invoker rights on was never a one-line change: it would have 500'd
-- immediately. CLAUDE.md recorded this as "possible recursive RLS,
-- unverified"; it is real and broader than the note implied.
--
-- Fix is the established pattern from has_role_type: a SECURITY DEFINER
-- helper with a pinned search_path. Definer rights mean the lookup inside
-- does not re-enter RLS, so the cycle is broken rather than merely made
-- shallower.
--
-- NOTE FOR WHOEVER RUNS THIS: these four policies have never once executed
-- successfully. "Fixed" here means "running for the first time". A policy
-- that is wrong in a way the recursion was masking will only become visible
-- now.

CREATE OR REPLACE FUNCTION public.is_conversation_participant(_conversation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
      FROM public.conversation_participants
     WHERE conversation_id = _conversation_id
       AND user_id = auth.uid()
  );
$function$;

-- Own row stays visible unconditionally, so a participant can always see
-- their own membership even if the helper is ever narrowed.
DROP POLICY IF EXISTS "Users can view participants of their chats" ON public.conversation_participants;
CREATE POLICY "Users can view participants of their chats"
  ON public.conversation_participants
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR public.is_conversation_participant(conversation_id)
  );

DROP POLICY IF EXISTS "Users can view their own conversations" ON public.conversations;
CREATE POLICY "Users can view their own conversations"
  ON public.conversations
  FOR SELECT
  USING (public.is_conversation_participant(id));

DROP POLICY IF EXISTS "Users can view messages in their chats" ON public.messages;
CREATE POLICY "Users can view messages in their chats"
  ON public.messages
  FOR SELECT
  USING (public.is_conversation_participant(conversation_id));

-- Sender identity check kept exactly as it was; only the membership test
-- changes, so nobody gains the ability to post as someone else.
DROP POLICY IF EXISTS "Users can insert messages in their chats" ON public.messages;
CREATE POLICY "Users can insert messages in their chats"
  ON public.messages
  FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND public.is_conversation_participant(conversation_id)
  );
