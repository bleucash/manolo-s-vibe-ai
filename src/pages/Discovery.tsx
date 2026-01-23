import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { MapPin, Search, Sparkles, ArrowRight, Radio, Target, Filter } from "lucide-react";
import { useUserMode } from "@/contexts/UserModeContext";
import { Venue } from "@/types/database";
import LoadingState from "@/components/ui/LoadingState";
import { ActivitySidebar } from "@/components/ActivitySidebar";
import { cn } from "@/lib/utils";

const CATEGORIES = [
  { name: "All Vibes", color: "bg-white text-black", border: "border-white" },
  { name: "Nightclubs", color: "bg-[#00B7FF] text-black shadow-[0_0_15px_#00B7FF]", border: "border-[#00B7FF]" },
  { name: "Bars", color: "bg-[#39FF14] text-black shadow-[0_0_15px_#39FF14]", border: "border-[#39FF14]" },
  { name: "Live Music", color: "bg-[#39FF14] text-black shadow-[0_0_15px_#39FF14]", border: "border-[#39FF14]" },
  { name: "Lounges", color: "bg-[#BF00FF] text-white shadow-[0_0_15px_#BF00FF]", border: "border-[#BF00FF]" },
  { name: "Hookah", color: "bg-[#00FFFF] text-black shadow-[0_0_15_#00FFFF]", border: "border-[#00FFFF]" },
  { name: "Strip Clubs", color: "bg-[#FF007F] text-white shadow-[0_0_15px_#FF007F]", border: "border-[#FF007F]" },
  { name: "LGBQT+", color: "bg-[#FF5F1F] text-white shadow-[0_0_15px_#FF5F1F]", border: "border-[#FF5F1F]" },
];

const Discovery = () => {
  const navigate = useNavigate();
  const { isLoading: contextLoading } = useUserMode();

  const [venues, setVenues] = useState<Venue[]>([]);
  const [featuredTalent, setFeaturedTalent] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("All Vibes");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchDiscoveryData();
  }, [activeCategory]);

  const fetchDiscoveryData = async () => {
    setLoading(true);
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

  const filteredVenues = venues.filter(
    (v) =>
      v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.location?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  if (loading || contextLoading) return <LoadingState />;

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

      {/* 🔍 SEARCH & FILTERS (Integrated Container) */}
      <div className="pt-24 px-8 space-y-6">
        <div className="relative group max-w-2xl mx-auto flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-neon-blue transition-colors" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="INPUT SECTOR COORDINATES..."
              className="w-full bg-card/40 border border-white/5 pl-14 h-14 rounded-[1.5rem] text-[10px] font-black tracking-[0.2em] uppercase text-white placeholder:text-zinc-800 focus:outline-none focus:border-neon-blue/40 transition-all"
            />
          </div>
          <Button
            variant="ghost"
            className="h-14 w-14 rounded-[1.5rem] border border-white/5 bg-card/40 text-muted-foreground hover:text-white"
          >
            <Filter className="h-4 w-4" />
          </Button>
        </div>

        {/* CATEGORY CHIPS */}
        <div className="flex overflow-x-auto gap-3 no-scrollbar pb-2 max-w-2xl mx-auto">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.name}
              onClick={() => setActiveCategory(cat.name)}
              className={cn(
                "whitespace-nowrap px-6 py-2 rounded-full text-[8px] font-black uppercase tracking-widest transition-all border",
                activeCategory === cat.name
                  ? `${cat.color} ${cat.border}`
                  : "bg-card/20 text-muted-foreground border-white/5 hover:border-white/20",
              )}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* 🔘 FEATURED NODES (Talent - Large Squircles) */}
      <div className="pt-8 pb-12">
        <div className="px-8 flex items-center justify-between mb-8">
          <div className="flex items-center gap-2">
            <Radio className="w-3 h-3 text-neon-green animate-pulse" />
            <h2 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.4em]">Primary Talent</h2>
          </div>
          <button
            onClick={() => navigate("/talent-directory")}
            className="text-[9px] font-black text-neon-blue uppercase tracking-widest flex items-center gap-2 group"
          >
            Directory <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>

        <div
          className={cn(
            "flex overflow-x-auto gap-6 px-8 hide-scrollbar scroll-smooth",
            featuredTalent.length <= 2 ? "justify-center" : "justify-start",
          )}
        >
          {featuredTalent.map((talent) => (
            <div
              key={talent.id}
              onClick={() => navigate(`/talent/${talent.id}`)}
              className="flex flex-col gap-3 shrink-0 group cursor-pointer"
            >
              <div className="relative w-48 h-48 rounded-[3rem] bg-card border border-white/5 group-hover:border-neon-blue/50 transition-all duration-700 overflow-hidden shadow-2xl">
                <img
                  src={talent.avatar_url || "/placeholder.svg"}
                  className="w-full h-full object-cover opacity-50 group-hover:opacity-100 transition-all duration-1000 group-hover:scale-110"
                  alt=""
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
                <div className="absolute bottom-6 left-8 right-8">
                  <p className="font-display text-2xl text-white uppercase tracking-wide truncate mb-1">
                    {talent.display_name}
                  </p>
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 bg-neon-green rounded-full shadow-[var(--shadow-green)]" />
                    <span className="text-[8px] font-black text-neon-green uppercase tracking-widest">Linked Node</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 🌐 SECTOR FEED (Venues - Modular Cards) */}
      <div className="px-8 space-y-12 max-w-3xl mx-auto pb-20">
        <div className="flex items-center gap-2 mb-2 px-4">
          <Sparkles className="w-3 h-3 text-amber-500" />
          <h2 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.4em]">Available Sectors</h2>
        </div>

        {filteredVenues.map((venue) => (
          <div
            key={venue.id}
            onClick={() => navigate(`/venue/${venue.id}`)}
            className="group relative w-full bg-card/10 rounded-[4rem] overflow-hidden border border-white/5 hover:border-neon-blue/20 transition-all duration-1000 shadow-[var(--shadow-glow)] cursor-pointer"
          >
            <div className="relative h-96 w-full overflow-hidden">
              <img
                src={venue.image_url || "/placeholder.svg"}
                alt={venue.name}
                className="w-full h-full object-cover opacity-40 group-hover:opacity-80 transition-all duration-1000 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />

              <div className="absolute bottom-12 left-12 right-12">
                <Badge className="bg-background/80 backdrop-blur-md border-white/10 text-[9px] font-black uppercase tracking-[0.2em] px-6 py-2 rounded-full mb-6">
                  {venue.location || "SECTOR UNKNOWN"}
                </Badge>
                <h3 className="font-display text-6xl text-white uppercase italic tracking-tighter leading-none line-clamp-2">
                  {venue.name}
                </h3>
              </div>
            </div>

            <div className="p-12 flex items-center justify-between">
              <div className="flex items-center gap-12">
                <div className="flex flex-col">
                  <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-2">
                    Vibe Type
                  </span>
                  <span className="font-display text-2xl text-white uppercase italic">
                    {venue.category || "General"}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-2">
                    Occupancy
                  </span>
                  <div className="h-1.5 w-24 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-neon-blue w-[60%] shadow-[var(--shadow-neon)]" />
                  </div>
                </div>
              </div>

              <Button
                variant="ghost"
                className="rounded-2xl border border-white/5 bg-white text-black hover:bg-neon-blue hover:text-white transition-all text-[11px] font-black uppercase tracking-widest px-10 h-16"
              >
                Enter Sector
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Discovery;
