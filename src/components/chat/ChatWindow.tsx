import { useState, useRef, useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Send, ShieldCheck, User } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface ChatWindowProps {
  messages: any[];
  currentUserId: string | null;
  otherParticipant: any;
  isLoading: boolean;
  onBack: () => void;
  onSend: (content: string) => void;
}

export function ChatWindow({ messages, currentUserId, otherParticipant, isLoading, onBack, onSend }: ChatWindowProps) {
  const [inputValue, setInputValue] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      const scrollContainer = scrollRef.current.querySelector("[data-radix-scroll-area-viewport]");
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages, isLoading]);

  const handleSend = () => {
    if (inputValue.trim()) {
      onSend(inputValue);
      setInputValue("");
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return format(date, "h:mm a");
  };

  return (
    <div className="flex flex-col h-full bg-black">
      {/* HEADER */}
      <div className="flex items-center gap-4 p-5 border-b border-white/5 bg-black/95 backdrop-blur-xl">
        <Button variant="ghost" size="icon" onClick={onBack} className="md:hidden text-white">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="relative">
          <Avatar className="h-10 w-10 border border-white/10">
            <AvatarImage src={otherParticipant?.avatar_url} />
            <AvatarFallback className="bg-zinc-900 text-zinc-500">
              <User className="h-4 w-4" />
            </AvatarFallback>
          </Avatar>
          <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-neon-green rounded-full border-2 border-black" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white uppercase italic tracking-tight truncate">
            {otherParticipant?.display_name || "Neural User"}
          </p>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-3 w-3 text-neon-pink" />
            <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Encrypted Channel</p>
          </div>
        </div>
      </div>

      {/* MESSAGES AREA */}
      <ScrollArea className="flex-1 px-6" ref={scrollRef}>
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <div className="w-8 h-[1px] bg-neon-pink animate-pulse" />
            <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest animate-pulse">
              Syncing Ledger
            </span>
          </div>
        ) : (
          <div className="py-8 space-y-6">
            {messages.map((message, idx) => {
              const isMe = message.sender_id === currentUserId;
              return (
                <div key={message.id || idx} className={cn("flex", isMe ? "justify-end" : "justify-start")}>
                  <div
                    className={cn(
                      "max-w-[85%] p-4 rounded-3xl transition-all duration-500",
                      isMe
                        ? "bg-neon-pink text-black font-medium rounded-br-none shadow-[0_10px_20px_rgba(255,0,127,0.2)]"
                        : "bg-zinc-900 text-zinc-200 rounded-bl-none border border-white/5",
                    )}
                  >
                    <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{message.content}</p>
                    <p
                      className={cn(
                        "text-[8px] mt-2 font-black uppercase tracking-widest",
                        isMe ? "text-black/50" : "text-zinc-600",
                      )}
                    >
                      {formatTime(message.created_at)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>

      {/* INPUT AREA: Extra padding-bottom for BottomNav spacing */}
      <div className="p-6 pb-32 border-t border-white/5 bg-black/95 backdrop-blur-xl">
        <div className="flex items-center gap-3 bg-zinc-900 rounded-[2rem] p-1.5 border border-white/5 focus-within:border-neon-pink/50 transition-all">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Type your transmission..."
            className="flex-1 bg-transparent border-none text-white focus-visible:ring-0 text-sm placeholder:text-zinc-700 h-10 px-4"
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!inputValue.trim()}
            className="h-10 w-10 rounded-full bg-white text-black hover:bg-neon-pink hover:text-white transition-all active:scale-90"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
