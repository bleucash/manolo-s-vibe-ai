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

  if (isLoadingConversations) return null;

  return (
    <div className="flex min-h-screen bg-black animate-in fade-in duration-500 pb-32 pt-16 overflow-hidden">
      {/* SIDEBAR */}
      <div
        className={`${selectedConversationId ? "hidden md:flex" : "flex"} flex-col w-full md:w-80 lg:w-96 border-r border-white/5 bg-black`}
      >
        <div className="p-6 border-b border-white/5">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <MessageSquare className="h-5 w-5 text-neon-pink" />
              <h1 className="text-3xl font-display uppercase tracking-tighter text-white italic">Comms</h1>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/")}
              className="h-8 w-8 rounded-full bg-white/5 border border-white/10 text-zinc-400 hover:text-white"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <Tabs defaultValue="main" className="w-full">
            <TabsList className="w-full bg-white/5 border border-white/10 p-1 rounded-xl h-10">
              <TabsTrigger
                value="main"
                className="flex-1 text-[9px] font-black uppercase tracking-widest data-[state=active]:bg-neon-pink data-[state=active]:text-black rounded-lg"
              >
                Main
              </TabsTrigger>
              <TabsTrigger
                value="general"
                className="flex-1 text-[9px] font-black uppercase tracking-widest data-[state=active]:bg-zinc-800 data-[state=active]:text-white rounded-lg"
              >
                General
              </TabsTrigger>
            </TabsList>
            <TabsContent value="main" className="mt-4 outline-none">
              <ScrollArea className="h-[calc(100vh-280px)]">
                {/* ... Same thread mapping logic as before ... */}
              </ScrollArea>
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
            otherParticipant={null}
            isLoading={isLoadingMessages}
            onBack={() => setSelectedConversationId(null)}
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
