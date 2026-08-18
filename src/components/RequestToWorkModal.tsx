import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserMode } from "@/contexts/UserModeContext";
import { GUEST_FACING_POSITIONS, POSITIONS } from "@/config/positions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Briefcase, Zap, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface RequestToWorkModalProps {
  venueId: string;
  venueName: string;
  isOpen: boolean;
  onClose: () => void;
  onSubmitted?: () => void;
}

/**
 * Talent asks to work at a venue. Produces exactly the row shape
 * ManagerApprovalPanel already buckets as "incoming": status 'pending' on
 * venue_staff. The panel was built before anything could create one.
 *
 * Only the seven guest-facing positions are offered. Security and event staff
 * are operational and are not something talent self-selects into.
 */
export const RequestToWorkModal = ({
  venueId,
  venueName,
  isOpen,
  onClose,
  onSubmitted,
}: RequestToWorkModalProps) => {
  const { session } = useUserMode();
  const [position, setPosition] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleRequest = async () => {
    if (!position) return;
    setIsSubmitting(true);
    try {
      // status is set explicitly rather than left to the column default: the
      // INSERT policy requires status = 'pending', so an omitted value would
      // be evaluated before the default is applied and fail the check.
      const { error } = await supabase.from("venue_staff").insert({
        user_id: session?.user?.id,
        venue_id: venueId,
        status: "pending",
        staff_role: position,
      });

      if (error) throw error;

      toast.success("Request Sent", {
        description: `${venueName} will review your request to work as ${POSITIONS[position as keyof typeof POSITIONS].label}.`,
      });
      onSubmitted?.();
      onClose();
    } catch (err: any) {
      // unique_venue_user_connection is UNIQUE (venue_id, user_id), one row
      // per person per venue whatever its status. So this fires whether the
      // earlier request is still pending or already active. A rejected one
      // does not collide, because the panel deletes rather than flipping to
      // a terminal status.
      if (err?.code === "23505") {
        toast.error("Already Connected", {
          description: "You already have a request or an active link with this venue.",
        });
        onClose();
        return;
      }
      console.error(err);
      toast.error("System Error", { description: "Could not send request. Try again." });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-zinc-950 border-white/10 rounded-[2.5rem] p-8 max-w-md">
        <DialogHeader className="space-y-4">
          <div className="w-16 h-16 bg-neon-green/10 rounded-2xl flex items-center justify-center mb-2">
            <Briefcase className="w-8 h-8 text-neon-green" />
          </div>
          <DialogTitle className="text-3xl font-display uppercase italic tracking-tighter text-white leading-none">
            Work at {venueName}?
          </DialogTitle>
          <DialogDescription className="text-zinc-500 text-[10px] font-black uppercase tracking-widest leading-relaxed">
            Pick what you do. The venue confirms before the link goes live.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-zinc-600 uppercase ml-4">Position</label>
            <Select value={position || undefined} onValueChange={setPosition}>
              <SelectTrigger className="h-16 bg-white/5 border-white/10 rounded-2xl text-white font-bold uppercase tracking-widest">
                <SelectValue placeholder="Select a position" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-950 border-white/10 rounded-2xl">
                {GUEST_FACING_POSITIONS.map((p) => (
                  <SelectItem key={p} value={p} className="text-white focus:bg-white/10 focus:text-white">
                    {POSITIONS[p].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="bg-zinc-900/50 p-6 rounded-2xl border border-white/5">
            <p className="text-[9px] text-zinc-400 leading-relaxed uppercase font-black tracking-[0.2em]">
              <Zap className="w-3 h-3 text-neon-green inline mr-2" />
              A manager reviews every request. You can work multiple venues, and this does not change your profile
              position.
            </p>
          </div>

          <Button
            onClick={handleRequest}
            disabled={isSubmitting || !position}
            className="w-full h-16 bg-white text-black font-black uppercase tracking-widest rounded-2xl hover:bg-neon-green transition-all disabled:opacity-30"
          >
            {isSubmitting ? <Loader2 className="animate-spin" /> : "Send Request"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
