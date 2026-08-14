import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserMode } from "@/contexts/UserModeContext";
import { checkOtherTrackConflict } from "@/lib/roleClaims";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Building2, Instagram, Search, Loader2, Check } from "lucide-react";
import { toast } from "sonner";

interface ClaimVenueModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitted?: () => void;
}

/**
 * Manager entry point from Profile. Same venue_claims submission as
 * ClaimSectorModal, reached the other way round: ClaimSectorModal starts from a
 * venue you are already looking at, this starts from the question and picks the
 * venue second. Both surfaces coexist on purpose.
 */
export const ClaimVenueModal = ({ isOpen, onClose, onSubmitted }: ClaimVenueModalProps) => {
  const { session } = useUserMode();
  const [venues, setVenues] = useState<any[]>([]);
  const [isLoadingVenues, setIsLoadingVenues] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedVenue, setSelectedVenue] = useState<any>(null);
  const [instagram, setInstagram] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Only unclaimed venues are offered. A venue with an owner is not claimable,
  // and showing it would present a dead end rather than a choice.
  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    setIsLoadingVenues(true);

    supabase
      .from("venues")
      .select("id, name, location")
      .is("owner_id", null)
      .order("name")
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) console.error(error);
        setVenues(data ?? []);
        setIsLoadingVenues(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const resetAndClose = () => {
    setSelectedVenue(null);
    setInstagram("");
    setSearch("");
    onClose();
  };

  const handleClaim = async () => {
    const handle = instagram.trim().replace(/^@+/, "");
    if (handle.length < 3) {
      toast.error("Invalid IG Handle", { description: "Please enter a valid Instagram username." });
      return;
    }
    if (!selectedVenue) return;

    setIsSubmitting(true);
    try {
      const conflict = await checkOtherTrackConflict(session?.user?.id ?? "", "manager");
      if (conflict) {
        toast.error(conflict.title, { description: conflict.description });
        return;
      }

      const { error } = await supabase.from("venue_claims").insert({
        user_id: session?.user?.id,
        venue_id: selectedVenue.id,
        instagram_handle: handle,
        status: "pending",
      });

      if (error) throw error;

      toast.success("Claim Filed", {
        description: "We verify the Instagram you named before this venue is assigned.",
      });
      onSubmitted?.();
      resetAndClose();
    } catch (err: any) {
      // unique_venue_claim is UNIQUE (venue_id, status), not per user, so a
      // pending claim by anyone else on this venue collides here. That is a
      // queue conflict, not a system fault, and the applicant can retry later.
      if (err?.code === "23505") {
        toast.error("Already Under Review", {
          description: "A claim on this venue is already being verified.",
        });
        return;
      }
      console.error(err);
      toast.error("System Error", { description: "Could not file claim. Try again." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const filtered = venues.filter((v) =>
    `${v.name} ${v.location ?? ""}`.toLowerCase().includes(search.trim().toLowerCase()),
  );

  return (
    <Dialog open={isOpen} onOpenChange={resetAndClose}>
      <DialogContent className="bg-zinc-950 border-white/10 rounded-[2.5rem] p-8 max-w-md">
        <DialogHeader className="space-y-4">
          <div className="w-16 h-16 bg-neon-blue/10 rounded-2xl flex items-center justify-center mb-2">
            <Building2 className="w-8 h-8 text-neon-blue" />
          </div>
          <DialogTitle className="text-3xl font-display uppercase italic tracking-tighter text-white leading-none">
            Do You Manage a Venue?
          </DialogTitle>
          <DialogDescription className="text-zinc-500 text-[10px] font-black uppercase tracking-widest leading-relaxed">
            {selectedVenue
              ? `Claiming ${selectedVenue.name}. We verify the Instagram you name.`
              : "Pick the venue you run. Every claim is checked before it is granted."}
          </DialogDescription>
        </DialogHeader>

        {!selectedVenue ? (
          <div className="space-y-4 mt-6">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search venues"
                className="h-14 pl-11 bg-white/5 border-white/10 rounded-2xl text-white font-bold uppercase tracking-widest focus:border-neon-blue transition-all"
              />
            </div>

            <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
              {isLoadingVenues ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="w-5 h-5 text-neon-blue animate-spin" />
                </div>
              ) : filtered.length === 0 ? (
                <p className="text-[9px] text-zinc-600 font-black uppercase tracking-[0.2em] text-center py-10 leading-relaxed">
                  {venues.length === 0
                    ? "Every venue is currently claimed."
                    : "No venue matches that search."}
                </p>
              ) : (
                filtered.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => setSelectedVenue(v)}
                    className="w-full text-left px-5 py-4 rounded-2xl bg-white/5 border border-white/5 hover:border-neon-blue/50 transition-all active:scale-[0.99]"
                  >
                    <p className="text-white font-black uppercase text-[11px] tracking-widest">{v.name}</p>
                    {v.location && (
                      <p className="text-[9px] text-zinc-600 font-black uppercase tracking-[0.2em] mt-1">
                        {v.location}
                      </p>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-6 mt-6">
            <button
              onClick={() => setSelectedVenue(null)}
              className="w-full flex items-center justify-between px-5 py-4 rounded-2xl bg-neon-blue/5 border border-neon-blue/30"
            >
              <span className="text-white font-black uppercase text-[11px] tracking-widest">
                {selectedVenue.name}
              </span>
              <span className="text-[9px] text-neon-blue font-black uppercase tracking-widest flex items-center gap-2">
                <Check className="w-3 h-3" /> Change
              </span>
            </button>

            <div className="relative">
              <Instagram className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neon-pink" />
              <Input
                value={instagram}
                onChange={(e) => setInstagram(e.target.value)}
                placeholder="@venue_official_ig"
                className="h-16 pl-12 bg-white/5 border-white/10 rounded-2xl text-white font-bold uppercase tracking-widest focus:border-neon-pink transition-all"
              />
            </div>

            <Button
              onClick={handleClaim}
              disabled={isSubmitting}
              className="w-full h-16 bg-white text-black font-black uppercase tracking-widest rounded-2xl hover:bg-neon-blue transition-all"
            >
              {isSubmitting ? <Loader2 className="animate-spin" /> : "Initiate Handshake"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
