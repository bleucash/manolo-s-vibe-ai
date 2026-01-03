import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface ConversationSummary {
  conversation_id: string | null;
  participant_id: string | null;
  display_name: string | null;
  avatar_url: string | null;
  last_message_content: string | null;
  last_message_at: string | null;
  last_sender_id: string | null;
  is_read: boolean | null;
  updated_at: string | null;
}

interface Message {
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

  // Get current user
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id ?? null);
    };
    getUser();
  }, []);

  // Fetch conversations from conversation_summary view
  const fetchConversations = useCallback(async () => {
    if (!currentUserId) return;
    
    setIsLoadingConversations(true);
    try {
      const { data, error } = await supabase
        .from("conversation_summary")
        .select("*")
        .neq("participant_id", currentUserId)
        .order("last_message_at", { ascending: false });

      if (error) throw error;
      setConversations(data ?? []);
    } catch (err) {
      console.error("Failed to fetch conversations:", err);
    } finally {
      setIsLoadingConversations(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    if (currentUserId) {
      fetchConversations();
    }
  }, [currentUserId, fetchConversations]);

  // Fetch messages for selected conversation
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

      // Mark unread messages as read
      const unreadIds = (data ?? [])
        .filter((m) => !m.is_read && m.sender_id !== currentUserId)
        .map((m) => m.id);

      if (unreadIds.length > 0) {
        await supabase
          .from("messages")
          .update({ is_read: true })
          .in("id", unreadIds);
      }
    } catch (err) {
      console.error("Failed to fetch messages:", err);
    } finally {
      setIsLoadingMessages(false);
    }
  }, [selectedConversationId, currentUserId]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Subscribe to new messages
  useEffect(() => {
    if (!selectedConversationId) return;

    const channel = supabase
      .channel(`messages:${selectedConversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${selectedConversationId}`,
        },
        (payload) => {
          const newMessage = payload.new as Message;
          setMessages((prev) => [...prev, newMessage]);

          // Mark as read if not sender
          if (newMessage.sender_id !== currentUserId) {
            supabase
              .from("messages")
              .update({ is_read: true })
              .eq("id", newMessage.id);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedConversationId, currentUserId]);

  const sendMessage = async (content: string) => {
    if (!selectedConversationId || !currentUserId || !content.trim()) return;

    const { error } = await supabase.from("messages").insert({
      conversation_id: selectedConversationId,
      sender_id: currentUserId,
      content: content.trim(),
    });

    if (error) {
      console.error("Failed to send message:", error);
      throw error;
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
