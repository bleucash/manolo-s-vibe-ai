import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserMode } from "@/contexts/UserModeContext";
import { GUEST_FACING_POSITIONS, POSITIONS, positionLabel } from "@/config/positions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Send, Loader2, ArrowRight } from "lucide-react";
import { toast } from "sonner";

interface InviteTalentModalProps {
  talent: { id: string; display_name?: string | null; username?: string | null } | null;
  isOpen: boolean;
  onClose: () => void;
}

type Existing = { id: string; status: string; staff_role: string | null } | null;

/**
 * Manager invites talent. The reverse of RequestToWorkModal.
 *
 * Asymmetry, accepted deliberately: on a request the TALENT picks the
 * position, on an invite the MANAGER picks it, and neither side can amend the
 * other's choice. An invite's staff_role is the manager's assertion, which
 * the talent accepts as-is by accepting the invite.
 */
export const InviteTalentModal = ({ talent, isOpen, onClose }: InviteTalentModalProps) => {
  const navigate = useNavigate();
  const { activeVenueId, userVenues } = useUserMode();
  const [position, setPosition] = useState<string | null>(null);
  const [existing, setExisting] = useState<Existing>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const venueName = userVenues?.find((v: any) => v.id === activeVenueId)?.name ?? "your venue";
  const talentName = talent?.display_name || talent?.username || "this talent";

  // unique_venue_user_connection is UNIQUE (venue_id, user_id), so any
  // existing row collides. Five states need five different answers, and a bare
  // 23505 catch would flatten them into one unhelpful message. The pre-check
  // is the primary path; the 23505 handler below is only a race backstop.
  useEffect(() => {
    if (!isOpen || !talent?.id || !activeVenueId) return;
    let cancelled = false;
    setIsChecking(true);
    setExisting(null);
    setPosition(null);

    supabase
      .from("venue_staff")
      .select("id, status, staff_role")
      .eq("venue_id", activeVenueId)
      .eq("user_id", talent.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) console.error(error);
        setExisting((data as Existing) ?? null);
        setIsChecking(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, talent?.id, activeVenueId]);

  const send = async () => {
    if (!position || !talent?.id || !activeVenueId) return;
    setIsSending(true);
    try {
      let data: any[] | null = null;
      let error: any = null;

      if (existing?.status === "ignored") {
        // Re-invite: move the declined row back rather than deleting and
        // reinserting. One operation, and it reuses the manager UPDATE policy
        // so no delete grant is needed.
        ({ data, error } = await supabase
          .from("venue_staff")
          .update({ status: "pending_talent_action", staff_role: position })
          .eq("id", existing.id)
          .select("id"));
      } else {
        ({ data, error } = await supabase
          .from("venue_staff")
          .insert({
            user_id: talent.id,
            venue_id: activeVenueId,
            status: "pending_talent_action",
            staff_role: position,
          })
          .select("id"));
      }

      if (error) throw error;
      // Rows-affected, not just absence of error: an RLS-filtered write
      // returns 200 with an empty array.
      if (!data || data.length === 0) {
        toast.error("Not Permitted", {
          description: "This venue may not be business verified yet. Nothing was sent.",
        });
        return;
      }

      toast.success("Invite Sent", {
        description: `${talentName} was invited as ${POSITIONS[position as keyof typeof POSITIONS].label}.`,
      });
      onClose();
    } catch (err: any) {
      // Backstop only: someone created a row between the pre-check and here.
      if (err?.code === "23505") {
        toast.error("Already Connected", {
          description: "A link with this talent already exists. Reopen to see its state.",
        });
        onClose();
        return;
      }
      console.error(err);
      toast.error("System Error", { description: "Could not send invite. Try again." });
    } finally {
      setIsSending(false);
    }
  };

  const renderBody = () => {
    if (isChecking) {
      return (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 text-amber-500 animate-spin" />
        </div>
      );
    }

    // They already asked to work here. Inviting them is absurd; the correct
    // action is to approve, and it is one click away.
    if (existing?.status === "pending") {
      return (
        <div className="space-y-6 mt-6">
          <div className="bg-neon-purple/5 border border-neon-purple/30 p-6 rounded-2xl">
            <p className="text-[9px] text-zinc-300 leading-relaxed uppercase font-black tracking-[0.2em]">
              {talentName} has already requested to work here
              {positionLabel(existing.staff_role) ? ` as ${positionLabel(existing.staff_role)}` : ""}. Approve them
              instead of sending an invite.
            </p>
          </div>
          <Button
            onClick={() => {
              onClose();
              navigate("/dashboard");
            }}
            className="w-full h-16 bg-white text-black font-black uppercase tracking-widest rounded-2xl hover:bg-neon-purple transition-all"
          >
            Go to Approvals <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      );
    }

    if (existing?.status === "pending_talent_action") {
      return (
        <div className="mt-6 bg-zinc-900/50 border border-white/5 p-6 rounded-2xl">
          <p className="text-[9px] text-zinc-400 leading-relaxed uppercase font-black tracking-[0.2em]">
            An invite is already open with {talentName}. Waiting on their response.
          </p>
        </div>
      );
    }

    if (existing?.status === "active") {
      return (
        <div className="mt-6 bg-zinc-900/50 border border-white/5 p-6 rounded-2xl">
          <p className="text-[9px] text-zinc-400 leading-relaxed uppercase font-black tracking-[0.2em]">
            {talentName} is already on staff at {venueName}.
          </p>
        </div>
      );
    }

    // No row, or a declined one being revived.
    return (
      <div className="space-y-6 mt-6">
        {existing?.status === "ignored" && (
          <div className="bg-amber-500/5 border border-amber-500/30 p-5 rounded-2xl">
            <p className="text-[9px] text-amber-500/90 leading-relaxed uppercase font-black tracking-[0.2em]">
              {talentName} declined a previous invite. Sending again reopens it.
            </p>
          </div>
        )}

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

        <Button
          onClick={send}
          disabled={isSending || !position}
          className="w-full h-16 bg-white text-black font-black uppercase tracking-widest rounded-2xl hover:bg-amber-500 transition-all disabled:opacity-30"
        >
          {isSending ? <Loader2 className="animate-spin" /> : existing ? "Send Again" : "Send Invite"}
        </Button>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-zinc-950 border-white/10 rounded-[2.5rem] p-8 max-w-md">
        <DialogHeader className="space-y-4">
          <div className="w-16 h-16 bg-amber-500/10 rounded-2xl flex items-center justify-center mb-2">
            <Send className="w-8 h-8 text-amber-500" />
          </div>
          <DialogTitle className="text-3xl font-display uppercase italic tracking-tighter text-white leading-none">
            Invite {talentName}
          </DialogTitle>
          <DialogDescription className="text-zinc-500 text-[10px] font-black uppercase tracking-widest leading-relaxed">
            To work at {venueName}. They confirm before the link goes live.
          </DialogDescription>
        </DialogHeader>
        {renderBody()}
      </DialogContent>
    </Dialog>
  );
};
