import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { toast } from "sonner";

/**
 * Derived from the generated types rather than hand-written, so it cannot
 * drift from the view again.
 *
 * `unread_count` used to be declared here by hand with the comment
 * "Resolves TS2339 in Messages.tsx". No such column existed anywhere in the
 * database: the field was invented to silence a type error, `|| 0` pinned it
 * to zero, and the badge gated on `> 0` could never render. The column is
 * real as of 20260822120000_conversation_summary_unread_count.sql; taking the
 * shape from the generated types means a future mismatch is a compile error
 * instead of a silently absent feature.
 */
/**
 * The viewer's own membership state in a thread. `accepted` is deliberately
 * not called `active`: CLAUDE.md documents "active" already meaning three
 * unrelated things in this codebase, and a fourth would be the exact trap it
 * warns about.
 */
export type ParticipantState = "accepted" | "pending" | "declined";

export type ConversationSummary = Omit<
  Database["public"]["Views"]["conversation_summary"]["Row"],
  "unread_count" | "participant_state"
> & {
  /**
   * Non-null for the same reason as unread_count below: the column is NOT NULL
   * on conversation_participants, but views never carry NOT NULL in
   * pg_attribute, so the generator types it nullable regardless.
   */
  participant_state: ParticipantState;
  /**
   * Non-null, corrected here because the generator cannot express it.
   *
   * The view computes this with COALESCE(count(*), 0) and count() cannot
   * return NULL over zero rows, verified against the database. But views do
   * not carry NOT NULL in pg_attribute, so Supabase's generator types EVERY
   * view column as nullable no matter what the expression guarantees. Adding
   * the COALESCE (20260822170000) did not change the emitted type, confirmed
   * by regenerating.
   *
   * Corrected once here, at the boundary, rather than with `?? 0` at each
   * consumer: those are the annotations that drift. Everything downstream
   * gets a plain number.
   */
  unread_count: number;
};

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  is_read: boolean | null;
}

