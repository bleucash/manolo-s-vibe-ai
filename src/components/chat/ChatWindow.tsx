import { useState, useRef, useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Send, ShieldCheck, User, Radio } from "lucide-react";
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
    <div className="flex flex-col h-full bg-background animate-in fade-in duration-500">
      {/* 🛠 NEURAL SUB-HUD (Aligned with Intel Feed Style) */}
      <div className="h-24 flex items-center gap-4 px-6 pt-6 bg-background/90 backdrop-blur-xl border-b border-white/5 z-20">
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          className="text-muted-foreground hover:text-white transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>

        <div className="relative">
          <Avatar className="h-11 w-11 border border-white/10 shadow-xl">
            <AvatarImage src={otherParticipant?.avatar_url} />
            <AvatarFallback className="bg-muted text-muted-foreground">
              <User className="h-5 w-5" />
            </AvatarFallback>
          </Avatar>
          <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-neon-green rounded-full border-2 border-background shadow-[var(--shadow-green)]" />
        </div>

        <div className="flex-1 min-w-0">
          <h2 className="font-display text-xl text-white uppercase tracking-wider italic leading-none">
            {otherParticipant?.display_name || "NEURAL NODE"}
          </h2>
          <div className="flex items-center gap-2 mt-1">
            <ShieldCheck className="h-3 w-3 text-neon-pink animate-pulse" />
            <p className="text-[8px] font-black text-muted-foreground uppercase tracking-[0.2em]">Uplink Encrypted</p>
          </div>
        </div>

        <div className="hidden md:block">
          <Radio className="w-4 h-4 text-neon-pink opacity-20" />
        </div>
      </div>

      {/* 🌐 TRANSMISSION STREAM */}
      <ScrollArea className="flex-1 px-6 hide-scrollbar" ref={scrollRef}>
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <div className="w-12 h-[1px] bg-neon-pink animate-pulse shadow-[var(--shadow-neon)]" />
            <span className="font-display text-sm text-muted-foreground uppercase tracking-[0.3em] animate-pulse">
              Syncing Transmissions
            </span>
          </div>
        ) : (
          <div className="py-10 space-y-8">
            {messages.map((message, idx) => {
              const isMe = message.sender_id === currentUserId;
              return (
                <div key={message.id || idx} className={cn("flex flex-col", isMe ? "items-end" : "items-start")}>
                  <div
                    className={cn(
                      "max-w-[80%] p-5 rounded-[2rem] transition-all duration-700 shadow-2xl",
                      isMe
                        ? "bg-neon-pink text-black font-medium rounded-br-none shadow-[0_15px_30px_rgba(255,0,127,0.25)]"
                        : "bg-card/40 text-foreground rounded-bl-none border border-white/5",
                    )}
                  >
                    <p className="text-[14px] leading-relaxed tracking-tight whitespace-pre-wrap">{message.content}</p>
                  </div>

                  {/* Timestamp aligned outside the bubble for cleaner aesthetics */}
                  <span
                    className={cn(
                      "text-[8px] mt-2 font-black uppercase tracking-[0.2em]",
                      isMe ? "text-neon-pink/60 mr-2" : "text-muted-foreground ml-2",
                    )}
                  >
                    {formatTime(message.created_at)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>

      {/* ⌨️ NEURAL UPLINK INPUT */}
      <div className="p-8 pb-32 bg-gradient-to-t from-background via-background to-transparent">
        <div className="flex items-center gap-4 bg-card/50 backdrop-blur-2xl rounded-[2.5rem] p-2 border border-white/5 focus-within:border-neon-pink/30 focus-within:shadow-[0_0_40px_rgba(255,0,127,0.1)] transition-all duration-500">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="TYPE TRANSMISSION..."
            className="flex-1 bg-transparent border-none text-white focus-visible:ring-0 text-[11px] font-black tracking-widest uppercase placeholder:text-zinc-800 h-12 px-6"
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!inputValue.trim()}
            className={cn(
              "h-12 w-12 rounded-full transition-all duration-500 active:scale-90 shadow-2xl",
              inputValue.trim()
                ? "bg-white text-black hover:bg-neon-pink hover:text-white"
                : "bg-zinc-900 text-zinc-700",
            )}
          >
            <Send className="h-5 w-5" />
          </Button>
        </div>

        {/* Visual feedback of the active channel */}
        <div className="flex justify-center mt-4">
          <div className="h-1 w-16 rounded-full bg-white/5" />
        </div>
      </div>
    </div>
  );
}
