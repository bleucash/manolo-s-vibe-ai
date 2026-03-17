import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Upload, Film, Image as ImageIcon, Loader2, Check, X } from "lucide-react";
import { toast } from "sonner";

interface HeroReelUploadProps {
  entityId: string;
  entityType: "venue" | "talent";
  currentReelUrl?: string | null;
  onUploadComplete?: (url: string) => void;
}

export const HeroReelUpload = ({ entityId, entityType, currentReelUrl, onUploadComplete }: HeroReelUploadProps) => {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentReelUrl || null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const isVideo = file.type.startsWith("video/");
    const isImage = file.type.startsWith("image/");

    if (!isVideo && !isImage) {
      toast.error("Please upload a video or image file");
      return;
    }

    // Validate file size (max 50MB)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      toast.error("File size must be under 50MB");
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      // Generate unique filename
      const fileExt = file.name.split(".").pop();
      const fileName = `${entityType}-${entityId}-${Date.now()}.${fileExt}`;
      const filePath = `hero-reels/${fileName}`;

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage.from("media").upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
      });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage.from("media").getPublicUrl(filePath);

      const publicUrl = urlData.publicUrl;

      // Update database based on entity type
      const table = entityType === "venue" ? "venues" : "profiles";
      const { error: dbError } = await supabase.from(table).update({ hero_reel_url: publicUrl }).eq("id", entityId);

      if (dbError) throw dbError;

      // Update preview
      setPreviewUrl(publicUrl);
      toast.success("Hero reel uploaded successfully!");

      // Callback
      if (onUploadComplete) {
        onUploadComplete(publicUrl);
      }
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error(error.message || "Upload failed");
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleRemoveReel = async () => {
    if (!confirm("Remove hero reel? This cannot be undone.")) return;

    try {
      // Update database to remove URL
      const table = entityType === "venue" ? "venues" : "profiles";
      const { error } = await supabase.from(table).update({ hero_reel_url: null }).eq("id", entityId);

      if (error) throw error;

      setPreviewUrl(null);
      toast.success("Hero reel removed");

      if (onUploadComplete) {
        onUploadComplete("");
      }
    } catch (error: any) {
      console.error("Remove error:", error);
      toast.error("Failed to remove hero reel");
    }
  };

  return (
    <Card className="bg-zinc-900/20 border-white/5">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Film className="w-4 h-4 text-neon-blue" />
            <h3 className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Hero Reel</h3>
          </div>
          {previewUrl && (
            <Button
              onClick={handleRemoveReel}
              variant="ghost"
              size="sm"
              className="text-red-500 hover:text-red-400 h-8 text-xs"
            >
              <X className="w-3 h-3 mr-1" />
              Remove
            </Button>
          )}
        </div>

        {/* Preview */}
        {previewUrl && (
          <div className="mb-4 rounded-lg overflow-hidden bg-black aspect-video">
            {previewUrl.match(/\.(mp4|webm|mov)$/i) ? (
              <video src={previewUrl} className="w-full h-full object-cover" autoPlay loop muted playsInline />
            ) : (
              <img src={previewUrl} alt="Hero reel preview" className="w-full h-full object-cover" />
            )}
          </div>
        )}

        {/* Upload Button */}
        <label className="block">
          <input
            type="file"
            accept="video/*,image/*"
            onChange={handleFileUpload}
            disabled={uploading}
            className="hidden"
          />
          <Button
            asChild
            disabled={uploading}
            className={`w-full h-12 font-black uppercase tracking-widest text-[10px] ${
              previewUrl
                ? "bg-zinc-900/50 border-white/5 text-zinc-400 hover:bg-zinc-800"
                : "bg-neon-blue/10 border-neon-blue/30 text-neon-blue hover:bg-neon-blue/20"
            }`}
            variant="outline"
          >
            <span className="cursor-pointer flex items-center justify-center w-full">
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : previewUrl ? (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Update Hero Reel
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Hero Reel
                </>
              )}
            </span>
          </Button>
        </label>

        <p className="text-[9px] text-zinc-600 mt-3 uppercase font-black tracking-widest">
          Video or Image • Max 50MB • 16:9 or 9:16
        </p>
      </CardContent>
    </Card>
  );
};
