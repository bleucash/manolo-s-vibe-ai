import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserMode } from "@/contexts/UserModeContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { ArrowLeft, MapPin, Sparkles, CheckCircle2, Clock } from "lucide-react";
import { FollowButton } from "@/components/FollowButton";
import { toast } from "sonner";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import LoadingState from "@/components/ui/LoadingState";

const TalentProfile = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { mode, activeVenueId, userVenues, session } = useUserMode();

  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [schedule, setSchedule] = useState<any[]>([]);
  const [inviting, setInviting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<string | null>(null);

  const currentUserId = session?.user?.id || null;
  const activeVenue = userVenues.find((v) => v.id === activeVenueId);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // 1. Fetch Profile
        const { data: profileData } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle();

        if (profileData) setProfile(profileData);

        // 2. Fetch Active Residencies
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

        // 3. Check Connection with Active Venue
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
        console.error("Data Fetch Error:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id, activeVenueId]);

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
      toast.success("Invitation dispatched");
      setConnectionStatus("pending_talent_action");
    } catch (err) {
      toast.error("Invitation failed");
    } finally {
      setInviting(false);
    }
  };

  if (loading) return <LoadingState />;
  if (!profile)
    return (
      <div className="h-screen bg-black text-white p-10 font-mono text-[10px] uppercase tracking-widest">
        Profile_Not_Synchronized
      </div>
    );

  const isSelfView = currentUserId === id;

  // SAFE STYLING: Logic moved outside of JSX to prevent string termination errors
  let inviteBtnClass = "w-full h-14 font-black uppercase tracking-widest rounded-2xl transition-all ";
  if (connectionStatus === "active") {
    inviteBtnClass += "bg-neon-green/20 text-neon-green border border-neon-green/30";
  } else if (connectionStatus) {
    inviteBtnClass += "bg-zinc-800 text-zinc-500";
  } else {
    inviteBtnClass += "bg-white text-black hover:bg-zinc-200 shadow-xl";
  }

  return (
    <div className="min-h-screen bg-background pb-32 animate-in fade-in duration-700">
      <div className="relative w-full overflow-hidden">
        <AspectRatio ratio={3 / 4} className="bg-zinc-900">
          <img src={profile.avatar_url || ""} className="w-full h-full object-cover" alt="Talent" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
          <div className="absolute top-6 left-6 z-20">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              className="bg-black/40 backdrop-blur-xl rounded-full text-white border border-white/10"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </div>
          <div className="absolute bottom-12 left-8 right-8 z-10">
            <Badge className="mb-4 bg-neon-pink text-white border-none uppercase tracking-[0.3em] text-[9px] font-bold px-3 py-1">
              Neural Network Spotlight
            </Badge>
            <h1 className="text-6xl font-display text-white uppercase tracking-tighter leading-[0.85]">
              {profile.display_name || profile.username}
            </h1>
          </div>
        </AspectRatio>
      </div>

      <div className="px-6 -mt-6 relative z-30 flex flex-col gap-3">
        {!isSelfView ? (
          <FollowButton targetId={profile.id} targetName={profile.display_name || "Talent"} />
        ) : (
          <Button
            className="bg-white/10 border border-white/20 text-white font-bold uppercase text-[10px] tracking-widest h-12"
            onClick={() => navigate("/profile")}
          >
            Manage Presence
          </Button>
        )}

        {mode === "manager" && activeVenue && !isSelfView && (
          <Button onClick={handleInvite} disabled={inviting || !!connectionStatus} className={inviteBtnClass}>
            {connectionStatus === "active" ? (
              <>
                <CheckCircle2 className="mr-2 w-5 h-5" /> Connected
              </>
            ) : connectionStatus === "pending_talent_action" ? (
              <>
                <Clock className="mr-2 w-5 h-5" /> Invitation Sent
              </>
            ) : connectionStatus === "pending" ? (
              <>
                <Clock className="mr-2 w-5 h-5" /> Applied to You
              </>
            ) : inviting ? (
              "Syncing..."
            ) : (
              `Invite to ${activeVenue.name}`
            )}
          </Button>
        )}
      </div>

      <div className="mt-8">
        <Tabs defaultValue="vibe" className="w-full">
          <TabsList className="w-full bg-transparent border-b border-white/5 h-12 px-6 justify-start gap-10">
            <TabsTrigger
              value="vibe"
              className="uppercase font-bold tracking-[0.2em] text-[10px] data-[state=active]:text-neon-pink rounded-none pb-3"
            >
              The Vibe
            </TabsTrigger>
            <TabsTrigger
              value="schedule"
              className="uppercase font-bold tracking-[0.2em] text-[10px] data-[state=active]:text-neon-pink rounded-none pb-3"
            >
              Live Dates
            </TabsTrigger>
          </TabsList>

          <TabsContent value="vibe" className="p-6">
            <div className="grid grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="aspect-[4/5] bg-zinc-900 rounded-2xl border border-white/5 flex items-center justify-center opacity-20"
                >
                  <Sparkles className="w-8 h-8" />
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="schedule" className="p-6 space-y-4">
            {schedule.length > 0 ? (
              schedule.map((item) => (
                <Card
                  key={item.id}
                  className="bg-zinc-900/50 border-white/5 p-5 flex justify-between items-center shadow-lg"
                >
                  <div>
                    <p className="text-white font-display text-lg uppercase leading-none">{item.venue_name}</p>
                    <p className="text-[10px] text-zinc-500 uppercase flex items-center gap-1 mt-1">
                      <MapPin className="w-3 h-3 text-neon-pink" /> {item.venue_location}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => navigate(`/venue/${item.venue_id}`)}
                    className="bg-white text-black text-[10px] font-bold uppercase rounded-full px-5 hover:bg-zinc-200"
                  >
                    Get Tickets
                  </Button>
                </Card>
              ))
            ) : (
              <div className="text-center py-10 text-zinc-600 italic text-[10px] uppercase tracking-widest">
                No Active Residencies
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default TalentProfile;
