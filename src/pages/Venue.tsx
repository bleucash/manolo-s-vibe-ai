import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserMode } from "@/contexts/UserModeContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Ticket, MapPin, Users, ShieldCheck, MessageSquare, Instagram, Zap, Loader2, ArrowLeft, Briefcase } from "lucide-react";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { InteractiveHeroReel } from "@/components/InteractiveHeroReel";
import { PortfolioGallery } from "@/components/PortfolioGallery";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ClaimSectorModal } from "@/components/ClaimSectorModal";
import { RequestToWorkModal } from "@/components/RequestToWorkModal";
import { toast } from "sonner";
import { positionLabel } from "@/config/positions";
import { useVenueStatus } from "@/hooks/useVenueStatus";

const Venue = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { session, isManager, isTalent } = useUserMode();
  const { isOwner, isTempManager, hasPendingClaim, loading: statusLoading } = useVenueStatus(id || "");

  const [venue, setVenue] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeStaff, setActiveStaff] = useState<any[]>([]);
  const [isClaimModalOpen, setIsClaimModalOpen] = useState(false);
  const [isWorkModalOpen, setIsWorkModalOpen] = useState(false);
  // This viewer's own venue_staff row for this venue, if any. Drives whether
  // the button offers a request, or reports one already in flight.
  const [staffLink, setStaffLink] = useState<any>(null);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    fetchVenueData();
  }, [id, session?.user?.id]);

  // Withdrawing a pending request is the same DELETE as leaving an active
  // venue: unique_venue_user_connection means one row per pair, and rejection
  // already deletes rather than writing a terminal status.
  const handleWithdraw = async () => {
    if (!staffLink) return;
    setIsExiting(true);
    try {
      // .select() so an RLS-filtered delete is visible. Without it this
      // returns 200 with zero rows and reads as success, the same shape that
      // hid the manager-approve bug.
      const { data, error } = await supabase
        .from("venue_staff")
        .delete()
        .eq("id", staffLink.id)
        .select("id");

      if (error) throw error;
      if (!data || data.length === 0) {
        toast.error("Not Permitted", { description: "Nothing was withdrawn." });
        return;
      }

      toast.success("Request Withdrawn");
      setStaffLink(null);
      fetchVenueData();
    } catch (err) {
      console.error(err);
      toast.error("System Error", { description: "Could not withdraw. Try again." });
    } finally {
      setIsExiting(false);
    }
  };

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

      // Self-scoped by the "Talent view own status" policy, so this only ever
      // returns the viewer's own row.
      if (session?.user?.id) {
        const { data: link } = await supabase
          .from("venue_staff")
          .select("id, status, staff_role")
          .eq("venue_id", id)
          .eq("user_id", session.user.id)
          .maybeSingle();
        setStaffLink(link ?? null);
      }
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

          {/* navigate(-1), not a hardcoded route: Venue is reachable from
              Discovery, the Index feed's venue tag, and VenueManage's
              "View Public Profile" button. */}
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
            {/* An existing manager is adding to what they already run, not
                becoming a manager for the first time. */}
            <Instagram className="mr-3 w-5 h-5" /> {isManager ? "Add This Venue" : "Claim Sector via IG"}
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

        {/* Talent working here is orthogonal to the claim chain above: it
            applies to venues that ARE owned, where the claim button never
            renders. So it sits outside that if/else rather than inside it.
            Styled to match the claim button per J, in green because this is
            a work link, not an ownership claim. */}
        {isTalent && !isOwner && (
          staffLink?.status === "pending" ? (
            <div className="w-full rounded-[2rem] bg-zinc-900/80 border border-neon-green/30 backdrop-blur-md overflow-hidden">
              <div className="h-20 flex items-center justify-center gap-3">
                <Loader2 className="w-4 h-4 text-neon-green animate-spin" />
                <span className="text-[10px] font-black text-white uppercase tracking-widest italic">
                  Work Request Pending
                </span>
              </div>
              <button
                onClick={handleWithdraw}
                disabled={isExiting}
                className="w-full py-4 border-t border-white/5 text-[9px] font-black uppercase tracking-widest text-zinc-500 hover:text-red-500 transition-colors disabled:opacity-40"
              >
                {isExiting ? "Withdrawing..." : "Withdraw Request"}
              </button>
            </div>
          ) : staffLink?.status === "active" ? (
            <div className="w-full h-20 bg-zinc-900/80 border border-neon-green/30 backdrop-blur-md rounded-[2rem] flex items-center justify-center gap-3">
              <ShieldCheck className="w-4 h-4 text-neon-green" />
              <span className="text-[10px] font-black text-white uppercase tracking-widest italic">
                {positionLabel(staffLink.staff_role) || "Confirmed"} Here
              </span>
            </div>
          ) : (
            <Button
              onClick={() => setIsWorkModalOpen(true)}
              className="w-full h-20 bg-neon-green text-black font-black uppercase tracking-[0.2em] rounded-[2rem] shadow-[0_0_30px_rgba(57,255,20,0.2)]"
            >
              <Briefcase className="mr-3 w-5 h-5" /> Request to Work Here
            </Button>
          )
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

      <RequestToWorkModal
        isOpen={isWorkModalOpen}
        onClose={() => setIsWorkModalOpen(false)}
        venueId={venue.id}
        venueName={venue.name}
        onSubmitted={fetchVenueData}
      />
    </div>
  );
};

export default Venue;
