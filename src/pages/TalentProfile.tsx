import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserMode } from "@/contexts/UserModeContext";
import { FollowButton } from "@/components/FollowButton";
import { TicketPurchaseDialog } from "@/components/TicketPurchaseDialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import {
  MapPin,
  Zap,
  ArrowLeft,
  Share2,
  ShieldCheck,
  Radio,
  MessageSquare,
  Lock,
  Loader2,
  CheckCircle2,
  Flame,
  Globe,
  Heart,
} from "lucide-react";
import LoadingState from "@/components/ui/LoadingState";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const TalentProfile = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { mode, activeVenueId, userVenues, session } = useUserMode();

  const [profile, setProfile] = useState<any>(null);
  const [venue, setVenue] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [schedule, setSchedule] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviting, setInviting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<string | null>(null);
  const [isTicketOpen, setIsTicketOpen] = useState(false);
  const [initiatingChat, setInitiatingChat] = useState(false);

  const currentUserId = session?.user?.id || null;
  const activeVenue = userVenues.find((v) => v.id === activeVenueId);
  const isSelfView = currentUserId === id;

  /**
   * ✅ ANTI-SPAM HANDSHAKE LOGIC
   * 1. Managers: Always allowed (Business priority)
   * 2. Followers: Allowed (Permission granted via follow)
   */
  const canMessage = mode === "manager" || isSelfView; // Extended logic below in render

  useEffect(() => {
    fetchDiscoveryData();
  }, [id, activeVenueId]);

  const fetchDiscoveryData = async () => {
    if (!id) return;
    setLoading(true);

    try {
      // 1. Fetch Profile & Active Venue Uplink
      const { data: profileData } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle();
      if (profileData) {
        setProfile(profileData);
        if (profileData.venue_id) {
          const { data: vData } = await supabase
            .from("venues")
            .select("*")
            .eq("id", profileData.venue_id)
            .maybeSingle();
          setVenue(vData);
        }
      }

      // 2. Fetch Residencies (venue_staff)
      const { data: staffData } = await supabase
        .from("venue_staff")
        .select("status, venue_id, venues(id, name, location)")
        .eq("user_id", id)
        .eq("status", "active");

      if (staffData) {
        setSchedule(
          staffData.map((s: any) => ({
            id: s.venue_id,
            venue_id: s.venues?.id,
            venue_name: s.venues?.name,
            venue_location: s.venues?.location,
          })),
        );
      }

      // 3. Fetch Posts for the Grid
      const { data: postsData } = await supabase
        .from("posts")
        .select("*")
        .eq("user_id", id)
        .order("created_at", { ascending: false });
      setPosts(postsData || []);

      // 4. Manager Context: Check connection to Active Venue
      if (activeVenueId) {
        const { data: existing } = await supabase
          .from("venue_staff")
          .select("status")
          .eq("venue_id", activeVenueId)
          .eq("user_id", id)
          .maybeSingle();
        if (existing) setConnectionStatus(existing.status);
      }
    } catch (err) {
      console.error("Neural Sync Error", err);
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async () => {
    if (!activeVenueId || !id) return;
    setInviting(true);
    try {
      const { error } = await supabase.from("venue_staff").insert({
        venue_id: activeVenueId,
        user_id: id,
        status: "pending_talent_action",
      });
      if (error) throw error;
      toast.success("Gig invitation dispatched!");
      setConnectionStatus("pending_talent_action");
    } catch (err) {
      toast.error("Synchronization error.");
    } finally {
      setInviting(false);
    }
  };

  if (loading) return <LoadingState />;
  if (!profile)
    return <div className="h-screen bg-black flex items-center justify-center text-white italic">Entity Not Found</div>;

  const latestPost = posts[0];

  return (
    <div className="min-h-screen bg-black text-white font-body relative overflow-x-hidden">
      {/* 🎬 HERO REEL: 2026 Immersive Continuity */}
      <div className="relative h-[65dvh] w-full overflow-hidden">
        <img
          src={latestPost?.media_url || profile.avatar_url || "/placeholder.svg"}
          className="w-full h-full object-cover opacity-60 animate-in zoom-in-105 duration-[10000ms]"
          alt="Transmission"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black via-transparent to-black" />

        {/* Navigation HUD */}
        <div className="absolute top-12 left-8 right-8 flex justify-between items-center z-50">
          <button
            onClick={() => navigate(-1)}
            className="w-12 h-12 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center active:scale-90 transition-all"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div className="flex gap-4">
            <button className="w-12 h-12 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center active:scale-90 transition-all">
              <Share2 className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Live Status Overlay */}
        {venue && (
          <div className="absolute top-32 left-8 animate-in slide-in-from-left-8 duration-700">
            <div className="flex items-center gap-3 bg-neon-green/10 border border-neon-green/30 px-4 py-2 rounded-full backdrop-blur-xl">
              <div className="w-2 h-2 bg-neon-green rounded-full animate-pulse shadow-[0_0_10px_#39FF14]" />
              <span className="text-[9px] font-black uppercase tracking-[0.2em] text-neon-green">
                Live Uplink Active
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 🧬 INTERACTION DECK */}
      <div className="relative -mt-24 px-8 pb-12 z-40">
        <div className="flex flex-col items-center text-center">
          <div className="relative mb-6">
            <div className="w-32 h-32 rounded-[2.5rem] border-4 border-black shadow-2xl overflow-hidden bg-zinc-900">
              <img src={profile.avatar_url || "/placeholder.svg"} className="w-full h-full object-cover" alt="" />
            </div>
            {venue && (
              <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-neon-blue rounded-2xl flex items-center justify-center border-4 border-black shadow-xl">
                <Zap className="w-5 h-5 text-black fill-black" />
              </div>
            )}
          </div>

          <h1 className="font-display text-5xl uppercase italic tracking-tighter mb-2 text-glow-white">
            {profile.display_name || profile.username}
          </h1>
          <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.3em] mb-8">
            {profile.sub_role || "Talent Entity"} • Neural ID: {profile.id.slice(0, 8)}
          </p>

          <div className="grid grid-cols-2 gap-4 w-full max-w-sm mb-8">
            {!isSelfView && (
              <>
                <FollowButton
                  targetId={profile.id}
                  targetName={profile.display_name}
                  targetType="talent"
                  className="h-14 rounded-2xl"
                />
                <Button
                  disabled={!canMessage || initiatingChat}
                  onClick={() => navigate("/messages")}
                  className={cn(
                    "h-14 uppercase font-black tracking-widest text-[10px] rounded-2xl border transition-all active:scale-95",
                    canMessage
                      ? "bg-neon-purple/10 border-neon-purple/30 text-neon-purple shadow-[0_0_20px_rgba(191,0,255,0.1)]"
                      : "bg-zinc-900/50 border-white/5 text-zinc-600 cursor-not-allowed",
                  )}
                >
                  {canMessage ? (
                    <MessageSquare className="w-4 h-4 mr-2" />
                  ) : (
                    <Lock className="w-4 h-4 mr-2 opacity-50" />
                  )}
                  {canMessage ? "Open Link" : "Follow to Message"}
                </Button>
              </>
            )}
            {isSelfView && (
              <Button
                className="col-span-2 bg-white/5 border border-white/10 text-white font-black uppercase text-[10px] tracking-[0.2em] h-14 rounded-2xl"
                onClick={() => navigate("/profile")}
              >
                Edit Personal Vibe
              </Button>
            )}
          </div>

          {/* MANAGER CONTEXTUAL ACTION */}
          {mode === "manager" && activeVenue && !isSelfView && (
            <Button
              onClick={handleInvite}
              disabled={inviting || !!connectionStatus}
              className={cn(
                "w-full max-w-sm h-16 font-black uppercase tracking-[0.2em] rounded-2xl mb-8",
                connectionStatus === "active"
                  ? "bg-neon-green/10 text-neon-green border border-neon-green/20"
                  : "bg-white text-black hover:bg-neon-green",
              )}
            >
              {connectionStatus === "active" ? (
                <>
                  <CheckCircle2 className="mr-2" /> Neural Connection Active
                </>
              ) : connectionStatus === "pending_talent_action" ? (
                <>
                  <Zap className="mr-2 w-4 h-4 animate-pulse" /> Signal Dispatched
                </>
              ) : (
                `Sync with ${activeVenue.name}`
              )}
            </Button>
          )}

          {/* ⚡ THE HANDSHAKE: Ticket Storefront */}
          {venue ? (
            <div className="w-full max-w-sm bg-zinc-950 border border-neon-blue/20 rounded-[2.5rem] p-8 shadow-[0_0_40px_rgba(0,183,255,0.05)] mb-12">
              <div className="flex items-center justify-between mb-8 text-left">
                <div>
                  <span className="text-[8px] font-black text-zinc-600 uppercase tracking-[0.3em] block mb-1">
                    Current Sector
                  </span>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3 h-3 text-neon-blue" />
                    <span className="text-sm font-bold uppercase tracking-tight">{venue.name}</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[8px] font-black text-zinc-600 uppercase tracking-[0.3em] block mb-1">
                    Entry
                  </span>
                  <span className="text-lg font-display text-neon-green">${venue.entry_price || "20.00"}</span>
                </div>
              </div>

              <button
                onClick={() => setIsTicketOpen(true)}
                className="w-full h-16 bg-white text-black rounded-2xl font-black uppercase text-[11px] tracking-[0.2em] flex items-center justify-center gap-3 hover:bg-neon-blue hover:text-white transition-all shadow-[0_10px_30px_rgba(255,255,255,0.1)]"
              >
                Secure Entry <Zap className="w-4 h-4 fill-current" />
              </button>
            </div>
          ) : (
            <div className="w-full max-w-sm bg-zinc-900/30 border border-white/5 rounded-[2.5rem] p-10 text-center italic mb-12">
              <Radio className="w-5 h-5 text-zinc-700 mx-auto mb-4" />
              <p className="text-zinc-600 text-[10px] font-black uppercase tracking-widest">Awaiting Sector Uplink</p>
            </div>
          )}
        </div>

        {/* 📊 ENERGY METRICS */}
        <div className="grid grid-cols-3 gap-4 mb-12 max-w-sm mx-auto">
          <div className="bg-zinc-900/40 rounded-3xl p-6 border border-white/5 flex flex-col items-center">
            <Flame className="w-5 h-5 text-orange-500 mb-2" />
            <span className="text-xl font-display italic">98%</span>
            <span className="text-[7px] font-black uppercase text-zinc-600 tracking-widest mt-1">Heat Index</span>
          </div>
          <div className="bg-zinc-900/40 rounded-3xl p-6 border border-white/5 flex flex-col items-center">
            <Zap className="w-5 h-5 text-neon-blue mb-2" />
            <span className="text-xl font-display italic">4.2k</span>
            <span className="text-[7px] font-black uppercase text-zinc-600 tracking-widest mt-1">Total Charges</span>
          </div>
          <div className="bg-zinc-900/40 rounded-3xl p-6 border border-white/5 flex flex-col items-center">
            <ShieldCheck className="w-5 h-5 text-neon-green mb-2" />
            <span className="text-xl font-display italic">LVL 4</span>
            <span className="text-[7px] font-black uppercase text-zinc-600 tracking-widest mt-1">Tier</span>
          </div>
        </div>

        {/* CONTENT TABS */}
        <Tabs defaultValue="vibe" className="w-full">
          <TabsList className="w-full bg-transparent border-b border-white/5 h-12 justify-start gap-10 mb-8">
            <TabsTrigger
              value="vibe"
              className="uppercase font-black tracking-[0.2em] text-[10px] data-[state=active]:text-neon-pink"
            >
              The Vibe
            </TabsTrigger>
            <TabsTrigger
              value="residencies"
              className="uppercase font-black tracking-[0.2em] text-[10px] data-[state=active]:text-neon-pink"
            >
              Residencies
            </TabsTrigger>
          </TabsList>

          <TabsContent value="vibe">
            {posts.length > 0 ? (
              <div className="grid grid-cols-2 gap-4 animate-in fade-in duration-700">
                {posts.map((post) => (
                  <div
                    key={post.id}
                    className="group relative aspect-[3/4] rounded-3xl overflow-hidden bg-zinc-900 border border-white/5"
                  >
                    <img
                      src={post.media_url}
                      className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700"
                      alt=""
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-60" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-20 text-center border border-white/5 rounded-[40px] bg-zinc-900/20">
                <p className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.4em]">
                  Zero Active Transmissions
                </p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="residencies" className="space-y-4">
            {schedule.length === 0 ? (
              <div className="py-20 text-center border border-dashed border-white/10 rounded-[40px]">
                <p className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.4em]">
                  Zero Active Residencies
                </p>
              </div>
            ) : (
              schedule.map((item) => (
                <Card
                  key={item.id}
                  className="bg-zinc-900/40 border-white/5 p-6 rounded-[32px] flex justify-between items-center backdrop-blur-xl"
                >
                  <div>
                    <p className="text-white font-display text-xl uppercase tracking-tighter italic">
                      {item.venue_name}
                    </p>
                    <p className="text-[10px] text-zinc-600 uppercase flex items-center gap-1 mt-1 font-bold">
                      <MapPin className="w-3 h-3 text-neon-pink" /> {item.venue_location}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => navigate(`/venue/${item.venue_id}`)}
                    className="bg-white text-black text-[10px] font-black uppercase rounded-full px-6"
                  >
                    Visit
                  </Button>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* 🎟 Stripe Integration: Direct B2B Referral */}
      {venue && (
        <TicketPurchaseDialog
          open={isTicketOpen}
          onOpenChange={setIsTicketOpen}
          venueId={venue.id}
          venueName={venue.name}
          price={venue.entry_price || 20}
          referralId={profile.id}
        />
      )}
    </div>
  );
};

export default TalentProfile;
