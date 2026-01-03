import { useEffect, useState } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { MapPin, Star, Ticket, ChevronLeft, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Venue as VenueType } from "@/types/database";
import { TicketPurchaseDialog } from "@/components/TicketPurchaseDialog";
import { Button } from "@/components/ui/button";

const Venue = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const [venue, setVenue] = useState<VenueType | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  
  // B2B Referral Capture
  const referralId = searchParams.get("ref");

  useEffect(() => {
    const fetchData = async () => {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id ?? null);

      // Fetch venue details
      if (!id) return;
      
      const { data, error } = await supabase
        .from("venues")
        .select("id, name, location, image_url, category, is_active")
        .eq("id", id)
        .maybeSingle();

      if (!error && data) {
        setVenue(data as VenueType);
      }
      setLoading(false);
    };

    fetchData();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          <span className="text-primary font-display uppercase tracking-widest text-[10px]">
            Loading Venue...
          </span>
        </motion.div>
      </div>
    );
  }

  if (!venue) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <h1 className="text-2xl font-display uppercase text-white mb-2">
            Venue Not Found
          </h1>
          <p className="text-muted-foreground text-sm mb-6">
            This venue doesn't exist or has been removed.
          </p>
          <Button
            onClick={() => navigate("/discovery")}
            className="bg-primary text-primary-foreground"
          >
            Back to Discovery
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      {/* Hero Section */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="relative h-[50vh] w-full"
      >
        {/* Hero Image */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: venue.image_url
              ? `url(${venue.image_url})`
              : "linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--accent)) 100%)",
          }}
        />
        
        {/* Gradient Overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/30 to-transparent" />

        {/* Back Button */}
        <motion.button
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          onClick={() => navigate(-1)}
          className="absolute top-4 left-4 z-10 p-3 rounded-full bg-black/50 backdrop-blur-sm border border-white/10 text-white hover:bg-black/70 transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </motion.button>

        {/* Referral Active Indicator */}
        {referralId && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="absolute top-4 right-4 z-10 flex items-center gap-2 px-3 py-2 rounded-full bg-primary/20 backdrop-blur-sm border border-primary/50"
          >
            <Zap className="w-4 h-4 text-primary" />
            <span className="text-primary text-xs font-bold uppercase tracking-wider">
              Referral Active
            </span>
          </motion.div>
        )}

        {/* Venue Info Overlay */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="absolute bottom-0 left-0 right-0 p-6"
        >
          {venue.category && (
            <span className="inline-block px-3 py-1 mb-3 text-[10px] font-bold uppercase tracking-widest text-primary bg-primary/20 rounded-full border border-primary/30">
              {venue.category}
            </span>
          )}
          <h1 className="text-4xl font-display uppercase tracking-tighter text-white mb-2">
            {venue.name}
          </h1>
          <div className="flex items-center gap-4 text-muted-foreground">
            <div className="flex items-center gap-1">
              <MapPin className="w-4 h-4 text-accent" />
              <span className="text-sm">{venue.location}</span>
            </div>
            <div className="flex items-center gap-1">
              <Star className="w-4 h-4 text-primary fill-primary" />
              <span className="text-sm">4.8</span>
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* Content Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="p-6 space-y-6"
      >
        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Vibe Score", value: "98%" },
            { label: "Tonight", value: "Hot" },
            { label: "Cover", value: "$20" },
          ].map((stat, idx) => (
            <div
              key={idx}
              className="bg-card border border-border rounded-xl p-4 text-center"
            >
              <div className="text-xl font-bold text-primary">{stat.value}</div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1">
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        {/* Description */}
        <div className="bg-card border border-border rounded-xl p-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-foreground mb-2">
            The Vibe
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Experience the ultimate nightlife destination. Premium sound systems, 
            world-class DJs, and an atmosphere that keeps you coming back.
          </p>
        </div>

        {/* Secure Entry CTA */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.6 }}
          className="pt-4"
        >
          <TicketPurchaseDialog
            venue={venue}
            currentUserId={currentUserId}
            referralId={referralId}
          />
        </motion.div>

        {/* Referral Attribution Notice */}
        {referralId && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="text-center text-[10px] uppercase tracking-widest text-muted-foreground"
          >
            <Zap className="w-3 h-3 inline mr-1 text-primary" />
            Your purchase supports a local promoter
          </motion.p>
        )}
      </motion.div>
    </div>
  );
};

export default Venue;
