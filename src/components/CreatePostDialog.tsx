import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserMode } from "@/contexts/UserModeContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Upload, X, MapPin } from "lucide-react";
import { toast } from "sonner";
import { isPresentAt, isTappedIn } from "@/lib/presence";

interface CreatePostDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onPostCreated?: () => void;
}

export const CreatePostDialog = ({ open, onOpenChange, onPostCreated }: CreatePostDialogProps) => {
  const { session, mode, activeVenueId, userVenues } = useUserMode();
  const [content, setContent] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [venueTag, setVenueTag] = useState<{ id: string; name: string } | null>(null);

  // Venue auto-tagging. Never a picker: the tag is derived, so it can't be
  // claimed. Talent only tag a venue while genuinely checked in there
  // (profiles.is_active AND current_venue_id), which keeps the tag tied to
  // real presence. Managers always tag their own venue with no active-status
  // condition, since a manager posting about their venue is legitimate
  // whether or not the doors are open tonight.
  useEffect(() => {
    if (!open || !session?.user?.id) return;

    let cancelled = false;

    const resolveVenueTag = async () => {
      if (mode === "manager") {
        // userVenues already carries id+name from context, no query needed.
        const owned = userVenues.find((v) => v.id === activeVenueId);
        if (!cancelled) setVenueTag(owned ? { id: owned.id, name: owned.name } : null);
        return;
      }

      if (mode === "talent") {
        const { data: profile } = await supabase
          .from("profiles")
          .select("is_active, current_venue_id")
          .eq("id", session.user.id)
          .maybeSingle();

        if (!isTappedIn(profile)) {
          if (!cancelled) setVenueTag(null);
          return;
        }

        const { data: venue } = await supabase
          .from("venues")
          .select("id, name, is_active")
          .eq("id", profile!.current_venue_id!)
          .maybeSingle();

        // The venue must also be OPEN. This is the one surface where stale
        // presence was not merely displayed but written: the tag is baked into
        // the post and outlives the night. Tapped in at a closed venue tags
        // nothing rather than tagging somewhere shut.
        if (!isPresentAt(profile, venue)) {
          if (!cancelled) setVenueTag(null);
          return;
        }

        if (!cancelled) setVenueTag(venue ?? null);
        return;
      }

      if (!cancelled) setVenueTag(null);
    };

    resolveVenueTag();
    return () => {
      cancelled = true;
    };
  }, [open, mode, activeVenueId, userVenues, session]);

  // Validation mirrors PortfolioUpload exactly: image or video, 50MB cap.
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

  const clearSelection = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
  };

  const handleSubmit = async () => {
    // posts.media_url is NOT NULL, so media is required, not optional.
    // content is nullable, so the caption genuinely is optional.
    if (!selectedFile) {
      toast.error("Add a photo or video to post");
      return;
    }
    if (!session?.user?.id) {
      toast.error("Verification Required");
      return;
    }

    setLoading(true);
    try {
      const fileExt = selectedFile.name.split(".").pop();
      // Same bucket as PortfolioUpload (proven storage policies) but a
      // posts/ prefix, so post media stays logically separate from
      // portfolio/ items.
      const fileName = `posts/${session.user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("profile-media")
        .upload(fileName, selectedFile);

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("profile-media").getPublicUrl(fileName);

      const { error: insertError } = await supabase.from("posts").insert({
        user_id: session.user.id,
        media_url: publicUrl,
        media_type: selectedFile.type.startsWith("image") ? "image" : "video",
        content: content.trim() || null,
        venue_id: venueTag?.id ?? null,
        // posts.is_active DEFAULTS TO FALSE. Set explicitly: nothing filters
        // on it today, but a post created "inactive" is a trap waiting for
        // the first query that does.
        is_active: true,
      });

      if (insertError) throw insertError;

      toast.success("Post created!");
      setContent("");
      clearSelection();
      onOpenChange?.(false);
      onPostCreated?.();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Failed to create post";
      console.error("Create post error:", error);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-zinc-900 border-white/10 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white">Create Post</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {!selectedFile ? (
            <label className="flex flex-col items-center justify-center w-full h-36 rounded-2xl border border-dashed border-white/10 bg-zinc-900/50 cursor-pointer hover:border-white/20 transition-colors">
              <Upload className="w-6 h-6 text-muted-foreground mb-2" />
              <span className="text-sm font-semibold text-foreground">Click to upload</span>
              <span className="text-xs text-muted-foreground mt-1">Image or video (max 50MB)</span>
              <input type="file" accept="image/*,video/*" className="hidden" onChange={handleFileSelect} />
            </label>
          ) : (
            <div className="relative w-full h-48 rounded-2xl overflow-hidden bg-zinc-900 border border-white/5">
              {selectedFile.type.startsWith("image") ? (
                <img src={previewUrl!} alt="Preview" className="w-full h-full object-cover" />
              ) : (
                <video src={previewUrl!} className="w-full h-full object-cover" muted playsInline />
              )}
              <button
                onClick={clearSelection}
                className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/70 flex items-center justify-center hover:bg-black transition-colors"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </div>
          )}

          <Textarea
            placeholder="What's happening tonight?"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="min-h-[100px] bg-zinc-800 border-white/10 text-white resize-none"
          />

          {venueTag && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-neon-blue/5 border border-neon-blue/20">
              <MapPin className="w-3.5 h-3.5 text-neon-blue shrink-0" />
              <span className="text-[9px] font-black uppercase tracking-widest text-neon-blue truncate">
                Tagging {venueTag.name}
              </span>
            </div>
          )}

          <Button onClick={handleSubmit} disabled={loading} className="w-full bg-neon-pink text-white">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Post"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
