import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin, Search, Star, Sparkles, UserCheck, Zap, ArrowRight, Filter } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Venue } from "@/types/database";
import { useUserMode } from "@/contexts/UserModeContext";

const CATEGORIES = ["All Vibes", "Nightclubs", "Lounges", "Hookah", "Strip Clubs", "LGBQT+", "Bars", "Live Music"];

const Discovery = () => {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [featuredTalent, setFeaturedTalent] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("All Vibes");
  const { mode } = useUserMode();
  const navigate = useNavigate();

  useEffect(() => {
    fetchDiscoveryData();
  }, [activeCategory]);

  const fetchDiscoveryData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Venues (Filtered by category if selected)
      let venueQuery = supabase.from("venues").select("*");
      if (activeCategory !== "All Vibes") {
        venueQuery = venueQuery.ilike("category", `%${activeCategory}%`);
      }
      const { data: venueData } = await venueQuery;
      if (venueData) setVenues(venueData as Venue[]);

      // 2. Fetch Featured Talent for Spotlight (The Monetization Slot)
      const { data: talentData } = await supabase
        .from("profiles")
        .select("id, display_name, username, avatar_url, sub_role")
        .eq("role_type", "talent")
        .limit(10);

      if (talentData) setFeaturedTalent(talentData);
    } catch (error) {
      // Standardize error handling for production
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black pb-32 overflow-x-hidden animate-in fade-in duration-700">
      {/* THE MAN PAGE HEADER (Sticky) */}
      <div className="sticky top-0 z-50 bg-black/80 backdrop-blur-xl pt-12 pb-4 px-6 border-b border-white/5">
        <div className="flex justify-between items-end mb-6">
          <h1 className="text-5xl font-display text-white uppercase tracking-tighter leading-[0.8]">
            Explore <br /> <span className="text-neon-pink">The Pulse</span>
          </h1>
          <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-white/10 flex items-center justify-center shadow-[0_0_15px_rgba(255,0,127,0.1)]">
            <Zap className="w-6 h-6 text-neon-pink fill-neon-pink/20" />
          </div>
        </div>

        {/* NEURAL SEARCH */}
        <div className="relative group mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 group-focus-within:text-neon-pink transition-colors" />
          <input
            type="text"
            placeholder="Search Venues or Talent..."
            className="w-full bg-zinc-900/50 border border-white/10 rounded-xl py-4 pl-12 pr-4 text-[10px] text-white focus:outline-none focus:ring-1 focus:ring-neon-pink/50 transition-all placeholder:text-zinc-700 font-bold uppercase tracking-[0.2em]"
          />
        </div>

        {/* CATEGORY NAV */}
        <div className="flex overflow-x-auto gap-2 no-scrollbar pb-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`whitespace-nowrap px-5 py-2 rounded-full text-[9px] font-black uppercase tracking-widest transition-all border ${
                activeCategory === cat
                  ? "bg-neon-pink text-white border-neon-pink shadow-[0_0_15px_rgba(255,0,127,0.3)]"
                  : "bg-zinc-900/50 text-zinc-500 border-white/5"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* 1. TALENT SPOTLIGHT (Carousel) */}
      <div className="mt-10 mb-16">
        <div className="px-6 flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <h2 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em]">Talent Spotlight</h2>
          </div>
          <button
            onClick={() => navigate("/talent-directory")}
            className="flex items-center gap-2 text-[9px] font-bold text-neon-blue uppercase tracking-widest group"
          >
            Directory <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>

        <div className="flex overflow-x-auto gap-4 px-6 no-scrollbar snap-x">
          {loading
            ? [1, 2, 3].map((i) => <Skeleton key={i} className="h-80 w-64 shrink-0 rounded-[2.5rem] bg-zinc-900" />)
            : featuredTalent.map((talent) => (
                <div
                  key={talent.id}
                  onClick={() => navigate(`/talent/${talent.id}`)}
                  className="relative h-80 w-64 shrink-0 rounded-[2.5rem] overflow-hidden snap-center border border-white/5 group shadow-2xl bg-zinc-900 transition-all active:scale-95"
                >
                  <img
                    src={talent.avatar_url || ""}
                    className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />

                  <div className="absolute bottom-6 left-6 right-6">
                    <h3 className="text-2xl font-display text-white uppercase tracking-tighter leading-none mb-1">
                      {talent.display_name}
                    </h3>
                    <p className="text-[9px] text-zinc-400 font-bold uppercase tracking-widest">
                      {talent.sub_role || "Vibe Artist"}
                    </p>
                  </div>
                </div>
              ))}
        </div>
      </div>

      {/* 2. VENUE EXPLORATION (Vertical Feed) */}
      <div className="px-6 space-y-10">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-neon-pink" />
          <h2 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em]">Intelligence Peak</h2>
        </div>

        {loading
          ? [1, 2].map((i) => <Skeleton key={i} className="h-[28rem] w-full rounded-[3.5rem] bg-zinc-900" />)
          : venues.map((venue) => (
              <div
                key={venue.id}
                onClick={() => navigate(`/venue/${venue.id}`)}
                className="relative h-[28rem] w-full rounded-[3.5rem] overflow-hidden border border-white/10 group shadow-2xl transition-all"
              >
                <img
                  src={venue.image_url || "/placeholder.svg"}
                  className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
                />

                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />

                {/* Visual Hook Indicator */}
                <div className="absolute top-8 right-8 flex items-center gap-2 bg-black/60 backdrop-blur-xl border border-white/10 px-4 py-2 rounded-full">
                  <div className="w-1.5 h-1.5 bg-neon-pink rounded-full animate-pulse shadow-[0_0_8px_rgba(255,0,127,1)]" />
                  <span className="text-[8px] font-black text-white uppercase tracking-widest">Live Vibe</span>
                </div>

                <div className="absolute bottom-12 left-10 right-10">
                  <div className="space-y-3">
                    <h3 className="text-6xl font-display text-white uppercase tracking-tighter leading-[0.8] drop-shadow-2xl italic">
                      {venue.name}
                    </h3>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] text-zinc-400 font-black uppercase tracking-[0.2em]">
                        {venue.location}
                      </span>
                      <Badge className="bg-white/5 border-white/10 text-white text-[7px] font-black tracking-widest uppercase">
                        {venue.category || "Nightclub"}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            ))}
      </div>
    </div>
  );
};

export default Discovery;
