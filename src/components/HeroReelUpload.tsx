import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Upload, Film, Loader2, Check, X } from "lucide-react";
import { toast } from "sonner";

interface HeroReelUploadProps {
  entityId: string;
  entityType: "venue" | "talent";
  currentReelUrl?: string | null;
  onUploadComplete?: (url: string) => void;
}

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export const HeroReelUpload = ({
  entityId,
  entityType,
  currentReelUrl,
  onUploadComplete,
}: HeroReelUploadProps) => {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentReelUrl ?? null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isVideo = (url: string) =>
    /\.(mp4|mov|webm|avi|mkv)$/i.test(url) || url.includes("video");

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("video/") && !file.type.startsWith("image/")) {
      toast.error("Please select a video or image file.");
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      toast.error("File must be under 50MB.");
      return;
    }

    setUploading(true);
    setUploadProgress(10);

    try {
      const ext = file.name.split(".").pop();
      const filePath = `hero-reels/${entityType}-${entityId}-${Date.now()}.${ext}`;

      setUploadProgress(30);

      const { error: uploadError } = await supabase.storage
        .from("media")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      setUploadProgress(70);

      const { data: urlData } = supabase.storage
        .from("media")
        .getPublicUrl(filePath);

      const publicUrl = urlData.publicUrl;

      const table = entityType === "venue" ? "venues" : "profiles";
      const { error: dbError } = await supabase
        .from(table)
        .update({ hero_reel_url: publicUrl })
        .eq("id", entityId);

      if (dbError) throw dbError;

      setUploadProgress(100);
      setPreviewUrl(publicUrl);
      onUploadComplete?.(publicUrl);
      toast.success("Hero reel uploaded!");
    } catch (err: any) {
      toast.error(err.message || "Upload failed.");
    } finally {
      setUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemove = async () => {
    try {
      const table = entityType === "venue" ? "venues" : "profiles";
      const { error } = await supabase
        .from(table)
        .update({ hero_reel_url: null })
        .eq("id", entityId);

      if (error) throw error;

      setPreviewUrl(null);
      toast.success("Hero reel removed.");
    } catch (err: any) {
      toast.error(err.message || "Failed to remove reel.");
    }
  };

  return (
    <Card className="bg-zinc-900/20 border-white/5">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Film className="w-4 h-4" />
          Hero Reel
        </div>

        {/* Preview */}
        <div className="aspect-video rounded-lg overflow-hidden bg-zinc-800/50 flex items-center justify-center">
          {previewUrl ? (
            isVideo(previewUrl) ? (
              <video
                src={previewUrl}
                autoPlay
                loop
                muted
                playsInline
                className="w-full h-full object-cover"
              />
            ) : (
              <img
                src={previewUrl}
                alt="Hero reel"
                className="w-full h-full object-cover"
              />
            )
          ) : (
            <div className="text-muted-foreground text-xs flex flex-col items-center gap-1">
              <Film className="w-6 h-6 opacity-40" />
              No reel uploaded
            </div>
          )}
        </div>

        {/* Upload progress */}
        {uploading && (
          <div className="w-full bg-zinc-800 rounded-full h-1.5">
            <div
              className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        )}

        {/* Actions */}
        <div className="space-y-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*,image/*"
            onChange={handleFileSelect}
            className="hidden"
          />

          <Button
            variant={previewUrl ? "secondary" : "default"}
            size="sm"
            className={
              previewUrl
                ? ""
                : "bg-blue-600 hover:bg-blue-700 text-white"
            }
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : previewUrl ? (
              <Check className="w-4 h-4" />
            ) : (
              <Upload className="w-4 h-4" />
            )}
            {uploading ? "Uploading…" : previewUrl ? "Replace Reel" : "Upload Reel"}
          </Button>

          <p className="text-[11px] text-muted-foreground">
            Video or Image • Max 50MB • 16:9 or 9:16
          </p>

          {previewUrl && (
            <button
              onClick={handleRemove}
              className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1"
            >
              <X className="w-3 h-3" />
              Remove reel
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
