import { useState } from "react";
import { useChat } from "@/hooks/useChat";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MessageSquare, Users, Zap, Sparkles } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function Messages() {
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);

  const { conversations, messages, currentUserId, isLoadingConversations, isLoadingMessages, sendMessage } =
    useChat(selectedConversationId);

  const activeConversation = conversations.find((c) => c.conversation_id === selectedConversationId);

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
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch {
      return "Just now";
    }
  };

  /** * ✅ UNIVERSAL LOADER STRATEGY
   * Returning null here allows the ProtectedRoute/App Neural Engine
   * loader to persist until the conversations are fully loaded.
   */
  if (isLoadingConversations) {
    return null;
  }

  return (
    <div className="flex h-screen bg-black animate-in fade-in duration-500 pb-16 md:pb-0">
      {/* SIDEBAR: CONVERSATION LIST */}
      <div
        className={`${
          selectedConversationId ? "hidden md:flex" : "flex"
        } flex-col w-full md:w-80 lg:w-96 border-r border-white/5 bg-zinc-950`}
      >
        <div className="flex items-center justify-between p-6 border-b border-white/5">
          <div className="flex items-center gap-3">
            <MessageSquare className="h-6 w-6 text-neon-purple" />
            <h1 className="text-2xl font-display uppercase tracking-tighter text-white">Inbox</h1>
          </div>
          <Sparkles className="h-4 w-4 text-zinc-700" />
        </div>

        <ScrollArea className="flex-1">
          {conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 px-8 text-center">
              <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-6">
                <Users className="h-8 w-8 text-zinc-700" />
              </div>
              <p className="text-white font-display uppercase tracking-widest text-xs mb-2">No Intel Found</p>
              <p className="text-zinc-500 text-[10px] uppercase tracking-wider leading-relaxed">
                Connect with Talent or Managers to start a secure channel.
              </p>
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {conversations.map((convo) => {
                const isActive = convo.conversation_id === selectedConversationId;
                const isUnread = !convo.is_read && convo.last_sender_id !== currentUserId;

                return (
                  <button
                    key={convo.conversation_id}
                    onClick={() => setSelectedConversationId(convo.conversation_id)}
                    className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all active:scale-[0.98] ${
                      isActive
                        ? "bg-neon-purple/10 border border-neon-purple/20"
                        : "bg-transparent hover:bg-white/5 border border-transparent"
                    }`}
                  >
                    <div className="relative shrink-0">
                      <div
                        className={`p-[2px] rounded-full ${isUnread ? "bg-gradient-to-tr from-neon-purple to-neon-blue" : "bg-zinc-800"}`}
                      >
                        <Avatar className="h-12 w-12 border-2 border-black">
                          <AvatarImage src={convo.avatar_url ?? undefined} className="object-cover" />
                          <AvatarFallback className="bg-zinc-900 text-zinc-500 font-bold">
                            {convo.display_name?.charAt(0) ?? "?"}
                          </AvatarFallback>
                        </Avatar>
                      </div>
                      {isUnread && (
                        <span className="absolute -top-0.5 -right-0.5 h-4 w-4 bg-neon-purple rounded-full border-4 border-zinc-950 animate-pulse" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0 text-left">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <p
                          className={`text-xs font-black uppercase tracking-widest truncate ${
                            isUnread ? "text-white" : "text-zinc-400"
                          }`}
                        >
                          {convo.display_name ?? "Unknown Entity"}
                        </p>
                        <span className="text-[8px] font-bold text-zinc-600 uppercase tracking-tighter">
                          {formatTime(convo.last_message_at)}
                        </span>
                      </div>
                      <p
                        className={`text-[11px] truncate leading-none ${
                          isUnread ? "text-zinc-200 font-medium" : "text-zinc-600"
                        }`}
                      >
                        {convo.last_message_content ?? "Channel initialized..."}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* CHAT WINDOW */}
      <div className={`${selectedConversationId ? "flex" : "hidden md:flex"} flex-1 flex-col bg-zinc-950`}>
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
          <div className="flex flex-col items-center justify-center h-full">
            <div className="p-12 text-center">
              <Zap className="h-12 w-12 text-zinc-900 mx-auto mb-6" />
              <p className="text-[10px] font-black text-zinc-700 uppercase tracking-[0.4em]">
                Neural Link Awaiting Selection
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
