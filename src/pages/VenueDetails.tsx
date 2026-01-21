import { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserMode } from "@/contexts/UserModeContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TicketPurchaseDialog } from "@/components/TicketPurchaseDialog";
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
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Venue } from "@/types/database";

const VenueDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { mode, session } = useUserMode();

  const [venue, setVenue] = useState<Venue | null>(null);
  const [loading, setLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<string | null>(null);
  const [purchaseOpen, setPurchaseOpen] = useState(false);

  const currentUserId = session?.user?.id || null;

  useEffect(() => {
    fetchVenue();
  }, [id, currentUserId]);

  const fetchVenue = async () => {
    if (!id) return;
    try {
      const { data } = await supabase.from("venues").select("*").eq("id", id).single();
      if (data) setVenue(data as Venue);

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

  if (loading) return null; // Neural Engine handles this
  if (!venue)
    return <div className="h-screen flex items-center justify-center bg-black text-white">Neural Path Terminated</div>;

  return (
    <div className="min-h-screen bg-black pb-24 animate-in fade-in duration-700">
      {/* ⚡ HEADER NAVIGATION */}
      <div className="fixed top-0 left-0 right-0 z-50 p-4 flex justify-between items-center pointer-events-none">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(-1)}
          className="bg-black/40 backdrop-blur-xl rounded-full border border-white/10 text-white pointer-events-auto"
        >
          <ArrowLeft className="w-6 h-6" />
        </Button>
      </div>

      {/* 🏛️ VENUE HERO */}
      <div className="relative h-[45vh] w-full">
        <img src={venue.image_url || "/placeholder.svg"} alt={venue.name} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
        <div className="absolute bottom-10 left-6 right-6 z-20">
          <Badge className="mb-3 bg-neon-pink/20 text-neon-pink border-neon-pink/40 uppercase text-[9px] font-black tracking-widest px-3 py-1">
            {venue.location}
          </Badge>
          <div className="flex justify-between items-end">
            <h1 className="font-display text-5xl text-white uppercase tracking-tighter leading-none italic">
              {venue.name}
            </h1>
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 px-3 py-1.5 rounded-xl flex items-center gap-2">
              <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
              <span className="text-white font-black text-xs">4.9</span>
            </div>
          </div>
        </div>
      </div>

      {/* 🚀 MARKETPLACE ACTION ZONE */}
      <div className="px-6 -mt-6 relative z-30 mb-8">
        {mode === "talent" ? (
          <Button
            size="lg"
            onClick={handleApply}
            disabled={!!connectionStatus}
            className={`w-full h-16 text-sm font-black uppercase tracking-[0.2em] rounded-2xl shadow-[0_0_30px_rgba(191,0,255,0.2)] transition-all ${
              connectionStatus === "active"
                ? "bg-neon-green/10 text-neon-green border border-neon-green/30"
                : connectionStatus
                  ? "bg-zinc-900 text-zinc-600 border border-white/5"
                  : "bg-neon-purple text-white hover:bg-neon-purple/90"
            }`}
          >
            {connectionStatus === "active" ? (
              <>
                <CheckCircle2 className="mr-2 w-5 h-5" /> Active Link
              </>
            ) : connectionStatus === "pending" ? (
              <>
                <Clock className="mr-2 w-5 h-5" /> Sync Pending
              </>
            ) : (
              <>
                <Briefcase className="mr-2 w-5 h-5" /> Submit Neural Application
              </>
            )}
          </Button>
        ) : mode === "manager" ? (
          <Button
            size="lg"
            onClick={() => navigate(`/dashboard`)}
            className="w-full h-16 text-sm font-black uppercase tracking-[0.2em] rounded-2xl bg-white text-black hover:bg-neon-green transition-all"
          >
            <ShieldCheck className="mr-2 w-5 h-5" /> Operation Control
          </Button>
        ) : (
          <>
            <Button
              size="lg"
              onClick={() => setPurchaseOpen(true)}
              className="w-full h-16 text-sm font-black uppercase tracking-[0.2em] rounded-2xl bg-neon-green text-black hover:shadow-[0_0_20px_#39FF14/30]"
            >
              <Ticket className="mr-2 w-5 h-5 fill-black" /> Secure Entry
            </Button>
            <TicketPurchaseDialog
              open={purchaseOpen}
              onOpenChange={setPurchaseOpen}
              venueId={venue.id}
              venueName={venue.name}
              price={venue.entry_price || 20}
            />
          </>
        )}
      </div>

      {/* 📊 COLLISION DATA TABS */}
      <Tabs defaultValue="vibe" className="w-full">
        <TabsList className="w-full bg-transparent border-b border-white/5 h-12 px-6 justify-start gap-8">
          <TabsTrigger
            value="vibe"
            className="uppercase font-black tracking-widest text-[10px] data-[state=active]:text-white"
          >
            Live Vibe
          </TabsTrigger>
          <TabsTrigger
            value="intel"
            className="uppercase font-black tracking-widest text-[10px] data-[state=active]:text-white"
          >
            {mode === "talent" ? "Venue Intel" : "Details"}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="vibe" className="p-6">
          <div className="p-12 text-center border border-dashed border-white/5 rounded-3xl bg-zinc-900/20">
            <Zap className="w-8 h-8 text-zinc-800 mx-auto mb-4 animate-pulse" />
            <p className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.3em]">
              Live Streaming Data Synchronizing...
            </p>
          </div>
        </TabsContent>

        <TabsContent value="intel" className="p-6 space-y-6">
          {mode === "talent" ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-zinc-900/50 border border-white/5 rounded-2xl">
                  <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-1">Commission Rate</p>
                  <p className="text-2xl font-display text-neon-green">15%</p>
                </div>
                <div className="p-4 bg-zinc-900/50 border border-white/5 rounded-2xl">
                  <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-1">Avg Occupancy</p>
                  <p className="text-2xl font-display text-white">82%</p>
                </div>
              </div>
              <div className="p-6 bg-neon-purple/5 border border-neon-purple/20 rounded-2xl">
                <h4 className="text-[10px] font-black text-neon-purple uppercase tracking-widest mb-2 flex items-center gap-2">
                  <TrendingUp className="w-3 h-3" /> Talent Opportunity
                </h4>
                <p className="text-sm text-zinc-400 font-body leading-relaxed">
                  This venue is currently prioritizing performers with a high Flow Rate. Payouts are instant via the
                  Neural Ledger.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <p className="text-zinc-400 leading-relaxed text-sm font-body">
                {venue.description || "No description provided."}
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                  <p className="text-[9px] text-zinc-500 uppercase font-black tracking-widest mb-1">Capacity</p>
                  <p className="text-white font-display text-xl italic">{venue.capacity || "500"}</p>
                </div>
                <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                  <p className="text-[9px] text-zinc-500 uppercase font-black tracking-widest mb-1">Entry</p>
                  <p className="text-white font-display text-xl italic">${venue.entry_price || "20"}</p>
                </div>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default VenueDetails;
