import { useState } from "react";
import { Loader2 } from "lucide-react";

interface HeroReelProps {
  videoUrl?: string | null;
  fallbackImageUrl?: string | null;
  alt?: string;
  className?: string;
  autoplay?: boolean;
}

export const HeroReel = ({
  videoUrl,
  fallbackImageUrl,
  alt = "Hero content",
  className = "",
  autoplay = true,
}: HeroReelProps) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const hasVideo = videoUrl && !error;

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {loading && hasVideo && (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-900">
          <Loader2 className="w-8 h-8 text-zinc-600 animate-spin" />
        </div>
      )}

      {hasVideo ? (
        <video
          autoPlay={autoplay}
          loop
          muted
          playsInline
          onLoadedData={() => setLoading(false)}
          onError={() => {
            setError(true);
            setLoading(false);
          }}
          className={`w-full h-full object-cover ${loading ? "opacity-0" : "opacity-100"} transition-opacity duration-300`}
        >
          <source src={videoUrl} type="video/mp4" />
        </video>
      ) : (
        <img
          src={fallbackImageUrl || "/placeholder.svg"}
          alt={alt}
          onLoad={() => setLoading(false)}
          className={`w-full h-full object-cover ${loading ? "opacity-0" : "opacity-100"} transition-opacity duration-300`}
        />
      )}
    </div>
  );
};
