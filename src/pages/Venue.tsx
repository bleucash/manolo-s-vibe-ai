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
import {
  Briefcase,
  ArrowLeft,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Ticket,
  Zap,
  UserCheck,
  Building,
  MapPin,
  Settings,
  Phone,
  Mail,
  Activity,
  Flame,
  Users,
  Radio,
} from "lucide-react";
import { toast } from "sonner";
import { Venue as VenueType } from "@/types/database";
import { cn } from "@/lib/utils";

const Venue = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { mode, session, isLoading: contextLoading } = useUserMode();

  const [venue, setVenue] = useState<VenueType | null>(null);
  const [liveTalent, setLiveTalent] = useState<any[]>([]);
  const [heatIndex, setHeatIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<string | null>(null);
  const [purchaseOpen, setPurchaseOpen] = useState(false);

  // CLAIMING STATE
  const [claimDialogOpen, setClaimDialogOpen] = useState(false);
  const [isSubmittingClaim, setIsSubmittingClaim] = useState(false);
  const [claimStatus, setClaimStatus] = useState<string | null>(null);

  const currentUserId = session?.user?.id || null;

  useEffect(() => {
    const initializeSector = async () => {
      if (!id) return;
      setLoading(true);
      await Promise.all([fetchVenue(), fetchLiveTalent(), fetchHeatIndex(), ifAuthenticated(checkClaimStatus)]);
      setLoading(false);
    };
    initializeSector();
  }, [id, currentUserId]);

  const ifAuthenticated = (fn: () => Promise<void>) => (currentUserId ? fn() : Promise.resolve());

  const fetchVenue = async () => {
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
      console.error("Sector Sync Error:", error);
    }
  };

  const fetchLiveTalent = async () => {
    // 📡 UPLINK LOGIC: Fetch profiles currently clocked into this venue_id
    const { data } = await supabase
      .from("profiles")
      .select("id, display_name, avatar_url, venue_id, sub_role")
      .eq("venue_id", id)
      .eq("role_type", "talent");
    if (data) setLiveTalent(data);
  };

  const fetchHeatIndex = async () => {
    // 🔥 ENERGY METER: Calculate heat based on last 24h interactions
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from("interactions")
      .select("*", { count: "exact", head: true })
      .eq("target_id", id)
      .gte("created_at", twentyFourHoursAgo);

    // Simple normalization for the UI: 100 interactions = 100% heat
    setHeatIndex(Math.min((count || 0) * 5, 100));
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

  if (loading || contextLoading) return <LoadingState />;
  if (!venue)
    return (
      <div className="h-screen flex items-center justify-center bg-black text-white italic">Neural Path Terminated</div>
    );

  const isOwner = venue.owner_id === currentUserId;

  return (
    <div className="min-h-screen bg-black pb-32 animate-in fade-in duration-700">
      {/* 🛠 GLASS HUD NAVIGATION */}
      <div className="fixed top-0 left-0 right-0 z-50 p-6 flex justify-between items-center bg-black/20 backdrop-blur-md border-b border-white/5">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(-1)}
          className="w-10 h-10 bg-black/40 backdrop-blur-xl rounded-full border border-white/10 text-white"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-neon-blue animate-pulse" />
          <span className="text-[10px] font-black text-white uppercase tracking-[0.3em]">Sector Intelligence</span>
        </div>
        <div className="w-10" /> {/* Spacer */}
      </div>

      {/* VENUE HERO */}
      <div className="relative h-[60vh] w-full overflow-hidden">
        <img
          src={venue.image_url || "/placeholder.svg"}
          alt={venue.name}
          className="w-full h-full object-cover animate-in zoom-in-105 duration-[10000ms]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/60" />

        <div className="absolute bottom-16 left-8 right-8 z-20">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-2 h-2 bg-neon-green rounded-full animate-pulse shadow-[0_0_10px_#39FF14]" />
            <p className="text-[10px] font-black text-white uppercase tracking-[0.4em]">Active Sector</p>
          </div>
          <h1 className="font-display text-[clamp(3rem,12vw,6rem)] text-white uppercase tracking-tighter leading-[0.8] italic mb-6">
            {venue.name}
          </h1>
          <div className="flex items-center gap-4">
            <Badge className="bg-white/5 backdrop-blur-md text-white border-white/10 uppercase text-[10px] font-black tracking-widest px-6 py-2 rounded-full">
              <MapPin className="w-3.5 h-3.5 mr-2 text-neon-blue" /> {venue.location}
            </Badge>
          </div>
        </div>
      </div>

      {/* 🚀 UPLINK STRIP: Live Talent Currently at Venue */}
      {liveTalent.length > 0 && (
        <div className="px-8 -mt-8 relative z-40 mb-12">
          <div className="bg-zinc-950/80 backdrop-blur-2xl border border-white/5 rounded-[2.5rem] p-6 shadow-2xl">
            <div className="flex items-center gap-2 mb-4 px-2">
              <Radio className="w-3 h-3 text-neon-green animate-pulse" />
              <h3 className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.3em]">Live Uplinks</h3>
            </div>
            <div className="flex overflow-x-auto gap-5 hide-scrollbar py-2">
              {liveTalent.map((talent) => (
                <div
                  key={talent.id}
                  onClick={() => navigate(`/talent/${talent.id}`)}
                  className="flex flex-col items-center gap-2 shrink-0 cursor-pointer group"
                >
                  <div className="relative w-16 h-16 rounded-2xl border-2 border-neon-blue p-0.5 group-hover:scale-110 transition-all duration-500">
                    <img
                      src={talent.avatar_url || "/placeholder.svg"}
                      className="w-full h-full object-cover rounded-[0.8rem]"
                      alt=""
                    />
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-black border border-white/20 rounded-full flex items-center justify-center">
                      <div className="w-1.5 h-1.5 bg-neon-green rounded-full animate-pulse" />
                    </div>
                  </div>
                  <span className="text-[8px] font-black text-white/40 uppercase tracking-widest truncate w-16 text-center">
                    {talent.display_name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ACTION ZONE: Conversion Handshake */}
      <div className={cn("px-8 relative z-30 mb-12", liveTalent.length === 0 && "-mt-10")}>
        {mode === "talent" ? (
          <Button
            size="lg"
            onClick={handleApply}
            disabled={!!connectionStatus}
            className={cn(
              "w-full h-20 text-[11px] font-black uppercase tracking-[0.3em] rounded-[2rem] shadow-2xl transition-all",
              connectionStatus === "active"
                ? "bg-zinc-900 border border-neon-purple/30 text-neon-purple"
                : "bg-neon-purple text-white hover:shadow-[0_0_30px_#BF00FF30]",
            )}
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
              className="w-full h-20 text-[11px] font-black uppercase tracking-[0.3em] rounded-[2rem] bg-neon-green text-black hover:shadow-[0_0_30px_#39FF1440] transition-all border-none"
            >
              <Ticket className="mr-3 w-5 h-5 fill-black" /> Secure Entry • ${venue.entry_price || "20.00"}
            </Button>

            {!venue.owner_id && (
              <div className="p-8 border border-orange-500/20 bg-orange-500/5 rounded-[2.5rem] text-center mt-6">
                <p className="text-[9px] font-black text-orange-500/60 uppercase tracking-[0.4em] mb-4 flex items-center justify-center gap-2">
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
                    className="w-full h-14 bg-black/40 border-orange-500/40 text-white font-black uppercase tracking-widest text-[9px] hover:bg-orange-500 hover:text-white transition-all rounded-2xl"
                  >
                    Claim This Sector
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 📊 ENERGY HUD */}
      <div className="px-8 grid grid-cols-2 gap-4 mb-12">
        <div className="bg-zinc-900/40 rounded-[2rem] p-6 border border-white/5 flex flex-col items-center">
          <Flame className={cn("w-6 h-6 mb-3", heatIndex > 50 ? "text-orange-500 animate-bounce" : "text-zinc-700")} />
          <span className="text-2xl font-display italic text-white">{heatIndex}%</span>
          <span className="text-[8px] font-black uppercase text-zinc-600 tracking-widest mt-2">Heat Index</span>
        </div>
        <div className="bg-zinc-900/40 rounded-[2rem] p-6 border border-white/5 flex flex-col items-center">
          <Users className="w-6 h-6 text-neon-blue mb-3" />
          <span className="text-2xl font-display italic text-white">{venue.capacity || "500"}</span>
          <span className="text-[8px] font-black uppercase text-zinc-600 tracking-widest mt-2">Capacity</span>
        </div>
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
          <div className="flex items-center gap-2 mb-6">
            <Settings className="w-3 h-3 text-neon-blue" />
            <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Sector Briefing</h3>
          </div>
          <p className="text-zinc-400 text-sm leading-relaxed font-medium mb-12 italic opacity-80">
            {venue.description || "No transmission data found for this node. Standard nightlife protocols apply."}
          </p>
        </TabsContent>

        <TabsContent value="amenities">
          <div className="grid grid-cols-2 gap-4">
            <div className="p-5 bg-zinc-900/20 border border-white/5 rounded-2xl">
              <p className="text-[8px] font-black text-zinc-600 uppercase mb-2">Category</p>
              <p className="text-xs font-bold uppercase text-white tracking-wider">{venue.category || "Nightclub"}</p>
            </div>
            <div className="p-5 bg-zinc-900/20 border border-white/5 rounded-2xl">
              <p className="text-[8px] font-black text-zinc-600 uppercase mb-2">Sector Status</p>
              <p className="text-xs font-bold uppercase text-neon-green tracking-wider">Live & Operational</p>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* NEURAL CLAIM DIALOG */}
      <Dialog open={claimDialogOpen} onOpenChange={setClaimDialogOpen}>
        <DialogContent className="bg-black border-white/5 text-white max-w-lg rounded-[3rem] p-0 overflow-hidden shadow-[0_0_60px_rgba(255,95,31,0.15)]">
          <div className="p-10 border-b border-white/5 bg-zinc-900/40">
            <DialogTitle className="text-5xl font-display uppercase italic tracking-tighter mb-2">
              Sector Claim
            </DialogTitle>
            <DialogDescription className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
              Submit legal credentials for sector authentication.
            </DialogDescription>
          </div>
          <form onSubmit={handleClaimSubmit} className="space-y-6 p-10">
            <div className="space-y-4">
              <div className="relative group">
                <UserCheck className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 group-focus-within:text-orange-500" />
                <input
                  name="legalName"
                  required
                  placeholder="LEGAL REPRESENTATIVE"
                  className="w-full bg-zinc-900/50 border border-white/5 rounded-2xl py-6 pl-16 text-[10px] uppercase font-black placeholder:text-zinc-700 focus:border-orange-500/50 transition-all outline-none"
                />
              </div>
              <div className="relative group">
                <Building className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 group-focus-within:text-orange-500" />
                <input
                  name="title"
                  required
                  placeholder="POSITION / TITLE"
                  className="w-full bg-zinc-900/50 border border-white/5 rounded-2xl py-6 pl-16 text-[10px] uppercase font-black placeholder:text-zinc-700 focus:border-orange-500/50 transition-all outline-none"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="relative group">
                  <Mail className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                  <input
                    name="email"
                    type="email"
                    required
                    placeholder="BUSINESS EMAIL"
                    className="w-full bg-zinc-900/50 border border-white/5 rounded-2xl py-6 pl-16 text-[10px] uppercase font-black placeholder:text-zinc-700 focus:border-orange-500/50 transition-all outline-none"
                  />
                </div>
                <div className="relative group">
                  <Phone className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                  <input
                    name="phone"
                    required
                    placeholder="CONTACT PHONE"
                    className="w-full bg-zinc-900/50 border border-white/5 rounded-2xl py-6 pl-16 text-[10px] uppercase font-black placeholder:text-zinc-700 focus:border-orange-500/50 transition-all outline-none"
                  />
                </div>
              </div>
            </div>
            <Button
              disabled={isSubmittingClaim}
              type="submit"
              className="w-full h-16 bg-orange-500 text-white font-black uppercase tracking-widest rounded-2xl shadow-xl hover:scale-[1.02] active:scale-95 transition-all border-none"
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
