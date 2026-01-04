import { useState, useRef, useEffect } from "react";
import { PostWithVenue } from "@/types/database";
import { Heart, Share2, Ticket, MapPin, Briefcase, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useUserMode } from "@/contexts/UserModeContext";
import { cn } from "@/lib/utils";

interface VideoCardProps {
  post: PostWithVenue;
  isActive: boolean;
}

export function VideoCard({ post, isActive }: VideoCardProps) {
  const navigate = useNavigate();
  const { mode, session } = useUserMode();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isLiked, setIsLiked] = useState(false);

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

  // Role-based Action Mapping
  const getActionConfig = () => {
    if (!session) {
      return {
        label: "Secure Entry",
        icon: <Ticket className="mr-2 w-5 h-5" />,
        action: () => navigate(`/venue/${post.venue_id}?ref=${post.user_id}`)
      };
    }

    switch (mode) {
      case "talent":
        return {
          label: "Apply to Perform",
          icon: <Briefcase className="mr-2 w-5 h-5" />,
          action: () => navigate(`/venue/${post.venue_id}`)
        };
      case "manager":
        return {
          label: "Claim Venue",
          icon: <ShieldCheck className="mr-2 w-5 h-5" />,
          action: () => navigate(`/venue/${post.venue_id}`)
        };
      default:
        return {
          label: "Secure Entry",
          icon: <Ticket className="mr-2 w-5 h-5" />,
          action: () => navigate(`/venue/${post.venue_id}?ref=${post.user_id}`)
        };
    }
  };

  const config = getActionConfig();

  return (
    <div className="relative h-full w-full bg-black overflow-hidden">
      <video
        ref={videoRef}
        src={post.media_url}
        className="h-full w-full object-cover"
        loop
        playsInline
        muted
      />

      <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/90" />

      <div className="absolute right-4 bottom-32 flex flex-col gap-6 z-20">
        <button onClick={() => setIsLiked(!isLiked)} className="flex flex-col items-center gap-1">
          <Heart className={cn("w-8 h-8", isLiked ? "fill-[hsl(150,100%,50%)] text-[hsl(150,100%,50%)]" : "text-white")} />
          <span className="text-[10px] font-bold text-white uppercase tracking-widest">Like</span>
        </button>
        <button className="flex flex-col items-center gap-1">
          <Share2 className="w-8 h-8 text-white" />
          <span className="text-[10px] font-bold text-white uppercase tracking-widest">Share</span>
        </button>
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-6 space-y-4 z-10">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div
              onClick={() => navigate(`/talent/${post.profiles?.id}`)}
              className="w-10 h-10 rounded-full border-2 border-[hsl(150,100%,50%)] overflow-hidden cursor-pointer"
            >
              <img src={post.profiles?.avatar_url || ""} className="w-full h-full object-cover" alt="avatar" />
            </div>
            <div>
              <p className="text-white font-black uppercase tracking-tighter text-lg leading-none">
                {post.profiles?.display_name || "Anonymous Talent"}
              </p>
              <p className="text-[hsl(150,100%,50%)] text-[9px] font-bold uppercase tracking-widest">
                {post.profiles?.sub_role || "Performer"}
              </p>
            </div>
          </div>

          <p className="text-zinc-300 text-sm line-clamp-2">{post.