import { useState, useRef, useEffect, useCallback } from "react";
import { VideoCard } from "./VideoCard";
import { PostWithVenue } from "@/types/database";

interface VibeFeedProps {
  posts: PostWithVenue[];
  isLoading: boolean;
  error?: string | null;
}

export function VibeFeed({ posts, isLoading, error }: VibeFeedProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // ✅ OPTIMIZED SCROLL TRACKING
  // This ensures only the video in the center of the frame is "Active" (Playing)
  const handleIntersection = useCallback((entries: IntersectionObserverEntry[]) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const index = Number(entry.target.getAttribute("data-index"));
        if (!isNaN(index)) {
          setActiveIndex(index);
        }
      }
    });
  }, []);

  useEffect(() => {
    observerRef.current = new IntersectionObserver(handleIntersection, {
      root: containerRef.current,
      threshold: 0.6, // Video must be 60% visible to trigger play
    });
    return () => observerRef.current?.disconnect();
  }, [handleIntersection]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const cards = container.querySelectorAll("[data-index]");
    cards.forEach((card) => observerRef.current?.observe(card));
    return () => cards.forEach((card) => observerRef.current?.unobserve(card));
  }, [posts]);

  // ✅ UNIFIED LOADING STRATEGY
  // We return null to allow the parent's branded LoadingState to persist.
  // This eliminates the "small circle" flicker.
  if (isLoading) {
    return null;
  }

  // ✅ ERROR STATE BRANDING
  if (error) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-black p-6 text-center">
        <p className="text-[10px] font-black text-red-500 uppercase tracking-[0.4em] mb-2">Sync Failure</p>
        <p className="text-zinc-500 text-xs font-bold uppercase">{error}</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="h-full w-full overflow-y-scroll snap-y snap-mandatory hide-scrollbar bg-black animate-in fade-in duration-700"
    >
      {posts.length > 0 ? (
        posts.map((post, index) => (
          <div key={post.id} data-index={index} className="h-full w-full snap-start snap-always relative">
            <VideoCard post={post} isActive={index === activeIndex} />
          </div>
        ))
      ) : (
        <div className="h-full flex items-center justify-center">
          <p className="text-[10px] font-black text-zinc-800 uppercase tracking-[0.5em]">No Vibes Found in Sector</p>
        </div>
      )}
    </div>
  );
}
