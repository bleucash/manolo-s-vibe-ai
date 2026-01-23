import { useEffect, useState, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { MapPin, Search, Target, Plus, Minus, Zap } from "lucide-react";
import { useUserMode } from "@/contexts/UserModeContext";
import { Venue } from "@/types/database";
import { ActivitySidebar } from "@/components/ActivitySidebar";
import LoadingState from "@/components/ui/LoadingState";
import { cn } from "@/lib/utils";

const CATEGORIES = [
  { name: "All Vibes", color: "bg-white", text: "text-black", glow: "#FFFFFF" },
  { name: "Nightclubs", color: "bg-[#00B7FF]", text: "text-black", glow: "#00B7FF" },
  { name: "Bars", color: "bg-[#39FF14]", text: "text-black", glow: "#39FF14" },
  { name: "Live Music", color: "bg-[#FFD700]", text: "text-black", glow: "#FFD700" },
  { name: "Lounges", color: "bg-[#BF00FF]", text: "text-white", glow: "#BF00FF" },
  { name: "Hookah", color: "bg-[#00FFFF]", text: "text-black", glow: "#00FFFF" },
  { name: "Strip Clubs", color: "bg-[#FF007F]", text: "text-white", glow: "#FF007F" },
  { name: "LGBQT+", color: "bg-[#FF5F1F]", text: "text-white", glow: "#FF5F1F" },
];

const Discovery = () => {
  const navigate = useNavigate();
  const { isLoading: contextLoading } = useUserMode();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: "instant" });
    }
  }, [activeCategory]);

  const toggleFollow = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFollowedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const combinedFeed = useMemo(() => {
    const filtered = (venues || []).filter(
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
      {/* 🛠 FIXED HUD (The Solid Shell) */}
      <div className="fixed top-0 left-0 right-0 z-[150] bg-black pt-4 overflow-visible">
        <div className="px-8 flex justify-between items-center h-16 mb-2">
          <div className="flex items-center gap-3">
            <Target className="w-4 h-4 text-neon-blue" />
            <h1 className="font-display text-2xl text-white uppercase tracking-wider italic pt-1 leading-none">
              Discovery
            </h1>
          </div>
          <ActivitySidebar />
        </div>

        <div className="max-w-2xl mx-auto px-8 mb-6 overflow-visible">
          <div className="relative group">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/20" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="SEARCH SECTOR..."
              className="w-full bg-zinc-950 border border-white/5 pl-12 h-11 rounded-xl text-[9px] font-black tracking-[0.2em] uppercase text-white placeholder:text-white/5 focus:outline-none"
            />
          </div>
        </div>

        {/* PILLS: Ignite Bleed Protected by py-4 */}
        <div className="flex overflow-x-auto gap-3 hide-scrollbar px-8 py-4 overflow-visible relative z-[160]">
          {CATEGORIES.map((cat) => {
            const isActive = activeCategory === cat.name;
            return (
              <button
                key={cat.name}
                onClick={() => setActiveCategory(cat.name)}
                className={cn(
                  "whitespace-nowrap px-4 py-1.5 rounded-full text-[8px] font-black uppercase tracking-widest transition-all duration-300 border relative",
                  isActive
                    ? `${cat.color} ${cat.text} border-transparent scale-105`
                    : "bg-zinc-900 text-white/30 border-white/5",
                )}
                style={{
                  boxShadow: isActive ? `0 0 25px ${cat.glow}99` : "none",
                }}
              >
                {cat.name}
              </button>
            );
          })}
        </div>

        {/* THE GRIZZ (Atmospheric Scrim) - Solid to Transparent transition */}
        <div className="absolute -bottom-24 left-0 right-0 h-24 bg-gradient-to-b from-black via-black/90 to-transparent pointer-events-none z-[140]" />
      </div>

      {/* 📱 IMMERSIVE FEED (Universal Snap Logic) */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-scroll snap-y snap-mandatory hide-scrollbar"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {/* Invisible Spacer Slide: Prevents the "Confusion" on Chrome */}
        <div className="h-[22rem] w-full shrink-0 snap-start pointer-events-none" />

        {/* SLIDE 1: SPOTLIGHT */}
        <div className="min-h-[75dvh] w-full snap-center relative flex flex-col justify-start bg-black pt-4 pb-12">
          <div className="flex overflow-x-auto gap-6 px-8 hide-scrollbar scroll-smooth pb-10">
            {featuredTalent.map((talent) => (
              <div
                key={talent.id}
                onClick={() => navigate(`/talent/${talent.id}`)}
                className="flex flex-col gap-4 shrink-0 cursor-pointer"
              >
                <div className="relative w-[75vw] md:w-80 h-[50dvh] rounded-[2.5rem] bg-zinc-950 border border-white/5 overflow-hidden">
                  <img
                    src={talent.avatar_url || "/placeholder.svg"}
                    className="w-full h-full object-cover opacity-60"
                    alt=""
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-95" />
                  <div className="absolute bottom-10 left-10">
                    <p className="font-display text-4xl text-white uppercase tracking-tighter italic">
                      {talent.display_name}
                    </p>
                    <span className="text-[8px] font-black text-neon-blue uppercase tracking-widest italic opacity-40">
                      Uplink Session
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* FEED SLIDES (Snap Center logic for Universal Sync) */}
        {combinedFeed.map((item, idx) => (
          <div
            key={`${item.type}-${idx}`}
            onClick={() => navigate(item.type === "venue" ? `/venue/${item.data.id}` : `/talent/${item.data.user_id}`)}
            className="min-h-[78dvh] w-full snap-center relative flex flex-col justify-end overflow-hidden mb-20"
            style={{ scrollSnapStop: "always" }}
          >
            <img
              src={(item.type === "venue" ? item.data.image_url : item.data.media_url) || "/placeholder.svg"}
              className="absolute inset-0 w-full h-full object-cover"
              alt=""
            />

            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/10 to-transparent opacity-95" />

            <div className="relative p-10 pb-28 z-10 max-w-4xl">
              <div className="flex items-center gap-3 mb-6">
                <Badge className="bg-neon-blue text-white border-none text-[9px] font-black uppercase tracking-[0.2em] px-5 py-2 rounded-full flex items-center gap-2 shadow-[0_0_15px_rgba(0,229,255,0.4)]">
                  <MapPin className="w-3 h-3" />
                  {item.type === "venue" ? item.data.location || "Sector Alpha" : "Transmission"}
                </Badge>

                <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md px-4 py-2 rounded-full border border-white/10">
                  <div className="w-1.5 h-1.5 bg-neon-green rounded-full animate-pulse shadow-[0_0_8px_#39FF14]" />
                  <span className="text-[8px] font-black text-white uppercase tracking-widest mr-2">Live</span>
                  <button
                    onClick={(e) => toggleFollow(item.data.id, e)}
                    className="w-6 h-6 flex items-center justify-center bg-white text-black rounded-full shadow-lg"
                  >
                    {followedNodes.has(item.data.id) ? <Minus className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                  </button>
                </div>
              </div>

              <h3 className="font-display text-[clamp(2.5rem,11.5vw,6rem)] text-white uppercase italic tracking-tighter leading-[0.8] pr-6 line-clamp-3">
                {item.type === "venue" ? item.data.name : item.data.profiles?.display_name}
              </h3>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Discovery;
