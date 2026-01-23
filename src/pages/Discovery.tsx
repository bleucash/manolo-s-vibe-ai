import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { MapPin, Search, Target, Radio, Sparkles, Zap, UserPlus } from "lucide-react";
import { useUserMode } from "@/contexts/UserModeContext";
import { Venue } from "@/types/database";
import { ActivitySidebar } from "@/components/ActivitySidebar";
import LoadingState from "@/components/ui/LoadingState";
import { cn } from "@/lib/utils";

const CATEGORIES = [
  { name: "All Vibes", color: "bg-white text-black", border: "border-white" },
  { name: "Nightclubs", color: "bg-[#00B7FF] text-black", border: "border-[#00B7FF]" },
  { name: "Bars", color: "bg-[#39FF14] text-black", border: "border-[#39FF14]" },
  { name: "Live Music", color: "bg-[#FFD700] text-black", border: "border-[#FFD700]" },
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
  const [talentPosts, setTalentPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("All Vibes");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const fetchDiscoveryData = async () => {
      setLoading(true);
      try {
        let venueQuery = supabase.from("venues").select("*");
        if (activeCategory !== "All Vibes") {
          venueQuery = venueQuery.ilike("category", `%${activeCategory}%`);
        }

        const [vRes, tRes, pRes] = await Promise.all([
          venueQuery,
          supabase.from("profiles").select("id, display_name, username, avatar_url").eq("role_type", "talent").limit(8),
          supabase
            .from("posts")
            .select(`*, profiles:user_id (display_name, username, avatar_url)`)
            .not("media_url", "is", null)
            .limit(5),
        ]);

        if (vRes.data) setVenues(vRes.data as Venue[]);
        if (tRes.data) setFeaturedTalent(tRes.data);
        if (pRes.data) setTalentPosts(pRes.data);
      } catch (err) {
        console.error("Discovery Sync Error", err);
      } finally {
        setLoading(false);
      }
    };

    fetchDiscoveryData();
  }, [activeCategory]);

  const combinedFeed = useMemo(() => {
    const filtered = venues.filter(
      (v) =>
        v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.location?.toLowerCase().includes(searchQuery.toLowerCase()),
    );

    const feed = [];
    let postIndex = 0;
    for (let i = 0; i < filtered.length; i++) {
      feed.push({ type: "venue", data: filtered[i] });
      if ((i + 1) % 3 === 0 && talentPosts[postIndex]) {
        feed.push({ type: "talent", data: talentPosts[postIndex] });
        postIndex++;
      }
    }
    return feed;
  }, [venues, searchQuery, talentPosts]);

  if (loading || contextLoading) return <LoadingState />;

  return (
    <div className="min-h-screen bg-background pb-32 animate-in fade-in duration-700 hide-scrollbar overflow-x-hidden">
      {/* HUD HEADER */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-background/90 backdrop-blur-xl border-b border-white/5 px-8 h-20 flex justify-between items-center pt-4">
        <div className="flex items-center gap-3">
          <Target className="w-4 h-4 text-neon-blue" />
          <h1 className="font-display text-2xl text-white uppercase tracking-wider italic pt-1">Sector Search</h1>
        </div>
        <ActivitySidebar />
      </div>

      {/* SEARCH & SLIM FILTERS */}
      <div className="pt-24 px-8 space-y-5">
        <div className="relative group max-w-2xl mx-auto">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-neon-blue transition-colors" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="INPUT SECTOR COORDINATES..."
            className="w-full bg-card/40 border border-white/5 pl-14 h-14 rounded-2xl text-[10px] font-black tracking-[0.2em] uppercase text-white placeholder:text-zinc-800 focus:outline-none focus:border-neon-blue/40 transition-all"
          />
        </div>

        {/* TIGHTER CATEGORY PILLS */}
        <div className="flex overflow-x-auto gap-2 hide-scrollbar pb-2 max-w-2xl mx-auto">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.name}
              onClick={() => setActiveCategory(cat.name)}
              className={cn(
                "whitespace-nowrap px-3 py-1.5 rounded-full text-[7px] font-black uppercase tracking-widest transition-all border",
                activeCategory === cat.name
                  ? `${cat.color} ${cat.border} scale-105`
                  : "bg-card/20 text-muted-foreground border-white/5",
              )}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* FEATURED TALENT NODES */}
      <div className="pt-12 pb-8">
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
              <div className="relative w-44 h-44 rounded-[2rem] bg-card border border-white/5 group-hover:border-neon-blue/50 transition-all duration-700 overflow-hidden shadow-2xl">
                <img
                  src={talent.avatar_url || "/placeholder.svg"}
                  className="w-full h-full object-cover opacity-40 group-hover:opacity-100 transition-all duration-700 group-hover:scale-110"
                  alt=""
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
                <div className="absolute bottom-6 left-6 right-6">
                  <p className="font-display text-xl text-white uppercase tracking-wide truncate mb-1">
                    {talent.display_name}
                  </p>
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 bg-neon-green rounded-full shadow-[0_0_8px_#39FF14]" />
                    <span className="text-[8px] font-black text-neon-green uppercase tracking-widest">Active</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* COMBINED SECTOR FEED (No Entry Button) */}
      <div className="px-8 space-y-12 max-w-3xl mx-auto pb-20">
        {combinedFeed.map((item, idx) =>
          item.type === "venue" ? (
            <div
              key={`v-${item.data.id}-${idx}`}
              onClick={() => navigate(`/venue/${item.data.id}`)}
              className="group relative w-full bg-card/10 rounded-[2.5rem] overflow-hidden border border-white/5 hover:border-neon-blue/20 transition-all duration-1000 shadow-2xl cursor-pointer"
            >
              <div className="relative min-h-[26rem] w-full overflow-hidden flex flex-col justify-end">
                <img
                  src={item.data.image_url || "/placeholder.svg"}
                  alt={item.data.name}
                  className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:opacity-90 transition-all duration-1000 group-hover:scale-105"
                />

                {/* FOLLOW ICON OVERLAY (Top Right) */}
                <div className="absolute top-8 right-8 z-20">
                  <div className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center hover:bg-neon-blue hover:text-white transition-all">
                    <UserPlus className="w-4 h-4" />
                  </div>
                </div>

                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/10 to-transparent opacity-95" />

                <div className="relative p-10 z-10">
                  <Badge className="bg-neon-blue text-white border-none text-[8px] font-black uppercase tracking-[0.2em] px-4 py-1.5 rounded-full mb-4 inline-flex items-center">
                    <MapPin className="w-3 h-3 mr-2" />
                    {item.data.location || "SECTOR UNKNOWN"}
                  </Badge>

                  {/* Word Wrap + Break Protection */}
                  <h3 className="font-display text-6xl md:text-8xl text-white uppercase italic tracking-tighter leading-[0.8] whitespace-normal break-words hyphens-none">
                    {item.data.name}
                  </h3>
                </div>
              </div>
            </div>
          ) : (
            <div
              key={`p-${item.data.id}-${idx}`}
              onClick={() => navigate(`/talent/${item.data.user_id}`)}
              className="relative h-96 w-full rounded-[2.5rem] overflow-hidden border border-neon-purple/20 bg-zinc-900/50 shadow-2xl cursor-pointer group"
            >
              <img
                src={item.data.media_url}
                className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity"
                alt=""
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
              <div className="absolute bottom-10 left-10">
                <h4 className="text-5xl font-display text-white uppercase italic leading-none tracking-tighter">
                  {item.data.profiles?.display_name}
                </h4>
                <p className="text-[9px] text-neon-purple font-black uppercase tracking-widest mt-3 flex items-center gap-2">
                  <Zap className="w-3 h-3 fill-neon-purple animate-pulse" /> Live Transmission
                </p>
              </div>
            </div>
          ),
        )}
      </div>
    </div>
  );
};

export default Discovery;
