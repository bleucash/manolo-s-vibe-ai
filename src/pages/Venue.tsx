import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserMode } from "@/contexts/UserModeContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TicketPurchaseDialog } from "@/components/TicketPurchaseDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import LoadingState from "@/components/ui/LoadingState";
import { InteractiveHeroReel } from "@/components/InteractiveHeroReel";
import {
  Briefcase,
  ArrowLeft,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Ticket,
  Zap,
  UserCheck,
  Phone,
  Mail,
  Building,
  MapPin,
  Settings,
} from "lucide-react";
import { toast } from "sonner";
import { Venue as VenueType } from "@/types/database";

const Venue = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { mode, session, isLoading: contextLoading } = useUserMode();

  const [venue, setVenue] = useState<VenueType | null>(null);
  const [loading, setLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<string | null>(null);
  const [purchaseOpen, setPurchaseOpen] = useState(false);

  // CLAIMING STATE
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
      toast.success("Claim Intelligence Received");
      setClaimDialogOpen(false);
      setClaimStatus("pending");
    } catch (err) {
      toast.error("Claim Sync Failed");
    } finally {
      setIsSubmittingClaim(false);
    }
  };

  const handleApply = async () => {
    if (!currentUserId || !id) return toast.error("Log in to initiate handshake.");
    try {
      const { error } = await supabase.from("venue_staff").insert({
        venue_id: id,
        user_id: currentUserId,
        status: "pending",
      });
      if (error) throw error;
      toast.success("Neural Application Dispatched");
      setConnectionStatus("pending");
    } catch (err) {
      toast.error("Connection already active.");
    }
  };

  /**
   * ✅ UNIFIED LOADING STRATEGY
   * Prevents "Blackout" flicker by using the localized loader
   */
  if (loading || contextLoading) return <LoadingState />;

  if (!venue) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-black p-6">
        <h1 className="font-display text-2xl text-white uppercase italic mb-4">Neural Path Terminated</h1>
        <Button
          onClick={() => navigate("/")}
          variant="outline"
          className="border-white/10 text-white font-black uppercase tracking-widest text-[9px]"
        >
          Return to Hub
        </Button>
      </div>
    );
  }

  const isOwner = venue.owner_id === currentUserId;

  return (
    <div className="min-h-screen bg-black pb-32 animate-in fade-in duration-700">
      {/* HEADER NAVIGATION */}
      <div className="fixed top-0 left-0 right-0 z-50 p-6 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(-1)}
          className="bg-black/40 backdrop-blur-xl rounded-full border border-white/5 text-white"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
      </div>

      {/* VENUE HERO */}
      <div className="relative h-[55vh] w-full overflow-hidden">
        {isOwner ? (
          <InteractiveHeroReel
            entityId={venue.id}
            entityType="venue"
            currentReelUrl={venue.hero_reel_url}
            fallbackImageUrl={venue.image_url || "/placeholder.svg"}
            isOwner={true}
          />
        ) : (
          <img
            src={venue.image_url || "/placeholder.svg"}
            alt={venue.name}
            className="w-full h-full object-cover transition-transform duration-1000 scale-105"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
        <div className="absolute bottom-12 left-8 right-8 z-20">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1.5 h-1.5 bg-[#FF5F1F] rounded-full shadow-[0_0_8px_#FF5F1F]" />
            <p className="text-[10px] font-black text-white/60 uppercase tracking-[0.3em]">Sector Verified</p>
          </div>
          <h1 className="font-display text-7xl text-white uppercase tracking-tighter leading-none italic mb-4">
            {venue.name}
          </h1>
          <div className="flex items-center gap-4">
            {venue.is_active && (
              <Badge className="bg-neon-green/15 backdrop-blur-md text-neon-green border-neon-green/30 uppercase text-[9px] font-black tracking-widest px-4 py-1.5 rounded-full flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-neon-green animate-pulse" />
                Active
              </Badge>
            )}
            <Badge className="bg-white/5 backdrop-blur-md text-white border-white/10 uppercase text-[9px] font-black tracking-widest px-4 py-1.5 rounded-full">
              <MapPin className="w-3 h-3 mr-2 text-zinc-500" /> {venue.location}
            </Badge>
          </div>
        </div>
      </div>

      {/* ACTION ZONE */}
      <div className="px-8 -mt-10 relative z-30 mb-12">
        {mode === "talent" ? (
          <Button
            size="lg"
            onClick={handleApply}
            disabled={!!connectionStatus}
            className={`w-full h-20 text-[11px] font-black uppercase tracking-[0.3em] rounded-[2rem] shadow-2xl transition-all ${
              connectionStatus === "active"
                ? "bg-zinc-900 border border-neon-purple/30 text-neon-purple"
                : "bg-neon-purple text-white hover:shadow-[0_0_30px_rgba(191,0,255,0.3)]"
            }`}
          >
            {connectionStatus === "active" ? (
              <>
                <CheckCircle2 className="mr-3 w-5 h-5" /> Verified Performer
              </>
            ) : connectionStatus === "pending" ? (
              <>
                <Clock className="mr-3 w-5 h-5 animate-pulse" /> Handshake Pending
              </>
            ) : (
              <>
                <Briefcase className="mr-3 w-5 h-5" /> Submit Neural App
              </>
            )}
          </Button>
        ) : mode === "manager" && isOwner ? (
          <Button
            size="lg"
            onClick={() => navigate(`/dashboard`)}
            className="w-full h-20 text-[11px] font-black uppercase tracking-[0.3em] rounded-[2rem] bg-white text-black hover:bg-neon-green transition-all shadow-2xl"
          >
            <ShieldCheck className="mr-3 w-5 h-5" /> Operation Control
          </Button>
        ) : (
          <div className="space-y-4">
            <Button
              size="lg"
              onClick={() => setPurchaseOpen(true)}
              className="w-full h-20 text-[11px] font-black uppercase tracking-[0.3em] rounded-[2rem] bg-neon-green text-black hover:shadow-[0_0_25px_#39FF14] transition-all"
            >
              <Ticket className="mr-3 w-5 h-5 fill-black" /> Secure Entry
            </Button>

            {venue.owner_id === null && (
              <div className="p-8 border border-[#FF5F1F]/20 bg-[#FF5F1F]/5 rounded-[2.5rem] text-center mt-6">
                <p className="text-[9px] font-black text-[#FF5F1F]/60 uppercase tracking-[0.4em] mb-4 flex items-center justify-center gap-2">
                  <Zap className="w-3 h-3 animate-pulse" /> Unclaimed Intelligence
                </p>
                {claimStatus === "pending" ? (
                  <div className="flex flex-col items-center gap-2 py-2">
                    <Clock className="w-5 h-5 text-zinc-600 animate-pulse" />
                    <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest italic">
                      Verification in Progress
                    </span>
                  </div>
                ) : (
                  <Button
                    onClick={() => setClaimDialogOpen(true)}
                    variant="outline"
                    className="w-full h-14 bg-black/40 border-[#FF5F1F]/40 text-white font-black uppercase tracking-widest text-[9px] hover:bg-[#FF5F1F] hover:text-white transition-all rounded-2xl"
                  >
                    Claim This Sector
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* INTELLIGENCE TABS */}
      <Tabs defaultValue="vibe" className="w-full px-8">
        <TabsList className="w-full bg-zinc-900/40 p-1 border border-white/5 rounded-2xl h-12 mb-8">
          <TabsTrigger
            value="vibe"
            className="flex-1 text-[9px] font-black uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:text-black rounded-xl"
          >
            Intel
          </TabsTrigger>
          <TabsTrigger
            value="amenities"
            className="flex-1 text-[9px] font-black uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:text-black rounded-xl"
          >
            Specs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="vibe" className="animate-in slide-in-from-bottom-2 duration-500">
          <div className="flex items-center gap-2 mb-4">
            <Settings className="w-3 h-3 text-zinc-600" />
            <h3 className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Description</h3>
          </div>
          <p className="text-zinc-400 text-sm leading-relaxed font-medium mb-8">
            {venue.description || "No transmission data found for this node."}
          </p>
        </TabsContent>
      </Tabs>

      {/* NEURAL CLAIM DIALOG */}
      <Dialog open={claimDialogOpen} onOpenChange={setClaimDialogOpen}>
        <DialogContent className="bg-black border-white/5 text-white max-w-lg rounded-[2.5rem] p-0 overflow-hidden shadow-[0_0_50px_rgba(255,95,31,0.1)]">
          <div className="p-8 border-b border-white/5 bg-zinc-900/40">
            <DialogTitle className="text-4xl font-display uppercase italic tracking-tighter mb-1">
              Sector Claim
            </DialogTitle>
            <DialogDescription className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
              Submit legal intel for credential verification.
            </DialogDescription>
          </div>
          <form onSubmit={handleClaimSubmit} className="space-y-6 p-8">
            <div className="space-y-4">
              <div className="relative group">
                <UserCheck className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 group-focus-within:text-[#FF5F1F]" />
                <input
                  name="legalName"
                  required
                  placeholder="LEGAL REPRESENTATIVE"
                  className="w-full bg-zinc-900/50 border border-white/5 rounded-2xl py-5 pl-14 text-[10px] uppercase font-black placeholder:text-zinc-700 focus:border-[#FF5F1F]/50 transition-all outline-none"
                />
              </div>
              <div className="relative group">
                <Building className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 group-focus-within:text-[#FF5F1F]" />
                <input
                  name="title"
                  required
                  placeholder="POSITION / TITLE"
                  className="w-full bg-zinc-900/50 border border-white/5 rounded-2xl py-5 pl-14 text-[10px] uppercase font-black placeholder:text-zinc-700 focus:border-[#FF5F1F]/50 transition-all outline-none"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="relative group">
                  <Mail className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                  <input
                    name="email"
                    type="email"
                    required
                    placeholder="BUSINESS EMAIL"
                    className="w-full bg-zinc-900/50 border border-white/5 rounded-2xl py-5 pl-14 text-[10px] uppercase font-black placeholder:text-zinc-700 focus:border-[#FF5F1F]/50 transition-all outline-none"
                  />
                </div>
                <div className="relative group">
                  <Phone className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                  <input
                    name="phone"
                    required
                    placeholder="CONTACT PHONE"
                    className="w-full bg-zinc-900/50 border border-white/5 rounded-2xl py-5 pl-14 text-[10px] uppercase font-black placeholder:text-zinc-700 focus:border-[#FF5F1F]/50 transition-all outline-none"
                  />
                </div>
              </div>
            </div>
            <Button
              disabled={isSubmittingClaim}
              type="submit"
              className="w-full h-16 bg-[#FF5F1F] text-white font-black uppercase tracking-widest rounded-2xl shadow-xl hover:scale-[1.02] active:scale-95 transition-all"
            >
              {isSubmittingClaim ? "Synchronizing..." : "Transmit Claim Intelligence"}
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
