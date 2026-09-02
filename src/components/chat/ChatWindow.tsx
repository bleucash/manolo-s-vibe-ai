import { useState, useRef, useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Send, ShieldCheck, User, Radio } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import type { Message } from "@/hooks/useChat";

interface ChatWindowProps {
  messages: Message[];
  currentUserId: string | null;
  /**
   * The thread being rendered, narrowed to the fields this component reads
   * rather than `any`. As `any` this was the one boundary in messaging where a
   * removed column could still be read without failing the typecheck; naming
   * the fields makes the compiler enforce that instead of it resting on
   * someone having grepped once.
   *
   * `thread_title` rather than `display_name`, and this is the correction that
   * matters: display_name is the COUNTERPARTY's name, which is only the right
   * header for a dm. A venue thread with an owner plus one staff member has
   * exactly one other participant, so display_name is populated and the thread
   * renders as that person -- which is what shipped, and why both real venue
   * threads showed a staff member's name instead of the venue's.
   * thread_title resolves correctly for all three kinds.
   */
  thread:
    | {
        kind: string | null;
        thread_title: string | null;
        avatar_url: string | null;
        member_avatars: string[] | null;
      }
    | undefined;
  isLoading: boolean;
  onLoadOlder?: () => void;
  hasMoreMessages?: boolean;
  isLoadingOlder?: boolean;
  onBack: () => void;
  onSend: (content: string) => void;
}

export function ChatWindow({
  messages,
  currentUserId,
  thread,
  isLoading,
  onLoadOlder,
  hasMoreMessages,
  isLoadingOlder,
  onBack,
  onSend,
}: ChatWindowProps) {
  const [inputValue, setInputValue] = useState("");

  // A dm has a single counterparty, so avatar_url is the right face. A venue
  // or group thread has no single face; member_avatars is capped at three and
  // is NOT a member count, so only its first entry is used here.
  const headerAvatar = (thread?.kind === "dm" ? thread?.avatar_url : thread?.member_avatars?.[0]) || undefined;
  const scrollRef = useRef<HTMLDivElement>(null);
  // What the viewport looked like before this render, so a prepend can be
  // distinguished from an append and compensated for.
  const prevRef = useRef<{ firstId?: string; scrollHeight: number; scrollTop: number; clientHeight: number }>({
    scrollHeight: 0,
    scrollTop: 0,
    clientHeight: 0,
  });

  /**
   * Scroll behaviour, three cases rather than one.
   *
   * This effect used to be an unconditional `scrollTop = scrollHeight` on every
   * change to `messages`, which was fine when a thread loaded once and only
   * ever grew at the bottom. Pagination broke that assumption in both
   * directions: loading older messages PREPENDS, so the unconditional scroll
   * dumped the reader at the newest message the instant they asked for older
   * ones -- and a message arriving while they were scrolled back yanked them
   * away from what they were reading. The merge was never the problem; where
   * the viewport pointed was.
   *
   *   PREPEND  -- the first message changed identity. Hold the reader's visual
   *               position by adding the height that appeared above them.
   *               Never scroll.
   *   APPEND   -- only follow to the bottom if they were ALREADY near it.
   *               Someone reading history is not interested in being moved.
   *   INITIAL  -- land at the bottom, which is what opening a thread means.
   */
  useEffect(() => {
    const el = scrollRef.current?.querySelector("[data-radix-scroll-area-viewport]") as HTMLElement | null;
    if (!el) return;

    const prev = prevRef.current;
    const firstId = messages[0]?.id;
    const isPrepend = prev.firstId !== undefined && firstId !== undefined && prev.firstId !== firstId;
    // 80px of slack so "almost at the bottom" still counts as following along.
    const wasNearBottom = prev.scrollHeight - prev.scrollTop - prev.clientHeight < 80;

    if (isPrepend) {
      el.scrollTop = prev.scrollTop + (el.scrollHeight - prev.scrollHeight);
    } else if (prev.firstId === undefined || wasNearBottom) {
      el.scrollTop = el.scrollHeight;
    }

    prevRef.current = {
      firstId,
      scrollHeight: el.scrollHeight,
      scrollTop: el.scrollTop,
      clientHeight: el.clientHeight,
    };
  }, [messages, isLoading]);

  // Keep the remembered offsets current as the reader scrolls, so the next
  // message change can tell where they were.
  useEffect(() => {
    const el = scrollRef.current?.querySelector("[data-radix-scroll-area-viewport]") as HTMLElement | null;
    if (!el) return;
    const onScroll = () => {
      prevRef.current = {
        ...prevRef.current,
        scrollHeight: el.scrollHeight,
        scrollTop: el.scrollTop,
        clientHeight: el.clientHeight,
      };
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

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
            <AvatarImage src={headerAvatar} />
            <AvatarFallback className="bg-muted text-muted-foreground">
              <User className="h-5 w-5" />
            </AvatarFallback>
          </Avatar>
          <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-neon-green rounded-full border-2 border-background shadow-[var(--shadow-green)]" />
        </div>

        <div className="flex-1 min-w-0">
          <h2 className="font-display text-xl text-white uppercase tracking-wider italic leading-none">
            {thread?.thread_title || "NEURAL NODE"}
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
            {/* A button rather than a scroll listener. Scroll-triggered loading
                has to fight the browser's scroll anchoring to stop the reader's
                position jumping when rows prepend; an explicit control is
                simpler and honest about what it does. */}
            {hasMoreMessages && (
              <div className="flex justify-center pb-2">
                <Button
                  variant="ghost"
                  onClick={onLoadOlder}
                  disabled={isLoadingOlder}
                  className="h-9 px-5 rounded-full bg-white/5 border border-white/10 text-zinc-500 hover:text-white text-[9px] font-black uppercase tracking-[0.2em]"
                >
                  {isLoadingOlder ? "Loading" : "Load earlier messages"}
                </Button>
              </div>
            )}
            {messages.map((message, idx) => {
              const isMe = message.sender_id === currentUserId;

              // Attribution is for threads with more than two people. In a dm
              // the header already names the counterparty, so repeating it on
              // every incoming bubble is noise.
              const isMultiParty = thread?.kind === "venue" || thread?.kind === "group";

              // Computed at RENDER time from the neighbour in the current
              // array, deliberately not stored on the message. When an older
              // page prepends, the message that used to be first suddenly has
              // a predecessor -- and if that predecessor is the same sender,
              // its now-redundant attribution has to disappear on its own.
              // Anything memoised per message would keep showing it.
              const prev = messages[idx - 1];
              const startsRun = !prev || prev.sender_id !== message.sender_id;
              const showAttribution = isMultiParty && !isMe && startsRun;

              return (
                <div key={message.id || idx} className={cn("flex flex-col", isMe ? "items-end" : "items-start")}>
                  {showAttribution && (
                    <div className="flex items-center gap-2 mb-1.5 ml-1">
                      <Avatar className="h-5 w-5 border border-white/10">
                        <AvatarImage src={message.sender?.avatar_url || undefined} />
                        <AvatarFallback className="bg-zinc-800 text-zinc-500">
                          <User className="h-2.5 w-2.5" />
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.15em]">
                        {message.sender?.display_name || "Neural User"}
                      </span>
                    </div>
                  )}
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
