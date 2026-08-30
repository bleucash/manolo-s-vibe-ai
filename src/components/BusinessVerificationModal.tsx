import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserMode } from "@/contexts/UserModeContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ShieldCheck, Zap, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface BusinessVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Required: verification is per-venue, there is no single-session id for it
      the way BecomeTalentModal derives everything from session.user.id. */
  venueId: string;
  /** Completes "Business verification unlocks the ability to ___." Mirrors the
      reason already shown on the Tier2Notice the user clicked, so the modal
      explains the specific wall they hit rather than a generic one. */
  reason?: string;
  onSubmitted?: () => void;
}

export const BusinessVerificationModal = ({
  isOpen,
  onClose,
  venueId,
  reason,
  onSubmitted,
}: BusinessVerificationModalProps) => {
  const { session } = useUserMode();
  const [legalName, setLegalName] = useState("");
  const [businessEmail, setBusinessEmail] = useState("");
  const [businessPhone, setBusinessPhone] = useState("");
  const [positionTitle, setPositionTitle] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleApply = async () => {
    // All four columns are NOT NULL, so each needs its own check. Deliberately
    // not the single length check BecomeTalentModal gets away with on one field.
    const legal = legalName.trim();
    const email = businessEmail.trim();
    const phone = businessPhone.trim();
    const title = positionTitle.trim();

    if (legal.length < 2) {
      toast.error("Legal Name Required", { description: "Enter the registered business name." });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Invalid Business Email", { description: "Enter a valid email address." });
      return;
    }
    // Digits only after stripping formatting; 7 is the shortest real local number.
    if (phone.replace(/\D/g, "").length < 7) {
      toast.error("Invalid Business Phone", { description: "Enter a reachable phone number." });
      return;
    }
    if (title.length < 2) {
      toast.error("Position Required", { description: "Enter your role at the business." });
      return;
    }

    // venue_business_applications.user_id is NOT NULL, so the insert type
    // requires a string and `session?.user?.id` is `string | undefined`. The
    // modal only opens from an authenticated venue surface, but reading the id
    // once and failing loudly beats sending undefined and getting a PostgREST
    // error the user sees as a generic submission failure.
    const userId = session?.user?.id;
    if (!userId) {
      toast.error("Session Expired", { description: "Please sign in again to submit." });
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from("venue_business_applications").insert({
        venue_id: venueId,
        user_id: userId,
        legal_name: legal,
        business_email: email,
        business_phone: phone,
        position_title: title,
        status: "pending",
      });

      if (error) throw error;

      toast.success("Application Sent", {
        description: "Our team will review your business details shortly.",
      });
      onSubmitted?.();
      onClose();
    } catch (err: any) {
      // 23505 = venue_business_applications_one_pending_per_venue. Unlike the
      // talent flow this is a routine outcome, not a race: any of the five
      // gated surfaces can open this modal, so a manager who already filed
      // will land here again from a different surface.
      if (err?.code === "23505") {
        toast.error("Already Under Review", {
          description: "This venue already has an application pending.",
        });
        onSubmitted?.();
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
      <DialogContent className="bg-zinc-950 border-white/10 rounded-[2.5rem] p-8 max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-4">
          <div className="w-16 h-16 bg-amber-500/10 rounded-2xl flex items-center justify-center mb-2">
            <ShieldCheck className="w-8 h-8 text-amber-500" />
          </div>
          <DialogTitle className="text-3xl font-display uppercase italic tracking-tighter text-white leading-none">
            Business Verification
          </DialogTitle>
          <DialogDescription className="text-zinc-500 text-[10px] font-black uppercase tracking-widest leading-relaxed">
            {reason ? `Unlocks the ability to ${reason}.` : "Unlocks financial and staffing operations."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-6">
          <div className="space-y-2">
            <Label htmlFor="legal-name" className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">
              Registered Business Name
            </Label>
            <Input
              id="legal-name"
              value={legalName}
              onChange={(e) => setLegalName(e.target.value)}
              placeholder="Manolo Holdings LLC"
              className="h-12 bg-white/5 border-white/10 rounded-xl text-white font-bold"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="business-email" className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">
              Business Email
            </Label>
            <Input
              id="business-email"
              type="email"
              value={businessEmail}
              onChange={(e) => setBusinessEmail(e.target.value)}
              placeholder="ops@venue.com"
              className="h-12 bg-white/5 border-white/10 rounded-xl text-white font-bold"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="business-phone" className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">
              Business Phone
            </Label>
            <Input
              id="business-phone"
              type="tel"
              value={businessPhone}
              onChange={(e) => setBusinessPhone(e.target.value)}
              placeholder="(813) 555-0100"
              className="h-12 bg-white/5 border-white/10 rounded-xl text-white font-bold"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="position-title" className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">
              Your Position
            </Label>
            <Input
              id="position-title"
              value={positionTitle}
              onChange={(e) => setPositionTitle(e.target.value)}
              placeholder="General Manager"
              className="h-12 bg-white/5 border-white/10 rounded-xl text-white font-bold"
            />
          </div>

          <div className="bg-zinc-900/50 p-5 rounded-2xl border border-white/5">
            <p className="text-[9px] text-zinc-400 leading-relaxed uppercase font-black tracking-[0.2em]">
              <Zap className="w-3 h-3 text-neon-green inline mr-2" />
              Verification is per venue and reviewed by hand. Tier 1 access (profile, hero reel, posting) is unaffected
              while you wait.
            </p>
          </div>

          <Button
            onClick={handleApply}
            disabled={isSubmitting}
            className="w-full h-16 bg-white text-black font-black uppercase tracking-widest rounded-2xl hover:bg-amber-500 transition-all"
          >
            {isSubmitting ? <Loader2 className="animate-spin" /> : "Submit For Review"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
