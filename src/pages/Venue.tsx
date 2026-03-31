import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserMode } from "@/contexts/UserModeContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Ticket, MapPin, ArrowLeft, Users, ShieldCheck, MessageSquare, Instagram, Zap, Loader2 } from "lucide-react";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { InteractiveHeroReel } from "@/components/InteractiveHeroReel";
import { PortfolioGallery } from "@/components/PortfolioGallery";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ClaimSectorModal } from "@/components/ClaimSectorModal";
import { useVenueStatus } from "@/hooks/useVenueStatus";

const Venue = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { session } = useUserMode();
  const { isOwner, isTempManager, hasPendingClaim, loading: statusLoading } = useVenueStatus(id || "");

  const [venue, setVenue] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeStaff, setActiveStaff] = useState<any[]>([]);
  const [isClaimModalOpen, setIsClaimModalOpen] = useState(false);

  useEffect(() => {
    fetchVenueData();
  }, [id]);

  const fetchVenueData = async () => {
    if (!id) return;
    try {
      const { data } = await supabase.from("venues").select("*").eq("id", id).single();
      if (data) setVenue(data);

      const { data: staff } = await supabase
        .from("venue_staff")
        .select("user_id, profiles(display_name, username, avatar_url)")
        .eq("venue_id", id)
        .eq("status", "active");
      
      if (staff) setActiveStaff(staff);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || statusLoading) return null;
  if (!venue) return null; // Guard against null venue

  return (
    <div className="min-h-screen bg-black pb-40 animate-in fade-in duration-700">
      {/* 1. HERO REEL (Editable by Temp Manager) */}
      <div className="relative w-full">
        <AspectRatio ratio={16 / 9} className="bg-zinc-900">
          <InteractiveHeroReel
            entityId={venue.id}
            entityType="venue"
            currentReelUrl={venue.hero_reel_url}
            fallbackImageUrl={venue.image_url || "/placeholder.svg"}
            isOwner={isTempManager}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
          <div className="absolute top-6 left-6 z-20">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="bg-black/40 backdrop-blur-md rounded-full text-white border border-white/10">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </div>
        </AspectRatio>
      </div>

      {/* 2. ACTION ZONE & CLAIM LOGIC */}
      <div className="px-8 -mt-8 relative z-30 space-y-4">
        {isOwner ? (
          <Button onClick={() => navigate('/dashboard')} className="w-full h-20 bg-white text-black font-black uppercase tracking-[0.2em] rounded-[2rem] shadow-2xl">
            <ShieldCheck className="mr-3 w-5 h-5" /> Operation Control
          </Button>
        ) : hasPendingClaim ? (
          <div className="w-full h-20 bg-zinc-900/80 border border-neon-blue/30 backdrop-blur-md rounded-[2rem] flex items-center justify-center gap-3">
            <Loader2 className="w-4 h-4 text-neon-blue animate-spin" />
            <span className="text-[10px] font-black text-white uppercase tracking-widest italic">Neural Link Pending Verification</span>
          </div>
        ) : !venue.owner_id ? (
          <Button onClick={() => setIsClaimModalOpen(true)} className="w-full h-20 bg-neon-blue text-black font-black uppercase tracking-[0.2em] rounded-[2rem] shadow-[0_0_30px_rgba(0,183,255,0.2)]">
            <Instagram className="mr-3 w-5 h-5" /> Claim Sector via IG
          </Button>
        ) : (
          <div className="grid grid-cols-5 gap-3">
            <Button className="col-span-4 h-20 bg-neon-green text-black font-black uppercase tracking-[0.2em] rounded-[2rem]">
              <Ticket className="mr-3 w-5 h-5" /> Secure Entry
            </Button>
            <Button variant="outline" className="col-span-1 h-20 rounded-[2rem] border-white/10 bg-white/5 text-white">
              <MessageSquare className="w-5 h-5" />
            </Button>
          </div>
        )}
      </div>

      {/* 3. ACTIVE ROSTER */}
      {activeStaff.length > 0 && (
        <div className="mt-12 px-8">
          <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.4em] mb-4">Active Talent</h3>
          <div className="flex -space-x-3">
            {activeStaff.map((staff, i) => (
              <Avatar key={i} className="border-4 border-black w-14 h-14 cursor-pointer" onClick={() => navigate(`/talent/${staff.user_id}`)}>
                <AvatarImage src={staff.profiles?.avatar_url} />
                <AvatarFallback>{staff.profiles?.username?.[0]}</AvatarFallback>
              </Avatar>
            ))}
          </div>
        </div>
      )}

      {/* 4. PORTFOLIO (Editable by Temp Manager) */}
      <div className="mt-12">
        <PortfolioGallery userId={venue.id} isEditable={isTempManager} />
      </div>

      <ClaimSectorModal 
        isOpen={isClaimModalOpen} 
        onClose={() => setIsClaimModalOpen(false)} 
        venueId={venue.id} 
        venueName={venue.name} 
      />
    </div>
  );
};

export default Venue;
