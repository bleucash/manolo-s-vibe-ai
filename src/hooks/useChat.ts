import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * ✅ NEURAL TYPE DEFINITION
 * Added unread_count and corrected last_message_at naming
 */
export interface ConversationSummary {
  conversation_id: string;
  participant_id: string;
  display_name: string | null;
  avatar_url: string | null;
  last_message_content: string | null;
  last_message_at: string | null;
  last_sender_id: string | null;
  is_read: boolean | null;
  unread_count: number; // Resolves TS2339 in Messages.tsx
  updated_at: string | null;
}

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
      const { data, error } = await supabase
        .from("conversation_summary")
        .select("*")
        .neq("participant_id", currentUserId)
        .order("last_message_at", { ascending: false });

      if (error) throw error;

      // ✅ Data Sanitization: Ensure unread_count is never undefined
      const sanitized = (data || []).map((conv) => ({
        ...conv,
        unread_count: conv.unread_count || 0,
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
        await supabase
          .from("messages")
          .update({ is_read: true })
          .eq("conversation_id", conversationId)
          .neq("sender_id", currentUserId)
          .eq("is_read", false);

        // Update local sidebar unread count immediately
        setConversations((prev) =>
          prev.map((c) => (c.conversation_id === conversationId ? { ...c, unread_count: 0 } : c)),
        );
      } catch (err) {
        console.warn("Read Status Sync Delayed");
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
      const { error } = await supabase.from("messages").insert({
        conversation_id: selectedConversationId,
        sender_id: currentUserId,
        content: content.trim(),
      });

      if (error) throw error;
      fetchConversations(); // Update sidebar snippet for the sender
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      toast.error("Transmission Failed");
    }
  };

  return {
    conversations,
    messages,
    currentUserId,
    isLoadingConversations,
    isLoadingMessages,
    sendMessage,
    refetchConversations: fetchConversations,
  };
}
