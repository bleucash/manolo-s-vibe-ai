import { useState } from "react";
import { useChat } from "@/hooks/useChat";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MessageSquare, Users, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function Messages() {
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  
  const {
    conversations,
    messages,
    currentUserId,
    isLoadingConversations,
    isLoadingMessages,
    sendMessage,
  } = useChat(selectedConversationId);

  // Find the other participant for the active conversation
  const activeConversation = conversations.find(
    (c) => c.conversation_id === selectedConversationId
  );

  const otherParticipant = activeConversation
    ? {
        id: activeConversation.participant_id,
        display_name: activeConversation.display_name,
        avatar_url: activeConversation.avatar_url,
      }
    : null;

  const handleBack = () => {
    setSelectedConversationId(null);
  };

  const formatTime = (dateString: string | null) => {
    if (!dateString) return "";
    return formatDistanceToNow(new Date(dateString), { addSuffix: true });
  };

  // Loading state
  if (isLoadingConversations) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background animate-in fade-in duration-500">
      {/* Sidebar - Conversation List */}
      <div
        className={`${
          selectedConversationId ? "hidden md:flex" : "flex"
        } flex-col w-full md:w-80 lg:w-96 border-r border-white/10 bg-zinc-950`}
      >
        {/* Header */}
        <div className="flex items-center gap-3 p-4 border-b border-white/10">
          <MessageSquare className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-black uppercase tracking-widest text-white">
            Messages
          </h1>
        </div>

        {/* Conversations List */}
        <ScrollArea className="flex-1">
          {conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
              <Users className="h-12 w-12 text-zinc-600 mb-4" />
              <p className="text-zinc-500 font-medium">No conversations yet</p>
              <p className="text-zinc-600 text-sm mt-1">
                Start chatting with your network
              </p>
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {conversations.map((convo) => {
                const isActive = convo.conversation_id === selectedConversationId;
                const isUnread =
                  !convo.is_read && convo.last_sender_id !== currentUserId;

                return (
                  <button
                    key={convo.conversation_id}
                    onClick={() => setSelectedConversationId(convo.conversation_id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${
                      isActive
                        ? "bg-primary/20 border border-primary/30"
                        : "bg-white/5 hover:bg-white/10 border border-transparent"
                    }`}
                  >
                    <div className="relative">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={convo.avatar_url ?? undefined} />
                        <AvatarFallback className="bg-primary/20 text-primary font-bold">
                          {convo.display_name?.charAt(0) ?? "?"}
                        </AvatarFallback>
                      </Avatar>
                      {isUnread && (
                        <span className="absolute -top-0.5 -right-0.5 h-3 w-3 bg-primary rounded-full border-2 border-zinc-950" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <div className="flex items-center justify-between gap-2">
                        <p
                          className={`font-semibold truncate ${
                            isUnread ? "text-white" : "text-zinc-300"
                          }`}
                        >
                          {convo.display_name ?? "User"}
                        </p>
                        <span className="text-[10px] text-zinc-500 whitespace-nowrap">
                          {formatTime(convo.last_message_at)}
                        </span>
                      </div>
                      <p
                        className={`text-sm truncate ${
                          isUnread
                            ? "text-zinc-300 font-medium"
                            : "text-zinc-500"
                        }`}
                      >
                        {convo.last_message_content ?? "No messages yet"}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Main Chat Area */}
      <div
        className={`${
          selectedConversationId ? "flex" : "hidden md:flex"
        } flex-1 flex-col`}
      >
        {selectedConversationId ? (
          <ChatWindow
            messages={messages}
            currentUserId={currentUserId}
            otherParticipant={otherParticipant}
            isLoading={isLoadingMessages}
            onBack={handleBack}
            onSend={sendMessage}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full bg-zinc-950/50">
            <div className="p-6 rounded-2xl bg-white/5 border border-white/10">
              <MessageSquare className="h-16 w-16 text-primary/50 mx-auto mb-4" />
              <p className="text-zinc-400 font-medium text-center">
                Select a conversation
              </p>
              <p className="text-zinc-600 text-sm text-center mt-1">
                Choose from your existing chats
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
