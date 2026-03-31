import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserMode } from "@/contexts/UserModeContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Loader2, ArrowLeft, MapPin, MessageSquare, Lock, Calendar } from "lucide-react";
import { FollowButton } from "@/components/profile/FollowButton";
import { useFollow } from "@/hooks/useFollow";
import { toast } from "sonner";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { InteractiveHeroReel } from "@/components/InteractiveHeroReel";
import { PortfolioGallery } from "@/components/PortfolioGallery";

const TalentProfile = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { mode, activeVenueId, session } = useUserMode();
  const { isFollowing, isLoading: followLoading } = useFollow(id || "");

  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [schedule, setSchedule] = useState<any[]>([]);
  const [activeVenueName, setActiveVenueName] = useState<string | null>(null);

  const currentUserId = session?.user?.id || null;
  const isSelfView = currentUserId === id;
  
  // ✅ LOGIC: Portfolio is visible only to followers or the owner
  const canSeePortfolio = isFollowing || isSelfView;

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    try {
      const { data: profileData } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle();
      if (profileData) {
        setProfile(profileData);
        if (profileData.is_active && profileData.current_venue_id) {
          const { data: v } = await supabase.from("venues").select("name").eq("id", profileData.current_venue_id).single();
          if (v) setActiveVenueName(v.name);
        }
      }

      // Fetch "Upcoming Gigs" for Public View
      const { data: staffData } = await supabase
        .from("venue_staff")
        .select("venue_id, venues(id, name, location)")
        .eq("user_id", id)
        .eq("status", "active");

      if (staffData) {
        setSchedule(staffData.map((s: any) => ({
          id: s.venue_id,
          venue_id: s.venues?.id,
          venue_name: s.venues?.name,
          venue_location: s.venues?.location,
        })));
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || followLoading) return null;

  return (
    <div className="min-h-screen bg-black pb-40 animate-in fade-in duration-700">
      {/* 1. HERO REEL (THE BANNER) */}
      <div className="relative w-full">
        <AspectRatio ratio={3 / 4} className="bg-zinc-900">
          <InteractiveHeroReel
            entityId={profile.id}
            entityType="talent"
            currentReelUrl={profile.hero_reel_url}
            fallbackImageUrl={profile.avatar_url || "/placeholder.svg"}
            isOwner={isSelfView}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
          
          <div className="absolute top-6 left-6 z-20">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="bg-black/40 backdrop-blur-md rounded-full text-white border border-white/10">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </div>

          <div className="absolute bottom-12 left-8 z-10">
            <div className="flex flex-col gap-4">
              <h1 className="text-6xl font-display text-white uppercase tracking-tighter italic leading-[0.8]">
                {profile.display_name || profile.username}
              </h1>
              {profile.is_active && activeVenueName && (
                <Badge className="w-fit bg-neon-green/10 text-neon-green border-neon-green/20 uppercase text-[8px] font-black tracking-[0.3em] px-4 py-1 rounded-full flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-neon-green animate-pulse" />
                  Live at {activeVenueName}
                </Badge>
              )}
            </div>
          </div>
        </AspectRatio>
      </div>

      {/* 2. ACTION DECK */}
      <div className="px-8 -mt-6 relative z-30 flex flex-col gap-6">
        {!isSelfView && (
          <div className="grid grid-cols-2 gap-3">
            <FollowButton targetId={profile.id} />
            <Button className="h-14 bg-white/5 border border-white/10 text-white uppercase font-black tracking-widest text-[10px] rounded-2xl">
              <MessageSquare className="w-4 h-4 mr-2" /> Message
            </Button>
          </div>
        )}
      </div>

      {/* 3. PORTFOLIO (THE GATED FIXTURE) */}
      <div className="mt-12">
        {canSeePortfolio ? (
          <PortfolioGallery userId={profile.id} isEditable={isSelfView} />
        ) : (
          <div className="px-8">
            <div className="h-[45vh] w-full rounded-[2.5rem] border border-dashed border-white/5 flex flex-col items-center justify-center bg-zinc-900/10 backdrop-blur-sm">
              <Lock className="w-6 h-6 text-zinc-700 mb-4" />
              <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Follow to unlock Portfolio</p>
            </div>
          </div>
        )}
      </div>

      {/* 4. UPCOMING GIGS (PUBLIC ONLY) */}
      {!isSelfView && schedule.length > 0 && (
        <div className="mt-16 px-8 space-y-6">
          <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.4em] flex items-center gap-2">
            <Calendar className="w-3 h-3" /> Live Dates
          </h3>
          <div className="space-y-3">
            {schedule.map((item) => (
              <Card key={item.id} className="bg-zinc-900/40 border-white/5 p-6 rounded-[2rem] flex justify-between items-center backdrop-blur-xl">
                <div>
                  <p className="text-white font-display text-xl uppercase tracking-tighter italic">{item.venue_name}</p>
                  <p className="text-[10px] text-zinc-600 uppercase font-bold flex items-center gap-1 mt-1">
                    <MapPin className="w-3 h-3 text-neon-pink" /> {item.venue_location}
                  </p>
                </div>
                <Button size="sm" onClick={() => navigate(`/venue/${item.venue_id}`)} className="bg-white text-black text-[10px] font-black uppercase rounded-full px-6">Visit</Button>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* 5. INTEL FEED (PLACEHOLDER FOR VERTICAL SCROLL) */}
      <div className="mt-16 px-8">
         <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.4em] mb-6">Latest Intel</h3>
         <div className="space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="aspect-square w-full bg-zinc-900/20 rounded-[2.5rem] border border-white/5 animate-pulse" />
            ))}
         </div>
      </div>
    </div>
  );
};

export default TalentProfile;
