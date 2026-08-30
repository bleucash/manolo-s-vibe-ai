import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserMode } from "@/contexts/UserModeContext";
import { VERIFICATION_INSTAGRAM_HANDLE } from "@/config/brand";
import { checkOtherTrackConflict } from "@/lib/roleClaims";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Instagram, Sparkles, Zap, Loader2, Copy, Check } from "lucide-react";
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

  // Once an application exists, the modal stops being a form and becomes the
  // place the applicant comes back to read their code. Non-null = show code.
  const [issuedCode, setIssuedCode] = useState<string | null>(null);
  const [isLoadingExisting, setIsLoadingExisting] = useState(false);
  const [copied, setCopied] = useState(false);

  // Reopening must show the SAME code, not a new one, or the code they already
  // DM'd stops matching what the reviewer sees. The code lives on the row, so
  // re-reading the open application is what makes it stable.
  useEffect(() => {
    if (!isOpen || !session?.user?.id) return;

    let cancelled = false;
    setIsLoadingExisting(true);

    supabase
      .from("talent_applications")
      .select("verification_code, instagram_handle")
      .eq("user_id", session.user.id)
      .eq("status", "pending")
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        // A read failure here is not worth blocking on: fall through to the
        // form, and the 23505 path below still catches the duplicate.
        if (error) console.error(error);
        if (data) {
          setIssuedCode(data.verification_code);
          setInstagram(data.instagram_handle ?? "");
        }
        setIsLoadingExisting(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, session?.user?.id]);

  const handleApply = async () => {
    // Strip leading @ first, then validate. ClaimSectorModal's equivalent
    // check is `!includes("@") && length < 3`, which short-circuits so a bare
    // "@" passes; not replicated here.
    const handle = instagram.trim().replace(/^@+/, "");
    if (handle.length < 3) {
      toast.error("Invalid IG Handle", { description: "Please enter a valid Instagram username." });
      return;
    }

    // Was `session?.user?.id ?? ""` at the conflict check and a bare
    // `session?.user?.id` in the insert. The empty-string default is worse
    // than useless: it conflicts with nothing, so a signed-out user would
    // clear the role check and then insert an application with a null
    // user_id. One guard for both call sites, and it fails loudly.
    const userId = session?.user?.id;
    if (!userId) {
      toast.error("Session Expired", { description: "Please sign in again to apply." });
      return;
    }

    setIsSubmitting(true);
    try {
      // One role per account, enforced here rather than only at approval.
      // Checked inside the submitting guard so the button stays disabled for
      // the duration of the round trip.
      const conflict = await checkOtherTrackConflict(userId, "talent");
      if (conflict) {
        toast.error(conflict.title, { description: conflict.description });
        return;
      }

      // verification_code is never sent from here. It is a column default, so
      // the value comes back from the insert rather than going into it.
      const { data, error } = await supabase
        .from("talent_applications")
        .insert({
          user_id: userId,
          instagram_handle: handle,
          status: "pending"
        })
        .select("verification_code")
        .single();

      if (error) throw error;

      setIssuedCode(data.verification_code);
      onSubmitted?.();
    } catch (err: any) {
      // 23505 = the talent_applications_one_pending_per_user partial unique
      // index. Means an application is already open, not a system failure.
      // Show them that application's code instead of closing on an error.
      if (err?.code === "23505") {
        const { data } = await supabase
          .from("talent_applications")
          .select("verification_code")
          .eq("user_id", userId)
          .eq("status", "pending")
          .maybeSingle();

        if (data) {
          setIssuedCode(data.verification_code);
        } else {
          toast.error("Application Already Open", {
            description: "You already have an application under review."
          });
          onClose();
        }
        return;
      }
      console.error(err);
      toast.error("System Error", { description: "Could not submit application. Try again." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopy = async () => {
    if (!issuedCode) return;
    try {
      await navigator.clipboard.writeText(issuedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard is blocked on insecure origins and in some in-app browsers.
      // The code is on screen and only 6 characters, so typing it is fine.
      toast.error("Copy Blocked", { description: "Type the code manually instead." });
    }
  };

  const showingCode = issuedCode !== null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-zinc-950 border-white/10 rounded-[2.5rem] p-8 max-w-md">
        <DialogHeader className="space-y-4">
          <div className="w-16 h-16 bg-neon-purple/10 rounded-2xl flex items-center justify-center mb-2">
            <Sparkles className="w-8 h-8 text-neon-purple" />
          </div>
          <DialogTitle className="text-3xl font-display uppercase italic tracking-tighter text-white leading-none">
            {showingCode ? "Confirm It's You" : "Are You Talent?"}
          </DialogTitle>
          <DialogDescription className="text-zinc-500 text-[10px] font-black uppercase tracking-widest leading-relaxed">
            {showingCode
              ? `DM this code from @${instagram} to prove the account is yours.`
              : "Every claim is checked against the Instagram it names before anything unlocks."}
          </DialogDescription>
        </DialogHeader>

        {isLoadingExisting ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 text-neon-purple animate-spin" />
          </div>
        ) : showingCode ? (
          <div className="space-y-6 mt-6">
            <button
              onClick={handleCopy}
              className="w-full bg-white/5 border border-neon-green/30 rounded-2xl py-8 flex flex-col items-center gap-3 hover:border-neon-green transition-all active:scale-[0.98]"
            >
              <span className="font-display text-4xl text-neon-green tracking-[0.3em] pl-[0.3em]">
                {issuedCode}
              </span>
              <span className="text-[9px] text-zinc-500 font-black uppercase tracking-widest flex items-center gap-2">
                {copied ? (
                  <>
                    <Check className="w-3 h-3 text-neon-green" /> Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" /> Tap to copy
                  </>
                )}
              </span>
            </button>

            <div className="bg-zinc-900/50 p-6 rounded-2xl border border-white/5 space-y-3">
              <p className="text-[9px] text-zinc-400 leading-relaxed uppercase font-black tracking-[0.2em]">
                <Instagram className="w-3 h-3 text-neon-pink inline mr-2" />
                Send this code as a direct message to @{VERIFICATION_INSTAGRAM_HANDLE} from
                @{instagram}. We approve once the DM arrives from that account.
              </p>
              <p className="text-[9px] text-zinc-600 leading-relaxed uppercase font-black tracking-[0.2em] border-t border-white/5 pt-3">
                Sending from a different account will not verify you.
              </p>
            </div>

            <a
              href={`https://instagram.com/${VERIFICATION_INSTAGRAM_HANDLE}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block"
            >
              <Button className="w-full h-16 bg-white text-black font-black uppercase tracking-widest rounded-2xl hover:bg-neon-pink transition-all">
                Open @{VERIFICATION_INSTAGRAM_HANDLE}
              </Button>
            </a>

            <Button
              variant="ghost"
              onClick={onClose}
              className="w-full text-zinc-500 uppercase text-[9px] font-black tracking-widest"
            >
              Done
            </Button>
          </div>
        ) : (
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
        )}
      </DialogContent>
    </Dialog>
  );
};
