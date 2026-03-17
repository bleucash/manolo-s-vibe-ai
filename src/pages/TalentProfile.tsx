import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserMode } from "@/contexts/UserModeContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Loader2, ArrowLeft, MapPin, Sparkles, CheckCircle2, MessageSquare, Lock, Zap } from "lucide-react";
import { FollowButton } from "@/components/profile/FollowButton";
import { useFollow } from "@/hooks/useFollow";
import { toast } from "sonner";
import { AspectRatio } from "@/components/ui/aspect-ratio";

const TalentProfile = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { mode, activeVenueId, userVenues, session } = useUserMode();

  // Custom hook provides the current following status
  const { isFollowing, isLoading: followLoading } = useFollow(id || "");

  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [schedule, setSchedule] = useState<any[]>([]);
  const [inviting, setInviting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<string | null>(null);
  const [initiatingChat, setInitiatingChat] = useState(false);
  const [activeVenueName, setActiveVenueName] = useState<string | null>(null);

  const currentUserId = session?.user?.id || null;
  const activeVenue = userVenues.find((v) => v.id === activeVenueId);

  /**
   * ✅ ROLE-BASED PERMISSION LOGIC
   * 1. Managers/Venues: Always true (Business priority)
   * 2. Self-view: Always true
   * 3. Guests/Talent: True only if following (Anti-spam gate)
   */
  const canMessage = mode === "manager" || isFollowing || currentUserId === id;

  useEffect(() => {
    fetchData();
  }, [id, activeVenueId]);

  const fetchData = async () => {
    try {
      const { data: profileData } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle();
      if (profileData) {
        setProfile(profileData);

        // If talent is active, fetch the venue name
        if (profileData.is_active && profileData.current_venue_id) {
          const { data: venueData } = await supabase
            .from("venues")
            .select("name")
            .eq("id", profileData.current_venue_id)
            .single();
          if (venueData) setActiveVenueName(venueData.name);
        } else {
          setActiveVenueName(null);
        }
      }

      const { data: staffData } = await supabase
        .from("venue_staff")
        .select("venue_id, venues(id, name, location)")
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

      if (activeVenueId && id) {
        const { data: existing } = await supabase
          .from("venue_staff")
          .select("status")
          .eq("venue_id", activeVenueId)
          .eq("user_id", id)
          .maybeSingle();

        if (existing) setConnectionStatus(existing.status);
      }
    } catch (error) {
      // Silence logs for Phase 3 cleanup
    } finally {
      setLoading(false);
    }
  };

  const handleMessage = async () => {
    if (!currentUserId || !id || !canMessage) return;
    setInitiatingChat(true);

    try {
      // Logic: If conversation exists, it will show up in the Inbox (Messages.tsx)
      // We navigate to the Inbox and let the user select or initiate
      toast.info("Connecting to secure channel...");
      navigate(`/messages`);
    } catch (err) {
      toast.error("Handshake failed. Try again.");
    } finally {
      setInitiatingChat(false);
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
    } catch (err: any) {
      toast.error("Synchronization error.");
    } finally {
      setInviting(false);
    }
  };

  // ✅ RESPECT UNIVERSAL LOADER (Return null while syncing)
  if (loading || followLoading) return null;

  if (!profile)
    return (
      <div className="h-screen flex items-center justify-center bg-black text-white font-display uppercase tracking-[0.5em] text-[10px]">
        Entity Not Found
      </div>
    );

  const isSelfView = currentUserId === id;

  return (
    <div className="min-h-screen bg-black pb-32 animate-in fade-in duration-700">
      {/* HERO SECTION */}
      <div className="relative w-full overflow-hidden">
        <AspectRatio ratio={3 / 4} className="bg-zinc-900">
          <img
            src={profile.avatar_url || ""}
            className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-700"
            alt="Vibe"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/10 to-transparent" />
          <div className="absolute top-6 left-6 z-20">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              className="bg-black/40 backdrop-blur-md rounded-full text-white border border-white/10"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </div>
          <div className="absolute bottom-12 left-8 right-8 z-10">
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              <Badge className="bg-neon-pink text-white border-none uppercase tracking-[0.4em] text-[8px] font-black px-4 py-1 rounded-full">
                {profile.sub_role || "Talent Entity"}
              </Badge>
              {profile.is_active && activeVenueName && (
                <Badge className="bg-neon-green/15 backdrop-blur-md text-neon-green border-neon-green/30 uppercase text-[8px] font-black tracking-[0.3em] px-4 py-1 rounded-full flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-neon-green animate-pulse" />
                  Active at {activeVenueName}
                </Badge>
              )}
            </div>
            <h1 className="text-6xl font-display text-white uppercase tracking-tighter leading-[0.8] italic">
              {profile.display_name || profile.username}
            </h1>
          </div>
        </AspectRatio>
      </div>

      {/* INTERACTION DECK */}
      <div className="px-6 -mt-6 relative z-30 flex flex-col gap-4">
        {!isSelfView && (
          <div className="grid grid-cols-2 gap-3">
            <FollowButton userId={profile.id} />
            <Button
              disabled={!canMessage || initiatingChat}
              onClick={handleMessage}
              className={`h-14 uppercase font-black tracking-widest text-[10px] rounded-2xl border transition-all active:scale-95 ${
                canMessage
                  ? "bg-neon-purple/10 border-neon-purple/30 text-neon-purple shadow-[0_0_20px_rgba(191,0,255,0.1)]"
                  : "bg-zinc-900/50 border-white/5 text-zinc-600 cursor-not-allowed"
              }`}
            >
              {initiatingChat ? (
                <Loader2 className="animate-spin w-4 h-4" />
              ) : (
                <div className="flex items-center">
                  {canMessage ? (
                    <MessageSquare className="w-4 h-4 mr-2" />
                  ) : (
                    <Lock className="w-4 h-4 mr-2 opacity-50" />
                  )}
                  {canMessage ? "Open Link" : "Follow to Message"}
                </div>
              )}
            </Button>
          </div>
        )}

        {isSelfView && (
          <Button
            className="bg-white/5 border border-white/10 text-white font-black uppercase text-[10px] tracking-[0.2em] h-14 rounded-2xl"
            onClick={() => navigate("/profile")}
          >
            Edit Personal Vibe
          </Button>
        )}

        {/* MANAGER CONTEXTUAL ACTION */}
        {mode === "manager" && activeVenue && !isSelfView && (
          <Button
            onClick={handleInvite}
            disabled={inviting || !!connectionStatus}
            className={`w-full h-16 font-black uppercase tracking-[0.2em] rounded-2xl transition-all shadow-xl ${
              connectionStatus === "active"
                ? "bg-neon-green/10 text-neon-green border border-neon-green/20"
                : "bg-white text-black hover:bg-neon-green active:bg-neon-green"
            }`}
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
      </div>

      {/* CONTENT TABS */}
      <div className="mt-12">
        <Tabs defaultValue="vibe" className="w-full">
          <TabsList className="w-full bg-transparent border-b border-white/5 h-12 px-6 justify-start gap-10">
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

          <TabsContent value="vibe" className="p-6">
            <div className="grid grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="aspect-[3/4] bg-zinc-900 rounded-3xl border border-white/5 flex items-center justify-center grayscale opacity-30"
                >
                  <Zap className="w-6 h-6 text-zinc-700" />
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="residencies" className="p-6 space-y-4">
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
    </div>
  );
};

export default TalentProfile;
