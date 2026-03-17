import { useState, useRef, useCallback } from "react";
import { HeroReel } from "./HeroReel";
import { supabase } from "@/integrations/supabase/client";
import { Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface InteractiveHeroReelProps {
  entityId: string;
  entityType: "venue" | "talent";
  currentReelUrl?: string | null;
  fallbackImageUrl?: string | null;
  isOwner: boolean;
  className?: string;
}

export const InteractiveHeroReel = ({
  entityId,
  entityType,
  currentReelUrl,
  fallbackImageUrl,
  isOwner,
  className = "",
}: InteractiveHeroReelProps) => {
  const [showUploadOverlay, setShowUploadOverlay] = useState(false);
  const [uploading, setUploading] = useState(false);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isPressing = useRef(false);

  const startPress = useCallback(() => {
    if (!isOwner || uploading) return;
    isPressing.current = true;
    pressTimer.current = setTimeout(() => {
      if (isPressing.current) {
        setShowUploadOverlay(true);
        if (navigator.vibrate) navigator.vibrate(50);
      }
    }, 800);
  }, [isOwner, uploading]);

  const endPress = useCallback(() => {
    isPressing.current = false;
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
    if (showUploadOverlay) {
      setShowUploadOverlay(false);
      fileInputRef.current?.click();
    }
  }, [showUploadOverlay]);

  const cancelPress = useCallback(() => {
    isPressing.current = false;
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
    setShowUploadOverlay(false);
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isVideo = file.type.startsWith("video/");
    const isImage = file.type.startsWith("image/");
    if (!isVideo && !isImage) {
      toast.error("Please upload a video or image file");
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      toast.error("File size must be under 50MB");
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${entityType}-${entityId}-${Date.now()}.${fileExt}`;
      const filePath = `hero-reels/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("media")
        .upload(filePath, file, { cacheControl: "3600", upsert: false });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("media").getPublicUrl(filePath);
      const publicUrl = urlData.publicUrl;

      const table = entityType === "venue" ? "venues" : "profiles";
      const { error: dbError } = await supabase
        .from(table)
        .update({ hero_reel_url: publicUrl })
        .eq("id", entityId);
      if (dbError) throw dbError;

      toast.success("Hero reel updated!");
      if (navigator.vibrate) navigator.vibrate(100);
      setTimeout(() => window.location.reload(), 800);
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error(error.message || "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div
      className={`relative select-none ${className}`}
      onMouseDown={startPress}
      onMouseUp={endPress}
      onMouseLeave={cancelPress}
      onTouchStart={startPress}
      onTouchEnd={endPress}
      onTouchCancel={cancelPress}
      onContextMenu={(e) => isOwner && e.preventDefault()}
    >
      <HeroReel
        videoUrl={currentReelUrl}
        fallbackImageUrl={fallbackImageUrl}
        className="w-full h-full"
      />

      {/* Owner hint badge */}
      {isOwner && !uploading && !showUploadOverlay && (
        <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-black/40 backdrop-blur-md flex items-center gap-1.5 pointer-events-none">
          <Upload className="w-3 h-3 text-white/60" />
          <span className="text-[9px] font-bold uppercase tracking-widest text-white/60">
            Hold to Update
          </span>
        </div>
      )}

      {/* Upload overlay */}
      {showUploadOverlay && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center gap-3 z-10">
          <Upload className="w-10 h-10 text-white/90" />
          <span className="text-xs font-bold uppercase tracking-widest text-white/80">
            Release to Upload
          </span>
        </div>
      )}

      {/* Uploading overlay */}
      {uploading && (
        <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center gap-3 z-20">
          <Loader2 className="w-8 h-8 text-white animate-spin" />
          <span className="text-xs font-bold uppercase tracking-widest text-white/70">
            Uploading...
          </span>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="video/*,image/*"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
};
