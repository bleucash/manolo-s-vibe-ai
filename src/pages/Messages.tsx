import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useUserMode } from "@/contexts/UserModeContext";
import { useChat } from "@/hooks/useChat";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageSquare, Zap, X, User, Inbox, ChevronRight, ArrowLeft, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import LoadingState from "@/components/ui/LoadingState";
import { cn } from "@/lib/utils";

export default function Messages() {
  const navigate = useNavigate();
  const { session, isLoading } = useUserMode();
  const [searchParams] = useSearchParams();

  // `?conversation=<id>` opens that thread directly. Callers have been
  // navigating here with this parameter since before it did anything:
  // GuestProfile's Message button built the URL, and nothing ever read it, so
  // the thread landed in the sidebar unselected. Invisible until now only
  // because that button never worked at all.
  //
  // Read once as the initial state rather than synced in an effect: the user
  // must stay free to click a different thread, and an effect would fight
  // them by dragging the selection back to the URL on every render.
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(
    () => searchParams.get("conversation"),
  );

  // Authenticated, any role: nothing here is role-specific, useChat keys
  // entirely off the signed-in user. Without this a signed-out visitor spins
  // forever, because useChat bails before the call that clears
  // isLoadingConversations, so the LoadingState below never resolves.
  useEffect(() => {
    if (!isLoading && !session) {
      navigate("/auth");
    }
  }, [session, isLoading, navigate]);

  const {
    conversations,
    requests,
    messages,
    currentUserId,
    isLoadingConversations,
    isLoadingMessages,
    sendMessage,
    respondToRequest,
  } = useChat(selectedConversationId);

  // The requests surface is a separate view, NOT a third tab. PRIMARY/GENERAL
  // already routes on a display-name substring and is on the cosmetic list for
  // the visual pass; threading requests into that split would tie this feature
  // to something already slated for rework. Keeping it outside means fixing
  // that split later touches none of this.
  const [showRequests, setShowRequests] = useState(false);
  const [respondingTo, setRespondingTo] = useState<string | null>(null);

  const handleRespond = async (conversationId: string, accept: boolean) => {
    setRespondingTo(conversationId);
    const ok = await respondToRequest(conversationId, accept);
    setRespondingTo(null);
    // Accepting drops you into the thread; declining leaves you in the queue,
    // which is now one shorter.
    if (ok && accept) {
      setShowRequests(false);
      setSelectedConversationId(conversationId);
    }
  };

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
              {/* Was `(conv as any).unread_count`, casting around a column
                  that did not exist. It is a real column now, so this reads
                  it directly and a future rename becomes a compile error. */}
              {conv.unread_count > 0 && (
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

          {/* Message requests. Sits above the tabs and outside them, so the
              PRIMARY/GENERAL split can be reworked without touching it. Only
              rendered when there is something waiting: an always-present empty
              row would be permanent furniture for the many accounts that never
              receive a request. */}
          {requests.length > 0 && !showRequests && (
            <button
              onClick={() => setShowRequests(true)}
              className="w-full mb-4 flex items-center gap-4 p-4 rounded-2xl bg-neon-pink/10 border border-neon-pink/20 hover:bg-neon-pink/15 transition-all active:scale-[0.98]"
            >
              <div className="h-10 w-10 rounded-xl bg-neon-pink/20 flex items-center justify-center">
                <Inbox className="h-4 w-4 text-neon-pink" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neon-pink">Message Requests</p>
                <p className="text-[9px] text-zinc-500 uppercase tracking-wider font-medium">
                  {requests.length} waiting
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-neon-pink/60" />
            </button>
          )}

          {showRequests ? (
            <div className="outline-none">
              <div className="flex items-center gap-3 mb-4">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowRequests(false)}
                  className="h-9 w-9 rounded-xl bg-white/5 border border-white/10 text-zinc-500 hover:text-white"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white">Message Requests</p>
              </div>

              <ScrollArea className="h-[calc(100vh-280px)] pr-3">
                <div className="space-y-3 py-2">
                  {requests.length === 0 && (
                    <p className="text-[10px] text-zinc-600 uppercase tracking-widest font-bold py-8 text-center">
                      No pending requests
                    </p>
                  )}

                  {requests.map((req) => (
                    <div
                      key={req.conversation_id}
                      className="p-4 rounded-2xl bg-zinc-900/60 border border-white/5 space-y-4"
                    >
                      <div className="flex items-center gap-4">
                        <Avatar className="h-12 w-12 border border-white/10">
                          <AvatarImage src={req.avatar_url || undefined} />
                          <AvatarFallback className="bg-zinc-800 text-zinc-500">
                            <User className="h-5 w-5" />
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-white uppercase italic tracking-tight truncate">
                            {req.display_name || "Neural User"}
                          </p>
                          {/* The message body is the whole point of showing a
                              request rather than just a name, which is why a
                              pending participant can still READ the thread. */}
                          <p className="text-[10px] text-zinc-500 line-clamp-2 tracking-wide font-medium">
                            {req.last_message_content || "Wants to connect"}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          onClick={() => req.conversation_id && handleRespond(req.conversation_id, true)}
                          disabled={respondingTo === req.conversation_id}
                          className="h-10 bg-neon-pink text-black text-[9px] font-black uppercase tracking-[0.2em] rounded-xl hover:bg-neon-pink/90"
                        >
                          <Check className="h-3 w-3 mr-1.5" /> Accept
                        </Button>
                        <Button
                          onClick={() => req.conversation_id && handleRespond(req.conversation_id, false)}
                          disabled={respondingTo === req.conversation_id}
                          variant="ghost"
                          className="h-10 bg-white/5 border border-white/10 text-zinc-400 text-[9px] font-black uppercase tracking-[0.2em] rounded-xl hover:text-white"
                        >
                          <X className="h-3 w-3 mr-1.5" /> Decline
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          ) : (
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
          )}
        </div>
      </div>

      <div className={cn("flex-1 flex-col bg-black relative", selectedConversationId ? "flex" : "hidden md:flex")}>
        {selectedConversationId ? (
          <ChatWindow
            messages={messages}
            currentUserId={currentUserId}
            otherParticipant={conversations.find((c) => c.conversation_id === selectedConversationId)}
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
