import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { MapPin, Search, Target, Radio, Zap, Plus, Minus, Sparkles } from "lucide-react";
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
  const [initialLoad, setInitialLoad] = useState(true);
  const [activeCategory, setActiveCategory] = useState("All Vibes");
  const [searchQuery, setSearchQuery] = useState("");
  const [followedNodes, setFollowedNodes] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchDiscoveryData = async () => {
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
            .limit(10),
        ]);

        if (vRes.data) setVenues(vRes.data as Venue[]);
        if (tRes.data) setFeaturedTalent(tRes.data);
        if (pRes.data) setTalentPosts(pRes.data);
      } catch (err) {
        console.error("Discovery Sync Error", err);
      } finally {
        setLoading(false);
        setInitialLoad(false);
      }
    };

    fetchDiscoveryData();
  }, [activeCategory]);

  const toggleFollow = (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Don't trigger the card click
    setFollowedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

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
      if ((i + 1) % 2 === 0 && talentPosts[postIndex]) {
        feed.push({ type: "talent", data: talentPosts[postIndex] });
        postIndex++;
      }
    }
    return feed;
  }, [venues, searchQuery, talentPosts]);

  if (initialLoad || contextLoading) return <LoadingState />;

  return (
    <div className="h-screen bg-black overflow-hidden flex flex-col font-body">
      {/* 🛠 HUD & SEARCH: THE "SOLID" ZONE */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-black pt-4 pb-8 px-8 border-b border-white/5">
        <div className="flex justify-between items-center h-20 mb-4">
          <div className="flex items-center gap-3">
            <Target className="w-4 h-4 text-neon-blue" />
            <h1 className="font-display text-2xl text-white uppercase tracking-wider italic pt-1">Discovery</h1>
          </div>
          <ActivitySidebar />
        </div>

        <div className="space-y-4 max-w-2xl mx-auto">
          <div className="relative">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="SEARCH SECTOR..."
              className="w-full bg-white/10 backdrop-blur-xl border border-white/10 pl-12 h-12 rounded-xl text-[10px] font-black tracking-[0.2em] uppercase text-white placeholder:text-white/20 focus:outline-none focus:border-neon-blue/40"
            />
          </div>

          <div className="flex overflow-x-auto gap-2 hide-scrollbar">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.name}
                onClick={() => setActiveCategory(cat.name)}
                className={cn(
                  "whitespace-nowrap px-4 py-2 rounded-full text-[9px] font-black uppercase tracking-widest transition-all border",
                  activeCategory === cat.name
                    ? `${cat.color} ${cat.border} scale-105 shadow-neon`
                    : "bg-white/5 text-white/50 border-white/5 hover:bg-white/10",
                )}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 📱 IMMERSIVE SNAP STREAM */}
      <div className="flex-1 overflow-y-scroll snap-y snap-mandatory hide-scrollbar pt-40">
        {/* SLIDE 1: ELITE SPOTLIGHT (Featured Nodes) */}
        <div className="h-[90vh] w-full snap-start relative flex flex-col justify-center bg-black">
          <div className="px-8 mb-8 flex items-center gap-3">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <h2 className="font-display text-4xl text-white uppercase italic tracking-tighter">Featured Spotlight</h2>
          </div>

          <div className="flex overflow-x-auto gap-6 px-8 hide-scrollbar scroll-smooth">
            {featuredTalent.map((talent) => (
              <div
                key={talent.id}
                onClick={() => navigate(`/talent/${talent.id}`)}
                className="flex flex-col gap-4 shrink-0 group cursor-pointer"
              >
                <div className="relative w-64 h-80 rounded-[2.5rem] bg-zinc-900 border border-white/5 overflow-hidden">
                  <img
                    src={talent.avatar_url || "/placeholder.svg"}
                    className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-all duration-700"
                    alt=""
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
                  <div className="absolute bottom-8 left-8">
                    <p className="font-display text-3xl text-white uppercase tracking-tighter leading-none mb-1">
                      {talent.display_name}
                    </p>
                    <span className="text-[8px] font-black text-neon-blue uppercase tracking-widest italic">
                      View Transmission
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="absolute bottom-4 w-full flex justify-center animate-bounce">
            <p className="text-[8px] font-black text-white/20 uppercase tracking-[0.4em]">
              Initialize Sector Exploration
            </p>
          </div>
        </div>

        {/* DATA FEED */}
        {combinedFeed.map((item, idx) => (
          <div
            key={`${item.type}-${idx}`}
            onClick={() => navigate(item.type === "venue" ? `/venue/${item.data.id}` : `/talent/${item.data.user_id}`)}
            className="h-screen w-full snap-start relative flex flex-col justify-end overflow-hidden"
          >
            <img
              src={(item.type === "venue" ? item.data.image_url : item.data.media_url) || "/placeholder.svg"}
              className="absolute inset-0 w-full h-full object-cover"
              alt=""
            />

            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/10 to-transparent opacity-95" />

            {/* 📍 METADATA ZONE (The Unified Pill Row) */}
            <div className="relative p-10 pb-36 z-10 max-w-4xl">
              <div className="flex items-center gap-3 mb-6">
                <Badge className="bg-neon-blue text-white border-none text-[9px] font-black uppercase tracking-[0.2em] px-5 py-2 rounded-full shadow-lg flex items-center gap-2">
                  <MapPin className="w-3 h-3" />
                  {item.type === "venue" ? item.data.location || "Sector Alpha" : "Live Intelligence"}
                </Badge>

                {/* THE LIVE PULSE & FOLLOW (+) TOGGLE */}
                <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md px-4 py-2 rounded-full border border-white/10">
                  <div className="w-1.5 h-1.5 bg-neon-green rounded-full animate-pulse shadow-[0_0_8px_#39FF14]" />
                  <span className="text-[8px] font-black text-white uppercase tracking-widest mr-2">Live</span>
                  <button
                    onClick={(e) => toggleFollow(item.data.id, e)}
                    className="w-5 h-5 flex items-center justify-center bg-white text-black rounded-full hover:bg-neon-blue transition-colors"
                  >
                    {followedNodes.has(item.data.id) ? <Minus className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                  </button>
                </div>
              </div>

              <h3 className="font-display text-[clamp(2.5rem,12vw,6rem)] text-white uppercase italic tracking-tighter leading-[0.85] whitespace-normal break-words hyphens-none line-clamp-3">
                {item.type === "venue" ? item.data.name : item.data.profiles?.display_name}
              </h3>

              {item.type === "talent" && (
                <p className="text-[10px] text-neon-purple font-black uppercase tracking-[0.3em] mt-4 flex items-center gap-2">
                  <Zap className="w-3 h-3 fill-neon-purple" /> Dynamic Uplink Active
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Discovery;
