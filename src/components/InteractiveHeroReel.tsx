import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { HeroReel } from "@/components/HeroReel";
import { Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface InteractiveHeroReelProps {
  entityId: string;
  entityType: "venue" | "talent";
  currentReelUrl?: string | null;
  fallbackImageUrl?: string | null;
  isOwner: boolean;
  onUploadComplete?: (url: string) => void;
}

export const InteractiveHeroReel = ({
  entityId,
  entityType,
  currentReelUrl,
  fallbackImageUrl,
  isOwner,
  onUploadComplete,
}: InteractiveHeroReelProps) => {
  const [uploading, setUploading] = useState(false);
  const [showUploadHint, setShowUploadHint] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Explicitly typing as number | null for browser compatibility
  const longPressTimerRef = useRef<number | null>(null);

  // Cleanup timer on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) window.clearTimeout(longPressTimerRef.current);
    };
  }, []);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const isVideo = file.type.startsWith("video/");
    const isImage = file.type.startsWith("image/");

    if (!isVideo && !isImage) {
      toast.error("Please upload a video or image file");
      return;
    }

    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error("File size must be under 50MB");
      return;
    }

    setUploading(true);

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${entityType}-${entityId}-${Date.now()}.${fileExt}`;
      const filePath = `hero-reels/${fileName}`;

      const { error: uploadError } = await supabase.storage.from("media").upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
      });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("media").getPublicUrl(filePath);

      const publicUrl = urlData.publicUrl;

      const table = entityType === "venue" ? "venues" : "profiles";
      const { error: dbError } = await supabase.from(table).update({ hero_reel_url: publicUrl }).eq("id", entityId);

      if (dbError) throw dbError;

      toast.success("Hero reel updated!");

      if (onUploadComplete) {
        onUploadComplete(publicUrl);
      }

      // No longer using window.location.reload() to maintain SPA performance
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error(error.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleLongPressStart = () => {
    if (!isOwner || uploading) return;

    // Safety clear
    if (longPressTimerRef.current) window.clearTimeout(longPressTimerRef.current);

    longPressTimerRef.current = window.setTimeout(() => {
      setShowUploadHint(true);
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
    }, 800);
  };

  const handleLongPressEnd = () => {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    if (showUploadHint && fileInputRef.current) {
      fileInputRef.current.click();
    }

    setShowUploadHint(false);
  };

  return (
    <div className="relative w-full h-full">
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*,image/*"
        onChange={handleFileUpload}
        disabled={uploading}
        className="hidden"
      />

      <div
        className={`relative w-full h-full overflow-hidden ${isOwner ? "cursor-pointer select-none" : ""}`}
        onMouseDown={handleLongPressStart}
        onMouseUp={handleLongPressEnd}
        onMouseLeave={handleLongPressEnd}
        onTouchStart={handleLongPressStart}
        onTouchEnd={handleLongPressEnd}
      >
        <HeroReel
          videoUrl={currentReelUrl}
          fallbackImageUrl={fallbackImageUrl}
          alt="Hero reel"
          className="w-full h-full object-cover"
        />

        {showUploadHint && isOwner && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center animate-in fade-in zoom-in duration-200 z-50">
            <div className="w-20 h-20 rounded-full bg-white/10 border-2 border-white/30 flex items-center justify-center mb-4">
              <Upload className="w-10 h-10 text-white" />
            </div>
            <p className="text-white font-black uppercase tracking-widest text-xs">Release to Upload</p>
          </div>
        )}

        {uploading && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center z-50">
            <Loader2 className="w-12 h-12 text-blue-400 animate-spin mb-4" />
            <p className="text-white font-black uppercase tracking-widest text-xs">Uploading...</p>
          </div>
        )}

        {isOwner && !uploading && (
          <div className="absolute top-4 right-4 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 pointer-events-none">
            <p className="text-white/60 text-[8px] font-black uppercase tracking-widest flex items-center gap-1.5">
              <Upload className="w-2.5 h-2.5" />
              Hold to Update
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
