import { useRef, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Heart, Share2, Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PostWithVenue } from "@/types/database";

interface VideoCardProps {
  post: PostWithVenue;
  isActive: boolean;
}

export function VideoCard({ post, isActive }: VideoCardProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const navigate = useNavigate();
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(post.likes_count ?? 0);

  useEffect(() => {
    if (!videoRef.current) return;
    
    if (isActive) {
      videoRef.current.play().catch(() => {
        // Autoplay may be blocked, handle gracefully
      });
    } else {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  }, [isActive]);

  const handleLike = () => {
    setLiked(!liked);
    setLikesCount((prev) => (liked ? prev - 1 : prev + 1));
  };

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/venue/${post.venue_id}?ref=${post.user_id}`;
    if (navigator.share) {
      await navigator.share({
        title: post.venues?.name ?? "Check this out",
        text: post.caption ?? "",
        url: shareUrl,
      });
    } else {
      await navigator.clipboard.writeText(shareUrl);
    }
  };

  const handleSecureEntry = () => {
    if (post.venue_id && post.user_id) {
      navigate(`/venue/${post.venue_id}?ref=${post.user_id}`);
    }
  };

  const displayName = post.profiles?.display_name ?? "Talent";
  const subRole = post.profiles?.sub_role ?? "Promoter";
  const venueName = post.venues?.name ?? "Venue";

  return (
    <div className="relative h-full w-full snap-start snap-always bg-background">
      {/* Video Player */}
      {post.video_url ? (
        <video
          ref={videoRef}
          src={post.video_url}
          poster={post.thumbnail_url ?? undefined}
          className="absolute inset-0 h-full w-full object-cover"
          loop
          muted
          playsInline
          preload="metadata"
        />
      ) : post.image_url ? (
        <img
          src={post.image_url}
          alt={post.caption ?? "Post"}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-card">
          <span className="text-muted-foreground">No media</span>
        </div>
      )}

      {/* Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />

      {/* Right Interaction Bar */}
      <div className="absolute right-4 bottom-32 flex flex-col items-center gap-6">
        <button
          onClick={handleLike}
          className="flex flex-col items-center gap-1 transition-transform active:scale-90"
        >
          <div
            className={`flex h-12 w-12 items-center justify-center rounded-full ${
              liked
                ? "bg-[hsl(var(--neon-green))]"
                : "bg-card/80 backdrop-blur-sm border border-border/50"
            }`}
          >
            <Heart
              className={`h-6 w-6 ${liked ? "fill-background text-background" : "text-foreground"}`}
            />
          </div>
          <span className="text-xs font-medium text-foreground">{likesCount}</span>
        </button>

        <button
          onClick={handleShare}
          className="flex flex-col items-center gap-1 transition-transform active:scale-90"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-card/80 backdrop-blur-sm border border-border/50">
            <Share2 className="h-6 w-6 text-foreground" />
          </div>
          <span className="text-xs font-medium text-foreground">Share</span>
        </button>
      </div>

      {/* Bottom Content Overlay */}
      <div className="absolute bottom-0 left-0 right-0 p-4 pb-6">
        {/* Talent Info */}
        <div className="mb-4">
          <h3 className="font-display text-2xl font-bold text-foreground tracking-wide">
            {displayName}
          </h3>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-sm text-[hsl(var(--neon-green))] font-medium">
              {subRole}
            </span>
            <span className="text-muted-foreground">•</span>
            <span className="text-sm text-muted-foreground">{venueName}</span>
          </div>
          {post.caption && (
            <p className="mt-2 text-sm text-foreground/80 line-clamp-2">
              {post.caption}
            </p>
          )}
        </div>

        {/* Secure Entry CTA */}
        <Button
          onClick={handleSecureEntry}
          className="w-full h-14 text-lg font-display tracking-wider bg-[hsl(var(--neon-green))] hover:bg-[hsl(var(--neon-green))]/90 text-background rounded-xl"
          style={{ boxShadow: "var(--shadow-green)" }}
        >
          <Ticket className="mr-2 h-5 w-5" />
          SECURE ENTRY
        </Button>
      </div>
    </div>
  );
}
