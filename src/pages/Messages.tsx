import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useChat } from "@/hooks/useChat";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageSquare, Zap, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";

export default function Messages() {
  const navigate = useNavigate();
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);

  const { conversations, messages, currentUserId, isLoadingConversations, isLoadingMessages, sendMessage } =
    useChat(selectedConversationId);

  const mainThreads = conversations.filter(
    (c) => c.last_sender_id === currentUserId || c.display_name?.toLowerCase().includes("manager"),
  );

  const generalThreads = conversations.filter((c) => !mainThreads.find((m) => m.conversation_id === c.conversation_id));

  const activeConversation = conversations.find((c) => c.conversation_id === selectedConversationId);

  const otherParticipant = activeConversation
    ? {
        id: activeConversation.participant_id,
        display_name: activeConversation.display_name,
        avatar_url: activeConversation.avatar_url,
      }
    : null;

  const handleBack = () => setSelectedConversationId(null);

  const handleExit = () => {
    if (selectedConversationId && window.innerWidth < 768) {
      handleBack();
    } else {
      navigate("/");
    }
  };

  const formatTime = (dateString: string | null) => {
    if (!dateString) return "";
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch {
      return "Just now";
    }
  };

  if (isLoadingConversations) return null;

  const ThreadList = ({ threads }: { threads: typeof conversations }) => (
    // ✅ Use a height that accounts for the fixed header and the BottomNav
    <ScrollArea className="h-[calc(100vh-240px)]">
      {threads.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 px-8 text-center">
          <p className="text-zinc-600 text-[10px] font-black uppercase tracking-widest">No Intelligence Found</p>
        </div>
      ) : (
        <div className="p-2 space-y-1">
          {threads.map((convo) => {
            const isUnread = !convo.is_read && convo.last_sender_id !== currentUserId;
            return (
              <button
                key={convo.conversation_id}
                onClick={() => setSelectedConversationId(convo.conversation_id)}
                className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all ${
                  convo.conversation_id === selectedConversationId
                    ? "bg-neon-pink/10 border border-neon-pink/20"
                    : "bg-transparent hover:bg-white/5 border border-transparent"
                }`}
              >
                <div className="relative shrink-0">
                  <Avatar className="h-12 w-12 border border-white/10">
                    <AvatarImage src={convo.avatar_url ?? undefined} className="object-cover" />
                    <AvatarFallback className="bg-zinc-900 text-zinc-600 font-bold uppercase">
                      {convo.display_name?.charAt(0) ?? "?"}
                    </AvatarFallback>
                  </Avatar>
                  {isUnread && (
                    <span className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 bg-neon-pink rounded-full border-4 border-black animate-pulse shadow-[0_0_10px_#FF007F]" />
                  )}
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p
                      className={`text-[11px] font-black uppercase tracking-widest truncate ${isUnread ? "text-white" : "text-zinc-500"}`}
                    >
                      {convo.display_name ?? "User"}
                    </p>
                    <span className="text-[8px] font-bold text-zinc-700 uppercase">
                      {formatTime(convo.last_message_at)}
                    </span>
                  </div>
                  <p
                    className={`text-xs truncate leading-none ${isUnread ? "text-zinc-300 font-medium" : "text-zinc-600"}`}
                  >
                    {convo.last_message_content ?? "Neural path opened..."}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </ScrollArea>
  );

  return (
    // ✅ min-h-screen + SAME pb-32 as Discovery/Home to lock the Nav position
    <div className="flex min-h-screen bg-black animate-in fade-in duration-500 pb-32 overflow-hidden">
      {/* SIDEBAR */}
      <div
        className={`${selectedConversationId ? "hidden md:flex" : "flex"} flex-col w-full md:w-80 lg:w-96 border-r border-white/5 bg-black`}
      >
        <div className="p-6 pt-16 border-b border-white/5">
          {" "}
          {/* Added pt-16 to match Discovery header start */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <MessageSquare className="h-5 w-5 text-neon-pink" />
              <h1 className="text-3xl font-display uppercase tracking-tighter text-white italic">Comms</h1>
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={handleExit}
              className="h-8 w-8 rounded-full bg-white/5 border border-white/10 text-zinc-400 hover:text-white"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <Tabs defaultValue="main" className="w-full">
            <TabsList className="w-full bg-white/5 border border-white/10 p-1 rounded-xl h-10">
              <TabsTrigger
                value="main"
                className="flex-1 text-[9px] font-black uppercase tracking-widest data-[state=active]:bg-neon-pink data-[state=active]:text-black rounded-lg transition-all"
              >
                Main
              </TabsTrigger>
              <TabsTrigger
                value="general"
                className="flex-1 text-[9px] font-black uppercase tracking-widest data-[state=active]:bg-zinc-800 data-[state=active]:text-white rounded-lg transition-all"
              >
                General
              </TabsTrigger>
            </TabsList>

            <TabsContent value="main" className="mt-4 outline-none">
              <ThreadList threads={mainThreads} />
            </TabsContent>
            <TabsContent value="general" className="mt-4 outline-none">
              <ThreadList threads={generalThreads} />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* CHAT WINDOW */}
      <div className={`${selectedConversationId ? "flex" : "hidden md:flex"} flex-1 flex-col bg-black relative`}>
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
          <div className="flex flex-col items-center justify-center h-full opacity-10">
            <Zap className="h-12 w-12 text-white mb-4 animate-pulse" />
            <p className="text-[10px] font-black text-white uppercase tracking-[0.4em]">Awaiting Selection</p>
          </div>
        )}
      </div>
    </div>
  );
}
