import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useChat } from "@/hooks/useChat";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageSquare, Zap, X, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import LoadingState from "@/components/ui/LoadingState";
import { cn } from "@/lib/utils";

export default function Messages() {
  const navigate = useNavigate();
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);

  const { conversations, messages, currentUserId, isLoadingConversations, isLoadingMessages, sendMessage } =
    useChat(selectedConversationId);

  const mainThreads = conversations.filter(
    (c) => c.last_sender_id === currentUserId || c.display_name?.toLowerCase().includes("manager"),
  );
  const generalThreads = conversations.filter((c) => !mainThreads.find((m) => m.conversation_id === c.conversation_id));

  if (isLoadingConversations) return <LoadingState />;

  const renderConversationList = (threads: typeof conversations) => (
    <div className="space-y-2 py-2">
      {threads.map((conv) => {
        const isActive = selectedConversationId === conv.conversation_id;
        return (
          <button
            key={conv.conversation_id}
            onClick={() => setSelectedConversationId(conv.conversation_id)}
            className={cn(
              "w-full flex items-center gap-4 p-4 rounded-2xl transition-all duration-300 border border-transparent",
              isActive ? "bg-zinc-900 border-white/10 shadow-xl" : "hover:bg-white/5 active:scale-[0.98]",
            )}
          >
            <div className="relative">
              <Avatar className="h-12 w-12 border border-white/10">
                <AvatarImage src={conv.avatar_url || undefined} />
                <AvatarFallback className="bg-zinc-800 text-zinc-500">
                  <User className="h-5 w-5" />
                </AvatarFallback>
              </Avatar>
              {/* ✅ FIXED: Handled TS2339 by casting until hook update */}
              {(conv as any).unread_count > 0 && (
                <span className="absolute -top-1 -right-1 h-4 w-4 bg-neon-pink rounded-full border-2 border-black animate-pulse" />
              )}
            </div>

            <div className="flex-1 text-left min-w-0">
              <div className="flex justify-between items-start mb-0.5">
                <p className="text-sm font-bold text-white uppercase italic tracking-tight truncate">
                  {conv.display_name || "Neural User"}
                </p>
                <span className="text-[9px] font-black text-zinc-600 uppercase">
                  {/* ✅ FIXED: Changed last_message_time to last_message_at (TS2551) */}
                  {conv.last_message_at ? "Active" : ""}
                </span>
              </div>
              <p className="text-[10px] text-zinc-500 line-clamp-1 uppercase tracking-wider font-medium">
                {conv.last_message_content || "Open encrypted channel"}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="flex h-screen bg-black overflow-hidden pt-16">
      <div
        className={cn(
          "flex-col border-r border-white/5 bg-black transition-all duration-500",
          selectedConversationId ? "hidden md:flex w-80 lg:w-96" : "flex w-full",
        )}
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-neon-pink rounded-full shadow-[0_0_10px_#FF007F]" />
              <h1 className="text-3xl font-display uppercase tracking-tighter text-white italic leading-none">Comms</h1>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/")}
              className="h-9 w-9 rounded-xl bg-white/5 border border-white/10 text-zinc-500 hover:text-white"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <Tabs defaultValue="main" className="w-full">
            <TabsList className="w-full bg-zinc-900/50 border border-white/5 p-1 rounded-xl h-11">
              <TabsTrigger
                value="main"
                className="flex-1 text-[9px] font-black uppercase tracking-[0.2em] data-[state=active]:bg-neon-pink data-[state=active]:text-black rounded-lg transition-all"
              >
                Primary
              </TabsTrigger>
              <TabsTrigger
                value="general"
                className="flex-1 text-[9px] font-black uppercase tracking-[0.2em] data-[state=active]:bg-white data-[state=active]:text-black rounded-lg transition-all"
              >
                General
              </TabsTrigger>
            </TabsList>

            <TabsContent value="main" className="mt-4 outline-none">
              <ScrollArea className="h-[calc(100vh-280px)] pr-3">{renderConversationList(mainThreads)}</ScrollArea>
            </TabsContent>

            <TabsContent value="general" className="mt-4 outline-none">
              <ScrollArea className="h-[calc(100vh-280px)] pr-3">{renderConversationList(generalThreads)}</ScrollArea>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <div className={cn("flex-1 flex-col bg-black relative", selectedConversationId ? "flex" : "hidden md:flex")}>
        {selectedConversationId ? (
          <ChatWindow
            messages={messages}
            currentUserId={currentUserId}
            otherParticipant={conversations.find((c) => c.conversation_id === selectedConversationId) as any}
            isLoading={isLoadingMessages}
            onBack={() => setSelectedConversationId(null)}
            onSend={sendMessage}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="relative mb-6">
              <div className="absolute inset-0 blur-3xl bg-neon-pink/10 rounded-full animate-pulse" />
              <Zap className="h-12 w-12 text-zinc-900 relative z-10" />
            </div>
            <p className="text-[10px] font-black text-zinc-800 uppercase tracking-[0.5em] italic">Awaiting Selection</p>
          </div>
        )}
      </div>
    </div>
  );
}