export function useChat(selectedConversationId: string | null) {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

  // 1. Initial Identity Sync
  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setCurrentUserId(user?.id ?? null);
    };
    getUser();
  }, []);

  // 2. Fetch Sidebar Conversations
  const fetchConversations = useCallback(async () => {
    if (!currentUserId) return;

    try {
      // No participant filter. The view scopes itself to auth.uid() and
      // returns one row per conversation carrying the COUNTERPARTY's name and
      // avatar, so there is nothing left for the client to filter.
      //
      // The old `.neq("participant_id", currentUserId)` caused three defects
      // at once: it never scoped to the caller's own conversations, so every
      // conversation in the database came back with last_message_content on
      // the wire; and because it selected the other party's row, unread_count
      // was THEIR unread, so the badge lit when someone had not read your
      // message. Fixed in the view rather than here, because client
      // discipline is what failed.
      const { data, error } = await supabase
        .from("conversation_summary")
        .select("*")
        .order("last_message_at", { ascending: false });

      if (error) throw error;

      // The single place the generator's nullable view columns become the
      // non-null types ConversationSummary promises. Neither default papers
      // over an unknown: unread_count is COALESCEd in the view, and
      // participant_state is NOT NULL on the table. Doing it once here is why
      // no consumer needs its own default.
      const sanitized: ConversationSummary[] = (data || []).map((conv) => ({
        ...conv,
        unread_count: conv.unread_count ?? 0,
        participant_state: (conv.participant_state ?? "accepted") as ParticipantState,
      }));

      setConversations(sanitized);
    } catch (err) {
      console.error("Neural Sidebar Sync Failed:", err);
    } finally {
      setIsLoadingConversations(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    if (currentUserId) fetchConversations();
  }, [currentUserId, fetchConversations]);

  // 3. Mark Messages as Read Logic
  const markAsRead = useCallback(
    async (conversationId: string) => {
      if (!currentUserId) return;
      try {
        // `.select("id")` so we can count rows affected. Without it this was
        // the silent-success pattern in full: messages had no UPDATE policy
        // at all, so every call matched zero rows and returned 200 with no
        // error, while the local state below reported success. The badge
        // cleared on screen and came back on every reload, and nothing ever
        // said why. The policy (20260830140000) makes the write land; this
        // check is what makes a future denial visible instead of invisible.
        const { data: updated, error } = await supabase
          .from("messages")
          .update({ is_read: true })
          .eq("conversation_id", conversationId)
          .neq("sender_id", currentUserId)
          .eq("is_read", false)
          .select("id");

        if (error) throw error;

        setConversations((prev) => {
          const target = prev.find((c) => c.conversation_id === conversationId);

          // Zero rows is legitimate when there was nothing unread, so it is
          // only a denial if we believed there was. Comparing against the
          // count we are already holding tells the two apart, and refusing to
          // zero the badge means the UI stops agreeing with a write that did
          // not happen.
          if (target && target.unread_count > 0 && (updated?.length ?? 0) === 0) {
            console.error(
              `markAsRead affected 0 rows for conversation ${conversationId} while ${target.unread_count} were unread. ` +
                "The write was refused, most likely by RLS. Leaving the badge lit.",
            );
            return prev;
          }

          return prev.map((c) => (c.conversation_id === conversationId ? { ...c, unread_count: 0 } : c));
        });
      } catch (err) {
        console.warn("Read Status Sync Delayed", err);
      }
    },
    [currentUserId],
  );

  // 4. Fetch Active Message History
  const fetchMessages = useCallback(async () => {
    if (!selectedConversationId || !currentUserId) return;

    setIsLoadingMessages(true);
    try {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", selectedConversationId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setMessages(data ?? []);

      // Auto-clear unread status when opening conversation
      markAsRead(selectedConversationId);
    } catch (err) {
      console.error("Message History Sync Failed:", err);
    } finally {
      setIsLoadingMessages(false);
    }
  }, [selectedConversationId, currentUserId, markAsRead]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // 5. Global Message Subscription (Realtime)
  useEffect(() => {
    if (!currentUserId) return;

    /**
     * ✅ NEURAL CHANNEL: Listens to ALL messages for the current user
     * to update unread counts and conversation snippets even if the
     * user doesn't have that specific chat open.
     */
    const channel = supabase
      .channel("neural-comms-global")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
        const newMessage = payload.new as Message;

        // If the message is in our active chat, add it to history
        if (newMessage.conversation_id === selectedConversationId) {
          setMessages((prev) => {
            // Load-bearing only since sendMessage started reconciling the
            // optimistic entry to the server's id. Before that this compared
            // against a client-generated tempId and could never match your
            // own message, so it silently did nothing.
            const exists = prev.some((m) => m.id === newMessage.id);
            if (exists) return prev;
            return [...prev, newMessage];
          });
          // Automatically mark as read if it's the active chat
          if (newMessage.sender_id !== currentUserId) {
            markAsRead(selectedConversationId);
          }
        }

        // Always refresh sidebar to update snippets and unread badges
        fetchConversations();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedConversationId, currentUserId, fetchConversations, markAsRead]);

  // 6. Optimistic Transmission
  const sendMessage = async (content: string) => {
    if (!selectedConversationId || !currentUserId || !content.trim()) return;

    const tempId = crypto.randomUUID();
    const optimisticMessage: Message = {
      id: tempId,
      conversation_id: selectedConversationId,
      sender_id: currentUserId,
      content: content.trim(),
      created_at: new Date().toISOString(),
      is_read: false,
    };

    setMessages((prev) => [...prev, optimisticMessage]);

    try {
      // `.select().single()` so the row the database actually wrote comes
      // back. Without it the optimistic entry kept `tempId` forever, and the
      // realtime dedup below compared that against the server's id.
      //
      // That made the guard STRUCTURALLY DEAD, not merely bypassed: it tested
      // an id the database had never seen, so for a message you sent yourself
      // it could never match, and every one of your own messages was appended
      // a second time. Same shape as venue_staff's `status === "confirmed"`,
      // a check that reads as correct and can never fire. The guard starts
      // working only because of this reconcile.
      const { data: saved, error } = await supabase
        .from("messages")
        .insert({
          conversation_id: selectedConversationId,
          sender_id: currentUserId,
          content: content.trim(),
        })
        .select()
        .single();

      if (error) throw error;

      // Removal-then-conditional-add, deliberately not a swap in place. The
      // realtime INSERT can arrive before this response resolves, in which
      // case the real row is already in state and swapping would leave two
      // entries sharing one id: the same duplicate, one layer down. This is
      // correct in both orderings.
      setMessages((prev) => {
        const withoutTemp = prev.filter((m) => m.id !== tempId);
        return withoutTemp.some((m) => m.id === saved.id) ? withoutTemp : [...withoutTemp, saved];
      });

      fetchConversations(); // Update sidebar snippet for the sender
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      toast.error("Transmission Failed");
    }
  };

  /**
   * Accept or decline a message request by moving the caller's OWN participant
   * row. The policy allows only pending -> accepted|declined on your own row,
   * and the column grant makes `state` the only writable column, so this
   * cannot reach anyone else's membership or rewrite the thread it points at.
   */
  const respondToRequest = useCallback(
    async (conversationId: string, accept: boolean) => {
      if (!currentUserId) return false;

      try {
        // Rows affected, not just absence of error. An RLS refusal here would
        // be a 200 with zero rows, and reporting success on that is the
        // mistake that made markAsRead invisible for the life of the feature.
        const { data, error } = await supabase
          .from("conversation_participants")
          .update({ state: accept ? "accepted" : "declined" })
          .eq("conversation_id", conversationId)
          .eq("user_id", currentUserId)
          .select("conversation_id");

        if (error) throw error;

        if (!data || data.length === 0) {
          console.error(
            `respondToRequest affected 0 rows for conversation ${conversationId}. ` +
              "The transition was refused, most likely because the row is no longer pending.",
          );
          toast.error("Request No Longer Pending");
          await fetchConversations();
          return false;
        }

        toast.success(accept ? "Request Accepted" : "Request Declined");
        await fetchConversations();
        return true;
      } catch (err) {
        console.error("respondToRequest failed:", err);
        toast.error("Could Not Update Request");
        return false;
      }
    },
    [currentUserId, fetchConversations],
  );

  // Split here rather than at each surface. `declined` belongs to neither
  // list, and centralising that is what stops a future surface rendering a
  // thread its owner already refused.
  const inbox = conversations.filter((c) => c.participant_state === "accepted");
  const requests = conversations.filter((c) => c.participant_state === "pending");

  return {
    // Accepted only. A pending thread the SENDER opened still appears here for
    // them, because their own row is accepted -- which is correct: it is an
    // ordinary thread from their side.
    conversations: inbox,
    requests,
    messages,
    currentUserId,
    isLoadingConversations,
    isLoadingMessages,
    sendMessage,
    respondToRequest,
    refetchConversations: fetchConversations,
  };
}
