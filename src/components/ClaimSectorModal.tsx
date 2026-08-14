import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserMode } from "@/contexts/UserModeContext";
import { checkOtherTrackConflict } from "@/lib/roleClaims";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Instagram, ShieldCheck, Zap, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface ClaimSectorModalProps {
  venueId: string;
  venueName: string;
  isOpen: boolean;
  onClose: () => void;
}

export const ClaimSectorModal = ({ venueId, venueName, isOpen, onClose }: ClaimSectorModalProps) => {
  // isManager is exactly role_type === "manager" in UserModeContext, so this
  // branches on the role itself, not on venue ownership.
  const { session, isManager } = useUserMode();
  const [instagram, setInstagram] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleClaim = async () => {
    if (!instagram.includes("@") && instagram.length < 3) {
      toast.error("Invalid IG Handle", { description: "Please enter a valid Instagram username." });
      return;
    }

    setIsSubmitting(true);
    try {
      // Same one-role gate as the Profile entry points. Guarding only those
      // would leave this path open as a way around the check; an existing
      // manager adding another venue is the same track and passes.
      const conflict = await checkOtherTrackConflict(session?.user?.id ?? "", "manager");
      if (conflict) {
        toast.error(conflict.title, { description: conflict.description });
        return;
      }

      const { error } = await supabase.from("venue_claims").insert({
        user_id: session?.user?.id,
        venue_id: venueId,
        instagram_handle: instagram.replace("@", ""),
        status: "pending"
      });

      if (error) throw error;

      toast.success(isManager ? "Venue Added to Review" : "Claim Initialized", {
        description: "Neural handshake sent. Our team will verify your IG link shortly."
      });
      onClose();
    } catch (err: any) {
      // unique_venue_claim is UNIQUE (venue_id, status), not per user, so a
      // pending claim by anyone on this venue collides here.
      if (err?.code === "23505") {
        toast.error("Already Under Review", {
          description: "A claim on this venue is already being verified."
        });
        return;
      }
      console.error(err);
      toast.error("System Error", { description: "Could not initialize claim. Try again." });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-zinc-950 border-white/10 rounded-[2.5rem] p-8 max-w-md">
        <DialogHeader className="space-y-4">
          <div className="w-16 h-16 bg-neon-blue/10 rounded-2xl flex items-center justify-center mb-2">
            <ShieldCheck className="w-8 h-8 text-neon-blue" />
          </div>
          <DialogTitle className="text-3xl font-display uppercase italic tracking-tighter text-white leading-none">
            {isManager ? `Add Sector: ${venueName}` : `Claim Sector: ${venueName}`}
          </DialogTitle>
          <DialogDescription className="text-zinc-500 text-[10px] font-black uppercase tracking-widest leading-relaxed">
            {isManager
              ? "Adding this venue to the ones you already run. Verified via Instagram, same as the rest."
              : "Identity verification required via Instagram."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-6">
          <div className="relative">
            <Instagram className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neon-pink" />
            <Input
              value={instagram}
              onChange={(e) => setInstagram(e.target.value)}
              placeholder="@venue_official_ig"
              className="h-16 pl-12 bg-white/5 border-white/10 rounded-2xl text-white font-bold uppercase tracking-widest focus:border-neon-pink transition-all"
            />
          </div>

          <div className="bg-zinc-900/50 p-6 rounded-2xl border border-white/5">
            <p className="text-[9px] text-zinc-400 leading-relaxed uppercase font-black tracking-[0.2em]">
              <Zap className="w-3 h-3 text-neon-green inline mr-2" />
              {isManager
                ? "This venue joins your existing control panel once verified. Your current sectors are unaffected while it is in review."
                : 'Claiming grants temporary "Vibe" access. Financial and Staffing sectors unlock after our IG handshake is verified.'}
            </p>
          </div>

          <Button 
            onClick={handleClaim}
            disabled={isSubmitting}
            className="w-full h-16 bg-white text-black font-black uppercase tracking-widest rounded-2xl hover:bg-neon-blue transition-all"
          >
            {isSubmitting ? <Loader2 className="animate-spin" /> : "Initiate Handshake"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
