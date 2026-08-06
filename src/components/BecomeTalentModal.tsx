import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserMode } from "@/contexts/UserModeContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Instagram, Sparkles, Zap, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface BecomeTalentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitted?: () => void;
}

export const BecomeTalentModal = ({ isOpen, onClose, onSubmitted }: BecomeTalentModalProps) => {
  const { session } = useUserMode();
  const [instagram, setInstagram] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleApply = async () => {
    // Strip leading @ first, then validate. ClaimSectorModal's equivalent
    // check is `!includes("@") && length < 3`, which short-circuits so a bare
    // "@" passes; not replicated here.
    const handle = instagram.trim().replace(/^@+/, "");
    if (handle.length < 3) {
      toast.error("Invalid IG Handle", { description: "Please enter a valid Instagram username." });
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from("talent_applications").insert({
        user_id: session?.user?.id,
        instagram_handle: handle,
        status: "pending"
      });

      if (error) throw error;

      toast.success("Application Sent", {
        description: "Neural handshake sent. Our team will verify your IG link shortly."
      });
      onSubmitted?.();
      onClose();
    } catch (err: any) {
      // 23505 = the talent_applications_one_pending_per_user partial unique
      // index. Means an application is already open, not a system failure.
      if (err?.code === "23505") {
        toast.error("Application Already Open", {
          description: "You already have an application under review."
        });
        onClose();
        return;
      }
      console.error(err);
      toast.error("System Error", { description: "Could not submit application. Try again." });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-zinc-950 border-white/10 rounded-[2.5rem] p-8 max-w-md">
        <DialogHeader className="space-y-4">
          <div className="w-16 h-16 bg-neon-purple/10 rounded-2xl flex items-center justify-center mb-2">
            <Sparkles className="w-8 h-8 text-neon-purple" />
          </div>
          <DialogTitle className="text-3xl font-display uppercase italic tracking-tighter text-white leading-none">
            Apply as Talent
          </DialogTitle>
          <DialogDescription className="text-zinc-500 text-[10px] font-black uppercase tracking-widest leading-relaxed">
            Identity verification required via Instagram.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-6">
          <div className="relative">
            <Instagram className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neon-pink" />
            <Input
              value={instagram}
              onChange={(e) => setInstagram(e.target.value)}
              placeholder="@your_ig_handle"
              className="h-16 pl-12 bg-white/5 border-white/10 rounded-2xl text-white font-bold uppercase tracking-widest focus:border-neon-pink transition-all"
            />
          </div>

          <div className="bg-zinc-900/50 p-6 rounded-2xl border border-white/5">
            <p className="text-[9px] text-zinc-400 leading-relaxed uppercase font-black tracking-[0.2em]">
              <Zap className="w-3 h-3 text-neon-green inline mr-2" />
              Approved talent unlock Gigs, professional profile tools, and payout sectors. Every application is reviewed by hand.
            </p>
          </div>

          <Button
            onClick={handleApply}
            disabled={isSubmitting}
            className="w-full h-16 bg-white text-black font-black uppercase tracking-widest rounded-2xl hover:bg-neon-purple transition-all"
          >
            {isSubmitting ? <Loader2 className="animate-spin" /> : "Initiate Handshake"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
