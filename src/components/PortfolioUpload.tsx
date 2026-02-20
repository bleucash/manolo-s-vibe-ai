import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";

interface PortfolioUploadProps {
  userId: string;
  onUploadComplete?: () => void;
}

export const PortfolioUpload = ({ userId, onUploadComplete }: PortfolioUploadProps) => {
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
      toast.error("Please select an image or video file");
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      toast.error("File size must be less than 50MB");
      return;
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error("Please select a file");
      return;
    }

    setUploading(true);

    try {
      const fileExt = selectedFile.name.split(".").pop();
      const fileName = `portfolio/${userId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("profile-media")
        .upload(fileName, selectedFile);

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("profile-media").getPublicUrl(fileName);

      const { count } = await supabase
        .from("portfolio_items")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId);

      const { error: insertError } = await supabase.from("portfolio_items").insert({
        user_id: userId,
        media_url: publicUrl,
        media_type: selectedFile.type.startsWith("image") ? "image" : "video",
        caption: caption || null,
        display_order: count || 0,
      });

      if (insertError) throw insertError;

      toast.success("Portfolio item added!");
      clearSelection();
      onUploadComplete?.();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Failed to upload";
      console.error("Upload error:", error);
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  };

  const clearSelection = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setCaption("");
  };

  return (
    <div className="w-full space-y-3">
      {!selectedFile ? (
        <label className="flex flex-col items-center justify-center w-full h-36 rounded-2xl border border-dashed border-white/10 bg-zinc-900/50 cursor-pointer hover:border-white/20 transition-colors">
          <Upload className="w-6 h-6 text-muted-foreground mb-2" />
          <span className="text-sm font-semibold text-foreground">Click to upload</span>
          <span className="text-xs text-muted-foreground mt-1">Image or video (max 50MB)</span>
          <input
            type="file"
            accept="image/*,video/*"
            className="hidden"
            onChange={handleFileSelect}
          />
        </label>
      ) : (
        <div className="space-y-3">
          {/* Preview */}
          <div className="relative w-full h-48 rounded-2xl overflow-hidden bg-zinc-900 border border-white/5">
            {selectedFile.type.startsWith("image") ? (
              <img
                src={previewUrl!}
                alt="Preview"
                className="w-full h-full object-cover"
              />
            ) : (
              <video
                src={previewUrl!}
                className="w-full h-full object-cover"
                muted
                playsInline
              />
            )}
            <button
              onClick={clearSelection}
              className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/70 flex items-center justify-center hover:bg-black transition-colors"
            >
              <X className="w-4 h-4 text-white" />
            </button>
          </div>

          {/* Caption */}
          <Textarea
            placeholder="Add a caption..."
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            className="bg-zinc-900 border-white/10 text-foreground resize-none"
            rows={2}
          />

          {/* Upload button */}
          <Button
            onClick={handleUpload}
            disabled={uploading}
            className="w-full h-12 font-black uppercase tracking-widest text-xs"
          >
            {uploading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              "Add to Portfolio"
            )}
          </Button>
        </div>
      )}
    </div>
  );
};
