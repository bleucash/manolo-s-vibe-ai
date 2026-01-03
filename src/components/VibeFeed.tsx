import { useRef, useEffect, useState } from "react";
import { VideoCard } from "./VideoCard";
import { Loader2, WifiOff, Film } from "lucide-react";

interface PostWithVenue {
  id: string;
  user_id: string | null;
  venue_id: string | null;
  image_url: string | null;
  video_url: string | null;
  thumbnail_url: string | null;
  caption: string | null;
  likes_count: number | null;
  ai_vibe_score: number | null;
  status: string | null;
  created_at: string | null;
  venues: {
    id: string;
    name: string;
    category: string | null;
  } | null;
  profiles?: {
    display_name: string | null;
    sub_role: string | null;
    avatar_url: string | null;
  } | null;
}

interface VibeFeedProps {
  posts: PostWithVenue[];
  isLoading: boolean;
  isError: boolean;
}

export function VibeFeed({ posts, isLoading, isError }: VibeFeedProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || posts.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = Number(entry.target.getAttribute("data-index"));
            if (!isNaN(index)) {
              setActiveIndex(index);
            }
          }
        });
      },
      {
        root: container,
        threshold: 0.6,
      }
    );

    const cards = container.querySelectorAll("[data-index]");
    cards.forEach((card) => observer.observe(card));

    return () => observer.disconnect();
  }, [posts]);

  // Loading State
  if (isLoading) {
    return (
      <div className="flex h-[calc(100dvh-5rem)] flex-col items-center justify-center bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-[hsl(var(--neon-green))]" />
        <p className="mt-4 font-display text-lg tracking-wide text-foreground">
          LOADING VIBES...
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Syncing the latest content
        </p>
      </div>
    );
  }

  // Error State
  if (isError) {
    return (
      <div className="flex h-[calc(100dvh-5rem)] flex-col items-center justify-center bg-background px-6">
        <div
          className="flex h-20 w-20 items-center justify-center rounded-full border border-[hsl(var(--neon-green))]/30 bg-[hsl(var(--neon-green))]/10"
          style={{ boxShadow: "var(--shadow-green)" }}
        >
          <WifiOff className="h-10 w-10 text-[hsl(var(--neon-green))]" />
        </div>
        <h2 className="mt-6 font-display text-2xl tracking-wide text-foreground">
          CONNECTION LOST
        </h2>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          We couldn't load the feed. Check your connection and try again.
        </p>
      </div>
    );
  }

  // Empty State
  if (posts.length === 0) {
    return (
      <div className="flex h-[calc(100dvh-5rem)] flex-col items-center justify-center bg-background px-6">
        <div
          className="flex h-20 w-20 items-center justify-center rounded-full border border-[hsl(var(--neon-green))]/30 bg-[hsl(var(--neon-green))]/10"
          style={{ boxShadow: "var(--shadow-green)" }}
        >
          <Film className="h-10 w-10 text-[hsl(var(--neon-green))]" />
        </div>
        <h2 className="mt-6 font-display text-2xl tracking-wide text-foreground">
          NO VIBES YET
        </h2>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          Be the first to share what's happening tonight.
        </p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="h-[calc(100dvh-5rem)] w-full snap-y snap-mandatory overflow-y-scroll hide-scrollbar bg-background"
    >
      {posts.map((post, index) => (
        <div
          key={post.id}
          data-index={index}
          className="h-[calc(100dvh-5rem)] w-full"
        >
          <VideoCard post={post} isActive={index === activeIndex} />
        </div>
      ))}
    </div>
  );
}
