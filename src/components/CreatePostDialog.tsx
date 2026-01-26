import { useState, forwardRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserMode } from "@/contexts/UserModeContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Zap, Image as ImageIcon, X, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface CreatePostDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onPostCreated?: () => void;
}

export const CreatePostDialog = ({ open, onOpenChange, onPostCreated }: CreatePostDialogProps) => {
  const { session, mode, activeVenueId } = useUserMode();
  const [content, setContent] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!session?.user?.id) {
      toast.error("Handshake required: Please log in");
      return;
    }

    if (!content.trim() && !mediaUrl) {
      toast.error("Transmission data cannot be empty");
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.from("posts").insert({
        user_id: session.user.id,
        content: content.trim(),
        media_url: mediaUrl || null,
        venue_id: activeVenueId || null,
        // Using current context to flag the post type
        is_live_intel: mode === "talent" || mode === "manager",
      });

      if (error) throw error;

      toast.success("Intelligence Dispatched");
      setContent("");
      setMediaUrl("");
      onOpenChange?.(false);
      onPostCreated?.();
    } catch (err) {
      console.error("Transmission Error:", err);
      toast.error("Global Ledger Sync Failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* The DialogContent below is a Radix primitive. 
         Wrapping the interior in a div or using forwardRef on custom triggers 
         removes the console warnings. 
      */}
      <DialogContent className="bg-black border-white/5 text-white max-w-lg rounded-[2.5rem] p-0 overflow-hidden shadow-[0_0_50px_rgba(255,255,255,0.05)]">
        <div className="p-8 border-b border-white/5 bg-zinc-900/40">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <Zap className="w-4 h-4 text-neon-blue animate-pulse" />
              <DialogTitle className="font-display text-2xl uppercase italic tracking-tighter">
                New Transmission
              </DialogTitle>
            </div>
            <DialogDescription className="text-[10px] font-black text-zinc-500 uppercase tracking-widest leading-none">
              Broadcasting to your Neural Network
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="p-8 space-y-6">
          <div className="relative group">
            <Textarea
              placeholder="What's the vibe in your sector?"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-[160px] bg-zinc-900/50 border border-white/5 rounded-3xl text-sm font-medium italic placeholder:text-zinc-700 focus:border-neon-blue/40 transition-all outline-none p-6 resize-none"
            />
            <div className="absolute bottom-4 right-4 text-[9px] font-black text-zinc-800 uppercase tracking-widest">
              {content.length} / 280
            </div>
          </div>

          {/* Media Uplink Placeholder - Future implementation for Image Uploads */}
          <div className="flex gap-4">
            <Button
              variant="outline"
              className="flex-1 h-14 bg-zinc-900/50 border-white/5 rounded-2xl gap-3 text-zinc-500 hover:text-white hover:border-white/20 transition-all"
              onClick={() => toast.info("Optical Uplink: Feature Synchronizing")}
            >
              <ImageIcon className="w-4 h-4" />
              <span className="text-[10px] font-black uppercase tracking-widest">Attach Media</span>
            </Button>
          </div>

          <div className="pt-4 space-y-4">
            <Button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full h-16 bg-white text-black rounded-2xl font-black uppercase text-[11px] tracking-[0.2em] shadow-xl hover:bg-neon-blue hover:text-white transition-all active:scale-95 border-none"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Dispatch Intel"}
            </Button>

            <div className="flex items-center justify-center gap-2 opacity-30">
              <ShieldCheck className="w-3 h-3 text-white" />
              <span className="text-[8px] font-black uppercase tracking-widest text-white">
                Neural Handshake Encrypted
              </span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
