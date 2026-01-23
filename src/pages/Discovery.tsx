import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Search, Target } from "lucide-react";
import { useUserMode } from "@/contexts/UserModeContext";
import { Venue } from "@/types/database";
import { ActivitySidebar } from "@/components/ActivitySidebar";
import { cn } from "@/lib/utils";

const CATEGORIES = [
  { name: "All Vibes", color: "bg-white text-black", border: "border-white" },
  { name: "Nightclubs", color: "bg-[#00B7FF] text-black", border: "border-[#00B7FF]" },
  { name: "Bars", color: "bg-[#39FF14] text-black", border: "border-[#39FF14]" },
  { name: "Live Music", color: "bg-[#39FF14] text-black", border: "border-[#39FF14]" },
  { name: "Lounges", color: "bg-[#BF00FF] text-white", border: "border-[#BF00FF]" },
  { name: "Hookah", color: "bg-[#00FFFF] text-black", border: "border-[#00FFFF]" },
  { name: "Strip Clubs", color: "bg-[#FF007F] text-white", border: "border-[#FF007F]" },
  { name: "LGBQT+", color: "bg-[#FF5F1F] text-white", border: "border-[#FF5F1F]" },
];

const Discovery = () => {
  const navigate = useNavigate();
  const { isLoading: contextLoading } = useUserMode();

  const [venues, setVenues] = useState<Venue[]>([]);
  const [featuredTalent, setFeaturedTalent] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("All Vibes");
  const [searchQuery, setSearchQuery] = useState("");

  // 1. Unified Data Fetching with "Blink" Protection
  useEffect(() => {
    const fetchDiscoveryData = async () => {
      // We don't set global loading to true if we already have data
      // This prevents the "Blink"
      if (venues.length === 0) setLoading(true);

      try {
        let venueQuery = supabase.from("venues").select("*");
        if (activeCategory !== "All Vibes") {
          venueQuery = venueQuery.ilike("category", `%${activeCategory}%`);
        }

        const [vRes, tRes] = await Promise.all([
          venueQuery,
          supabase.from("profiles").select("id, display_name, username, avatar_url").eq("role_type", "talent").limit(8),
        ]);

        if (vRes.data) setVenues(vRes.data as Venue[]);
        if (tRes.data) setFeaturedTalent(tRes.data);
      } catch (err) {
        console.error("Discovery Sync Error", err);
      } finally {
        setLoading(false);
      }
    };

    fetchDiscoveryData();
  }, [activeCategory]);

  const filteredVenues = useMemo(() => {
    return venues.filter(
      (v) =>
        v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.location?.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [venues, searchQuery]);

  // ✅ REMOVED: Global LoadingState return.
  // We handle loading states locally within sections to stop the "Bottom Nav Blink"

  return (
    <div className="min-h-screen bg-background pb-32 animate-in fade-in duration-700 hide-scrollbar">
      {/* 🛠 HUD HEADER */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-background/90 backdrop-blur-xl border-b border-white/5 px-8 h-20 flex justify-between items-center pt-4">
        <div className="flex items-center gap-3">
          <Target className="w-4 h-4 text-neon-blue" />
          <h1 className="font-display text-2xl text-white uppercase tracking-wider italic pt-1">Sector Search</h1>
        </div>
        <ActivitySidebar />
      </div>

      {/* 🔍 SEARCH & FILTERS */}
      <div className="pt-24 px-8 space-y-6">
        <div className="relative group max-w-2xl mx-auto">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-neon-blue transition-colors" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="INPUT SECTOR COORDINATES..."
            className="w-full bg-card/40 border border-white/5 pl-14 h-14 rounded-2xl text-[10px] font-black tracking-[0.2em] uppercase text-white placeholder:text-zinc-800 focus:outline-none focus:border-neon-blue/40 transition-all"
          />
        </div>

        {/* CATEGORY CHIPS: Reset to smaller, tighter MVP scale */}
        <div className="flex overflow-x-auto gap-2 hide-scrollbar pb-2 max-w-2xl mx-auto">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.name}
              onClick={() => setActiveCategory(cat.name)}
              className={cn(
                "whitespace-nowrap px-4 py-1.5 rounded-full text-[8px] font-black uppercase tracking-widest transition-all border",
                activeCategory === cat.name
                  ? `${cat.color} ${cat.border} shadow-lg scale-105`
                  : "bg-card/20 text-muted-foreground border-white/5",
              )}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* 🔘 FEATURED NODES: Increased Top Padding to prevent Search Bar overlap */}
      <div className="pt-12 pb-8">
        <div
          className={cn(
            "flex overflow-x-auto gap-6 px-8 hide-scrollbar scroll-smooth",
            featuredTalent.length <= 2 ? "justify-center" : "justify-start",
          )}
        >
          {loading && featuredTalent.length === 0 ? (
            <div className="w-full h-48 flex items-center justify-center text-[8px] font-black uppercase text-zinc-800 tracking-widest">
              Hydrating Nodes...
            </div>
          ) : (
            featuredTalent.map((talent) => (
              <div
                key={talent.id}
                onClick={() => navigate(`/talent/${talent.id}`)}
                className="flex flex-col gap-3 shrink-0 group cursor-pointer"
              >
                <div className="relative w-44 h-44 rounded-[2rem] bg-card border border-white/5 group-hover:border-neon-blue/50 transition-all duration-700 overflow-hidden shadow-2xl">
                  <img
                    src={talent.avatar_url || "/placeholder.svg"}
                    className="w-full h-full object-cover opacity-40 group-hover:opacity-100 transition-all duration-700 group-hover:scale-110"
                    alt=""
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
                  <div className="absolute bottom-5 left-6 right-6">
                    <p className="font-display text-xl text-white uppercase tracking-wide truncate mb-1">
                      {talent.display_name}
                    </p>
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 bg-neon-green rounded-full shadow-[0_0_8px_#39FF14]" />
                      <span className="text-[7px] font-black text-neon-green uppercase tracking-widest">Linked</span>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 🌐 SECTOR FEED: Stripped back MVP Cards */}
      <div className="px-8 space-y-10 max-w-3xl mx-auto pb-20">
        {loading && filteredVenues.length === 0 ? (
          <div className="flex flex-col items-center py-20 gap-4">
            <div className="w-12 h-1 bg-zinc-900 overflow-hidden rounded-full">
              <div className="h-full bg-neon-blue w-1/2 animate-ping" />
            </div>
            <p className="text-[9px] font-black text-zinc-700 uppercase tracking-widest">Scanning Sectors...</p>
          </div>
        ) : (
          filteredVenues.map((venue) => (
            <div
              key={venue.id}
              onClick={() => navigate(`/venue/${venue.id}`)}
              className="group relative w-full bg-card/10 rounded-[2.5rem] overflow-hidden border border-white/5 hover:border-neon-blue/20 transition-all duration-1000 shadow-2xl cursor-pointer"
            >
              <div className="relative h-80 w-full overflow-hidden">
                <img
                  src={venue.image_url || "/placeholder.svg"}
                  alt={venue.name}
                  className="w-full h-full object-cover opacity-40 group-hover:opacity-80 transition-all duration-1000 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />

                <div className="absolute bottom-8 left-8 right-8">
                  <Badge className="bg-background/80 backdrop-blur-md border-white/10 text-[8px] font-black uppercase tracking-[0.2em] px-4 py-1.5 rounded-full mb-4">
                    <MapPin className="w-3 h-3 mr-2 text-neon-blue" />
                    {venue.location || "SECTOR UNKNOWN"}
                  </Badge>
                  <h3 className="font-display text-5xl text-white uppercase italic tracking-tighter leading-none line-clamp-1">
                    {venue.name}
                  </h3>
                </div>
              </div>

              <div className="p-6 flex items-center justify-end">
                <Button
                  variant="ghost"
                  className="rounded-2xl border border-white/5 bg-white text-black hover:bg-neon-blue hover:text-white transition-all text-[10px] font-black uppercase tracking-widest px-8 h-12 w-full md:w-auto"
                >
                  Enter Sector
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Discovery;
