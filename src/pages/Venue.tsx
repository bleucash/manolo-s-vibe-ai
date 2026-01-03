import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Venue } from "@/types/database";
import { Button } from "@/components/ui/button";
import { MapPin, Star, Ticket, Loader2, ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
// Corrected Named Import
import { TicketPurchaseDialog } from "@/components/TicketPurchaseDialog";

const VenuePage = () => {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [venue, setVenue] = useState<Venue | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchaseOpen, setPurchaseOpen] = useState(false);

  // Capture the Talent ID from the ?ref= URL parameter
  const referralId = searchParams.get("ref");

  useEffect(() => {
    fetchVenueData();
  }, [id]);

  const fetchVenueData = async () => {
    try {
      const { data, error } = await supabase.from("venues").select("*").eq("id", id).single();

      if (error) throw error;
      setVenue(data as Venue);
    } catch (error) {
      console.error("Error fetching venue:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-[hsl(150,100%,50%)]" />
      </div>
    );
  }

  if (!venue) return <div className="p-10 text-white font-display">Venue not found.</div>;

  return (
    <div className="min-h-screen bg-black pb-24">
      {/* HERO IMAGE */}
      <div className="relative h-[45vh] w-full">
        <img src={venue.image_url || "/placeholder.svg"} className="w-full h-full object-cover" alt={venue.name} />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/20" />
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-12 left-4 bg-black/40 backdrop-blur-xl text-white rounded-full border border-white/10"
          onClick={() => navigate(-1)}
        >
          <ChevronLeft className="w-6 h-6" />
        </Button>
      </div>

      {/* VENUE INFO */}
      <div className="px-6 -mt-12 relative z-10">
        <div className="flex justify-between items-end mb-6">
          <div className="space-y-1">
            <h1 className="text-4xl font-display text-white uppercase tracking-tighter leading-none">{venue.name}</h1>
            <div className="flex items-center gap-2 text-zinc-400">
              <MapPin className="w-4 h-4 text-neon-pink" />
              <span className="text-[10px] font-bold uppercase tracking-[0.2em]">{venue.location}</span>
            </div>
          </div>
          <div className="bg-white/5 backdrop-blur-2xl border border-white/10 p-3 rounded-2xl flex items-center gap-2 shadow-2xl">
            <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
            <span className="text-white font-black text-sm tracking-tighter">4.9</span>
          </div>
        </div>

        <p className="text-zinc-400 text-sm leading-relaxed mb-8 max-w-sm">
          {venue.category || "Exclusive Venue"} • Premium high-intensity nightlife experience.
        </p>

        {/* REFERRAL ACTIVE UI */}
        {referralId && (
          <div className="bg-[hsl(150,100%,50%)]/10 border border-[hsl(150,100%,50%)]/30 p-4 rounded-2xl mb-8 flex items-center justify-center animate-pulse">
            <p className="text-[9px] text-[hsl(150,100%,50%)] font-black uppercase tracking-[0.3em]">
              Direct Talent Referral Active
            </p>
          </div>
        )}

        {/* PURCHASE BUTTON */}
        <Button
          onClick={() => setPurchaseOpen(true)}
          className="w-full h-16 bg-[hsl(150,100%,50%)] text-black font-black uppercase tracking-[0.25em] rounded-2xl"
        >
          <Ticket className="mr-3 w-5 h-5 fill-black" />
          Secure Entry
        </Button>
      </div>

      <TicketPurchaseDialog
        open={purchaseOpen}
        onOpenChange={setPurchaseOpen}
        venueId={venue.id}
        venueName={venue.name}
        referralId={referralId}
      />
    </div>
  );
};

export default VenuePage;
