import { useState, useRef, useEffect, useCallback } from "react";
import { VideoCard } from "./VideoCard";
import { PostWithVenue } from "@/types/database";
import { Button } from "@/components/ui/button";

interface VibeFeedProps {
  posts: PostWithVenue[];
  isLoading: boolean;
  error?: string | null;
}

export function VibeFeed({ posts, isLoading, error }: VibeFeedProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const handleIntersection = useCallback((entries: IntersectionObserverEntry[]) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const index = Number(entry.target.getAttribute("data-index"));
        if (!isNaN(index)) setActiveIndex(index);
      }
    });
  }, []);

  useEffect(() => {
    observerRef.current = new IntersectionObserver(handleIntersection, {
      root: containerRef.current,
      threshold: 0.6,
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

  if (isLoading)
    return (
      <div className="h-full flex items-center justify-center bg-black">
        <div className="w-12 h-12 border-2 border-[hsl(150,100%,50%)] border-t-transparent rounded-full animate-spin" />
      </div>
    );

  return (
    <div ref={containerRef} className="h-full overflow-y-scroll snap-y snap-mandatory hide-scrollbar bg-black">
      {posts.map((post, index) => (
        <div key={post.id} data-index={index} className="h-full w-full snap-start snap-always">
          <VideoCard post={post} isActive={index === activeIndex} />
        </div>
      ))}
    </div>
  );
}
