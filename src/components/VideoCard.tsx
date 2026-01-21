import { useState, useRef, useEffect } from "react";
import { PostWithVenue } from "@/types/database";
import { Heart, Share2, Ticket, MapPin, Briefcase, ShieldCheck, User, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useUserMode } from "@/contexts/UserModeContext";
import { cn } from "@/lib/utils";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

interface VideoCardProps {
  post: PostWithVenue;
  isActive: boolean;
}

export function VideoCard({ post, isActive }: VideoCardProps) {
  const navigate = useNavigate();
  const { mode, session } = useUserMode();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isLiked, setIsLiked] = useState(false);

  // ⚡ NEURAL PLAYBACK ENGINE
  useEffect(() => {
    if (videoRef.current) {
      if (isActive) {
        videoRef.current.play().catch(() => {});
      } else {
        videoRef.current.pause();
        videoRef.current.currentTime = 0;
      }
    }
  }, [isActive]);

  // 🎯 COLLISION LOGIC: Role-Based Action Configuration
  const getActionConfig = () => {
    if (!session) {
      return {
        label: "Secure Entry",
        icon: <Ticket className="mr-2 w-5 h-5 fill-black" />,
        action: () => navigate(`/venue/${post.venue_id}?ref=${post.user_id}`),
        color: "bg-[#39FF14]", // Neon Green
      };
    }

    switch (mode) {
      case "talent":
        return {
          label: "Apply to Perform",
          icon: <Briefcase className="mr-2 w-5 h-5" />,
          action: () => navigate(`/venue/${post.venue_id}`),
          color: "bg-white", // Clean white for Talent Workstation entry
        };
      case "manager":
        return {
          label: "Venue Dashboard",
          icon: <ShieldCheck className="mr-2 w-5 h-5" />,
          action: () => navigate(`/dashboard`),
          color: "bg-zinc-200",
        };
      default:
        return {
          label: "Secure Entry",
          icon: <Ticket className="mr-2 w-5 h-5 fill-black" />,
          action: () => navigate(`/venue/${post.venue_id}?ref=${post.user_id}`),
          color: "bg-[#39FF14]",
        };
    }
  };

  const config = getActionConfig();

  return (
    <div className="relative h-full w-full bg-black overflow-hidden group">
      {/* 📹 THE FEED ENGINE */}
      <video ref={videoRef} src={post.media_url} className="h-full w-full object-cover" loop playsInline muted />

      {/* 🌑 NEURAL VIGNETTE */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/90" />

      {/* ⚡ RIGHT-SIDE INTERACTION DECK */}
      <div className="absolute right-4 bottom-36 flex flex-col gap-8 z-20 animate-in slide-in-from-right duration-700">
        <button onClick={() => setIsLiked(!isLiked)} className="flex flex-col items-center gap-1 group/btn">
          <Heart
            className={cn(
              "w-9 h-9 transition-all duration-300",
              isLiked ? "fill-[#39FF14] text-[#39FF14] scale-110" : "text-white group-hover/btn:scale-110",
            )}
          />
          <span className="text-[9px] font-black text-white uppercase tracking-[0.2em] opacity-80">Like</span>
        </button>

        <button className="flex flex-col items-center gap-1 group/btn">
          <Share2 className="w-9 h-9 text-white group-hover/btn:scale-110 transition-transform" />
          <span className="text-[9px] font-black text-white uppercase tracking-[0.2em] opacity-80">Share</span>
        </button>

        <div className="w-9 h-9 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center animate-pulse">
          <Zap className="w-4 h-4 text-[#39FF14] fill-[#39FF14]" />
        </div>
      </div>

      {/* 🛠️ INFO & ACTION OVERLAY */}
      <div className="absolute bottom-0 left-0 right-0 p-6 pb-10 space-y-6 z-10 animate-in fade-in slide-in-from-bottom-4 duration-1000">
        <div className="space-y-3">
          {/* Talent Identity */}
          <div className="flex items-center gap-3">
            <div
              onClick={() => navigate(`/talent/${post.profiles?.id}`)}
              className="w-12 h-12 rounded-full border-2 border-[#39FF14] p-0.5 overflow-hidden cursor-pointer bg-zinc-900 transition-transform hover:scale-105"
            >
              <Avatar className="w-full h-full">
                <AvatarImage src={post.profiles?.avatar_url || ""} className="object-cover" />
                <AvatarFallback className="bg-zinc-800">
                  <User className="w-6 h-6 text-zinc-500" />
                </AvatarFallback>
              </Avatar>
            </div>
            <div>
              <p className="text-white font-black uppercase tracking-tighter text-xl leading-none italic">
                {post.profiles?.display_name || "Anonymous Talent"}
              </p>
              <p className="text-[#39FF14] text-[10px] font-black uppercase tracking-[0.3em] mt-1">
                {post.profiles?.sub_role || "Spotlight Performer"}
              </p>
            </div>
          </div>

          {/* Description */}
          <p className="text-zinc-200 text-sm font-medium leading-relaxed line-clamp-2 max-w-[85%]">{post.content}</p>

          {/* Venue Location Tag */}
          <div
            onClick={() => navigate(`/venue/${post.venue_id}`)}
            className="flex items-center gap-2 text-zinc-400 cursor-pointer hover:text-white transition-colors"
          >
            <MapPin className="w-3.5 h-3.5 text-neon-pink" />
            <span className="text-[10px] font-black uppercase tracking-[0.25em]">
              {post.venues?.name || "Neural Outpost"}
            </span>
          </div>
        </div>

        {/* ⚡ THE MAIN COLLISION BUTTON */}
        <Button
          onClick={config.action}
          className={cn(
            "w-full h-16 text-black font-black uppercase tracking-[0.3em] rounded-2xl transition-all active:scale-[0.98] shadow-2xl",
            config.color,
            "hover:bg-white",
          )}
        >
          {config.icon}
          {config.label}
        </Button>
      </div>
    </div>
  );
}
