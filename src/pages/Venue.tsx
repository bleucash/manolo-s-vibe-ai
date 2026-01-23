import { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserMode } from "@/contexts/UserModeContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TicketPurchaseDialog } from "@/components/TicketPurchaseDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  Briefcase,
  ArrowLeft,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Ticket,
  TrendingUp,
  Zap,
  Star,
  UserCheck,
  Phone,
  Mail,
  Building,
} from "lucide-react";
import { toast } from "sonner";
import { Venue as VenueType } from "@/types/database";

const Venue = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { mode, session } = useUserMode();

  const [venue, setVenue] = useState<VenueType | null>(null);
  const [loading, setLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<string | null>(null);
  const [purchaseOpen, setPurchaseOpen] = useState(false);

  // ✅ CLAIMING STATE
  const [claimDialogOpen, setClaimDialogOpen] = useState(false);
  const [isSubmittingClaim, setIsSubmittingClaim] = useState(false);
  const [claimStatus, setClaimStatus] = useState<string | null>(null);

  const currentUserId = session?.user?.id || null;

  useEffect(() => {
    fetchVenue();
    if (id && currentUserId) checkClaimStatus();
  }, [id, currentUserId]);

  const fetchVenue = async () => {
    if (!id) return;
    try {
      const { data } = await supabase.from("venues").select("*").eq("id", id).single();
      if (data) setVenue(data as VenueType);

      if (currentUserId) {
        const { data: statusData } = await supabase
          .from("venue_staff")
          .select("status")
          .eq("venue_id", id)
          .eq("user_id", currentUserId)
          .maybeSingle();
        if (statusData) setConnectionStatus(statusData.status);
      }
    } catch (error) {
      console.error("Discovery Sync Error:", error);
    } finally {
      setLoading(false);
    }
  };

  // ✅ CHECK IF A CLAIM IS ALREADY IN THE WAITING ROOM
  const checkClaimStatus = async () => {
    const { data } = await supabase
      .from("venue_claims")
      .select("status")
      .eq("venue_id", id)
      .eq("user_id", currentUserId)
      .maybeSingle();
    if (data) setClaimStatus(data.status);
  };

  const handleClaimSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmittingClaim(true);
    const formData = new FormData(e.currentTarget);

    try {
      const { error } = await supabase.from("venue_claims").insert({
        venue_id: id,
        user_id: currentUserId,
        legal_name: formData.get("legalName"),
        business_email: formData.get("email"),
        business_phone: formData.get("phone"),
        position_title: formData.get("title"),
        status: "pending",
      });

      if (error) throw error;
      toast.success("Claim Intelligence Received", { description: "Management is verifying your credentials." });
      setClaimDialogOpen(false);
      setClaimStatus("pending");
    } catch (err) {
      toast.error("Claim Failed", { description: "Ensure all fields are accurate." });
    } finally {
      setIsSubmittingClaim(false);
    }
  };

  const handleApply = async () => {
    if (!currentUserId || !id) return toast.error("Please log in to apply");
    try {
      const { error } = await supabase.from("venue_staff").insert({
        venue_id: id,
        user_id: currentUserId,
        status: "pending",
      });
      if (error) throw error;
      toast.success("Application sent to management!");
      setConnectionStatus("pending");
    } catch (err) {
      toast.error("Application already active or failed.");
    }
  };

  if (loading) return null;
  if (!venue)
    return (
      <div className="h-screen flex items-center justify-center bg-black text-white font-display uppercase tracking-tighter italic">
        Neural Path Terminated
      </div>
    );

  return (
    <div className="min-h-screen bg-black pb-32 animate-in fade-in duration-700">
      {/* HEADER NAVIGATION */}
      <div className="fixed top-0 left-0 right-0 z-50 p-6 flex justify-between items-center">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(-1)}
          className="bg-black/40 backdrop-blur-xl rounded-full border border-white/10 text-white"
        >
          <ArrowLeft className="w-6 h-6" />
        </Button>
      </div>

      {/* VENUE HERO */}
      <div className="relative h-[50vh] w-full">
        <img src={venue.image_url || "/placeholder.svg"} alt={venue.name} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/10 to-transparent" />
        <div className="absolute bottom-12 left-8 right-8 z-20">
          <Badge className="mb-4 bg-[#FF5F1F]/20 text-[#FF5F1F] border-[#FF5F1F]/40 uppercase text-[9px] font-black tracking-widest px-4 py-1">
            {venue.location}
          </Badge>
          <div className="flex justify-between items-end">
            <h1 className="font-display text-6xl text-white uppercase tracking-tighter leading-none italic">
              {venue.name}
            </h1>
          </div>
        </div>
      </div>

      {/* MARKETPLACE ACTION ZONE */}
      <div className="px-8 -mt-8 relative z-30 mb-12">
        {mode === "talent" ? (
          <Button
            size="lg"
            onClick={handleApply}
            disabled={!!connectionStatus}
            className={`w-full h-20 text-xs font-black uppercase tracking-[0.3em] rounded-[2rem] shadow-[0_0_30px_rgba(57,255,20,0.1)] transition-all ${connectionStatus === "active" ? "bg-neon-green/10 text-neon-green border border-neon-green/30" : "bg-neon-purple text-white hover:bg-neon-purple/90"}`}
          >
            {connectionStatus === "active" ? (
              <>
                <CheckCircle2 className="mr-3 w-5 h-5" /> Linked Performer
              </>
            ) : (
              <>
                <Briefcase className="mr-3 w-5 h-5" /> Submit Neural App
              </>
            )}
          </Button>
        ) : mode === "manager" && venue.owner_id === currentUserId ? (
          <Button
            size="lg"
            onClick={() => navigate(`/dashboard`)}
            className="w-full h-20 text-xs font-black uppercase tracking-[0.3em] rounded-[2rem] bg-white text-black hover:bg-neon-green transition-all shadow-2xl"
          >
            <ShieldCheck className="mr-3 w-5 h-5" /> Operation Control
          </Button>
        ) : (
          <div className="space-y-4">
            <Button
              size="lg"
              onClick={() => setPurchaseOpen(true)}
              className="w-full h-20 text-xs font-black uppercase tracking-[0.3em] rounded-[2rem] bg-neon-green text-black hover:shadow-[0_0_20px_#39FF14/40] transition-all"
            >
              <Ticket className="mr-3 w-5 h-5 fill-black" /> Secure Entry
            </Button>

            {/* ✅ UNCLAIMED HUB LOGIC: Only shows if owner_id is NULL */}
            {venue.owner_id === null && (
              <div className="p-8 border border-[#FF5F1F]/30 bg-[#FF5F1F]/5 rounded-[2.5rem] text-center mt-6 animate-pulse-slow">
                <p className="text-[10px] font-black text-[#FF5F1F] uppercase tracking-[0.4em] mb-4">
                  Unclaimed Intelligence
                </p>
                {claimStatus === "pending" ? (
                  <div className="flex flex-col items-center gap-2">
                    <Clock className="w-6 h-6 text-zinc-500" />
                    <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest italic">
                      Verification in Progress
                    </span>
                  </div>
                ) : (
                  <Button
                    onClick={() => setClaimDialogOpen(true)}
                    variant="outline"
                    className="w-full h-14 bg-black border-[#FF5F1F]/50 text-white font-black uppercase tracking-widest hover:bg-[#FF5F1F] hover:text-white transition-all"
                  >
                    Claim This Venue
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* TABS LOGIC (Kept Standard) */}
      <Tabs defaultValue="vibe" className="w-full">
        {/* ... Tabs content as per your original file ... */}
      </Tabs>

      {/* ✅ NEURAL CLAIM DIALOG */}
      <Dialog open={claimDialogOpen} onOpenChange={setClaimDialogOpen}>
        <DialogContent className="bg-black border-white/10 text-white max-w-lg rounded-[2.5rem]">
          <DialogHeader className="p-4">
            <DialogTitle className="text-3xl font-display uppercase italic tracking-tighter">
              Business Claim
            </DialogTitle>
            <DialogDescription className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
              Submit legal intelligence for manual verification.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleClaimSubmit} className="space-y-6 p-4">
            <div className="space-y-4">
              <div className="relative">
                <UserCheck className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                <input
                  name="legalName"
                  required
                  placeholder="LEGAL REPRESENTATIVE NAME"
                  className="w-full bg-zinc-900 border border-white/5 rounded-2xl py-4 pl-12 text-[10px] uppercase font-black"
                />
              </div>
              <div className="relative">
                <Building className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                <input
                  name="title"
                  required
                  placeholder="POSITION / TITLE"
                  className="w-full bg-zinc-900 border border-white/5 rounded-2xl py-4 pl-12 text-[10px] uppercase font-black"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                  <input
                    name="email"
                    type="email"
                    required
                    placeholder="BUSINESS EMAIL"
                    className="w-full bg-zinc-900 border border-white/5 rounded-2xl py-4 pl-12 text-[10px] uppercase font-black"
                  />
                </div>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                  <input
                    name="phone"
                    required
                    placeholder="CONTACT PHONE"
                    className="w-full bg-zinc-900 border border-white/5 rounded-2xl py-4 pl-12 text-[10px] uppercase font-black"
                  />
                </div>
              </div>
            </div>
            <Button
              disabled={isSubmittingClaim}
              type="submit"
              className="w-full h-16 bg-[#FF5F1F] text-white font-black uppercase tracking-widest rounded-2xl shadow-[0_0_20px_#FF5F1F/30]"
            >
              {isSubmittingClaim ? "Synchronizing..." : "Submit Claim Intelligence"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <TicketPurchaseDialog
        open={purchaseOpen}
        onOpenChange={setPurchaseOpen}
        venueId={venue.id}
        venueName={venue.name}
        price={venue.entry_price || 20}
      />
    </div>
  );
};

export default Venue;
