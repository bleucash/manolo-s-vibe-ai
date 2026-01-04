import { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserMode } from "@/contexts/UserModeContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Ticket } from "lucide-react";
import { TicketPurchaseDialog } from "@/components/TicketPurchaseDialog";
import { Briefcase, ArrowLeft, Loader2, CheckCircle2, Clock, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Venue } from "@/types/database";
import { z } from "zod";

// Validation schema for venue staff applications
const venueStaffApplicationSchema = z.object({
  venue_id: z.string().uuid("Invalid venue ID"),
  user_id: z.string().uuid("Invalid user ID"),
  status: z.enum(["pending", "pending_talent_action"]),
});

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
  // Capture referral ID from URL or local storage for commission tracking
  const referralId = searchParams.get("ref") || localStorage.getItem("referral_promoter_id");

  useEffect(() => {
    if (searchParams.get("ref")) {
      localStorage.setItem("referral_promoter_id", searchParams.get("ref")!);
    }
    fetchVenue();
  }, [id, currentUserId]);

  const fetchVenue = async () => {
    if (!id) return;

    try {
      const { data } = await supabase.from("venues").select("*").eq("id", id).single();
      if (data) setVenue(data as Venue);

      if (currentUserId && id) {
        const { data: statusData } = await supabase
          .from("venue_staff")
          .select("status")
          .eq("venue_id", id)
          .eq("user_id", currentUserId)
          .maybeSingle();

        if (statusData) setConnectionStatus(statusData.status);
      }
    } catch (error) {
      console.error("Error fetching venue:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async () => {
    if (!currentUserId || !id) return toast.error("Please log in to apply");

    // Validate input data before database call
    const applicationData = {
      venue_id: id,
      user_id: currentUserId,
      status: "pending" as const,
    };
    
    const validation = venueStaffApplicationSchema.safeParse(applicationData);
    if (!validation.success) {
      toast.error("Invalid application data");
      return;
    }

    try {
      // Check for existing relationship first
      const { data: existing } = await supabase
        .from("venue_staff")
        .select("status")
        .eq("venue_id", id)
        .eq("user_id", currentUserId)
        .maybeSingle();
      
      if (existing) {
        toast.error(`Application already exists with status: ${existing.status}`);
        setConnectionStatus(existing.status);
        return;
      }

      const { error } = await supabase.from("venue_staff").insert(applicationData);
      
      if (error) {
        if (error.code === "23505") {
          toast.error("Application already exists");
        } else {
          toast.error("Failed to submit application");
        }
      } else {
        toast.success("Application sent to management!");
        setConnectionStatus("pending");
      }
    } catch (err) {
      toast.error("Failed to submit application");
    }
  };

  if (loading)
    return (
      <div className="h-screen flex items-center justify-center bg-black">
        <Loader2 className="animate-spin text-neon-green" />
      </div>
    );

  if (!venue)
    return <div className="h-screen flex items-center justify-center bg-black text-white">Venue Not Found</div>;

  return (
    <div className="min-h-screen bg-background pb-24 relative">
      <div className="absolute top-4 left-4 z-50">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(-1)}
          className="bg-black/40 backdrop-blur-md rounded-full border border-white/10 text-white"
        >
          <ArrowLeft className="w-6 h-6" />
        </Button>
      </div>

      <div className="relative h-[40vh] w-full">
        <img src={venue.image_url || "/placeholder.svg"} alt={venue.name} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
        <div className="absolute bottom-6 left-6 z-20">
          <Badge className="mb-2 bg-neon-pink/20 text-neon-pink border-neon-pink/30">{venue.location}</Badge>
          <h1 className="font-display text-4xl text-white uppercase tracking-tighter">{venue.name}</h1>
        </div>
      </div>

      <div className="px-4 -mt-6 relative z-30 mb-6">
        {mode === "talent" ? (
          <Button
            size="lg"
            onClick={handleApply}
            disabled={!!connectionStatus}
            className={`w-full h-14 text-lg font-bold uppercase tracking-widest rounded-xl shadow-2xl transition-all ${
              connectionStatus === "active"
                ? "bg-neon-green/20 text-neon-green border border-neon-green/30"
                : connectionStatus
                  ? "bg-zinc-800 text-zinc-500"
                  : "bg-neon-purple text-white"
            }`}
          >
            {connectionStatus === "active" ? (
              <>
                <CheckCircle2 className="mr-2" /> Connected
              </>
            ) : connectionStatus === "pending" ? (
              <>
                <Clock className="mr-2" /> Application Sent
              </>
            ) : (
              <>
                <Briefcase className="mr-2" /> Apply to Perform
              </>
            )}
          </Button>
        ) : mode === "manager" ? (
          <Button
            size="lg"
            onClick={() => navigate(`/venue/${id}/manage`)}
            className="w-full h-14 text-lg font-bold uppercase tracking-widest rounded-xl shadow-2xl bg-zinc-800 text-white border border-white/10"
          >
            <ShieldCheck className="mr-2" /> Manage Venue
          </Button>
        ) : (
          <>
            <Button
              size="lg"
              onClick={() => setPurchaseOpen(true)}
              className="w-full h-14 text-lg font-bold uppercase tracking-widest rounded-xl shadow-2xl bg-neon-green text-black"
            >
              <Ticket className="mr-2" /> Secure Entry
            </Button>

            <TicketPurchaseDialog
              open={purchaseOpen}
              onOpenChange={setPurchaseOpen}
              venueId={venue.id}
              venueName={venue.name}
              referralId={referralId}
            />
          </>
        )}
      </div>

      <Tabs defaultValue="feed" className="w-full">
        <TabsList className="w-full bg-transparent border-b border-white/5 h-12 px-4 justify-start gap-8">
          <TabsTrigger value="feed" className="uppercase font-bold tracking-widest text-[10px]">
            The Vibe
          </TabsTrigger>
          <TabsTrigger value="details" className="uppercase font-bold tracking-widest text-[10px]">
            Details
          </TabsTrigger>
        </TabsList>
        <TabsContent value="feed" className="p-4">
          <p className="text-zinc-500 italic text-sm">Follow to see the live feed...</p>
        </TabsContent>
        <TabsContent value="details" className="p-4">
          <p className="text-zinc-300 leading-relaxed text-sm mb-6">{venue.description}</p>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-white/5 rounded-xl border border-white/5 text-center">
              <p className="text-[10px] text-muted-foreground uppercase font-bold mb-1">Capacity</p>
              <p className="text-white font-display text-lg">{venue.capacity || "N/A"}</p>
            </div>
            <div className="p-4 bg-white/5 rounded-xl border border-white/5 text-center">
              <p className="text-[10px] text-muted-foreground uppercase font-bold mb-1">Status</p>
              <Badge className="bg-neon-green/20 text-neon-green">Open Now</Badge>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default VenueDetails;
