import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { MapPin, Search, Target, Radio, Zap, UserPlus } from "lucide-react";
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
  const [initialLoad, setInitialLoad] = useState(true); // Prevents the Blink
  const [activeCategory, setActiveCategory] = useState("All Vibes");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const fetchDiscoveryData = async () => {
      // If it's not the first time, we don't trigger the hard loading screen
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

  // ✅ Only "Hard Blink" on the very first visit
  if (initialLoad || contextLoading) return <LoadingState />;

  return (
    <div className="h-screen bg-black overflow-hidden flex flex-col">
      {/* 🛠 FIXED HUD HEADER & FILTERS */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-b from-black/90 to-transparent pt-4 pb-12 px-8">
        <div className="flex justify-between items-center h-20 mb-4">
          <div className="flex items-center gap-3">
            <Target className="w-4 h-4 text-neon-blue" />
            <h1 className="font-display text-2xl text-white uppercase tracking-wider italic pt-1">Discovery</h1>
          </div>
          <ActivitySidebar />
        </div>

        {/* SEARCH & FILTERS (Floating over content) */}
        <div className="space-y-4 max-w-2xl mx-auto">
          <div className="relative">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-3 w-3 text-white/40" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="SEARCH SECTOR..."
              className="w-full bg-white/10 backdrop-blur-md border border-white/5 pl-12 h-12 rounded-xl text-[9px] font-black tracking-[0.2em] uppercase text-white placeholder:text-white/20 focus:outline-none focus:border-neon-blue/40"
            />
          </div>

          <div className="flex overflow-x-auto gap-2 hide-scrollbar">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.name}
                onClick={() => setActiveCategory(cat.name)}
                className={cn(
                  "whitespace-nowrap px-3 py-1.5 rounded-full text-[7px] font-black uppercase tracking-widest transition-all border",
                  activeCategory === cat.name
                    ? `${cat.color} ${cat.border} scale-105`
                    : "bg-black/40 text-white/40 border-white/5",
                )}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 📱 SNAP-SCROLL FEED (Full Screen TikTok Style) */}
      <div className="flex-1 overflow-y-scroll snap-y snap-mandatory hide-scrollbar">
        {combinedFeed.map((item, idx) => (
          <div
            key={`${item.type}-${idx}`}
            onClick={() => navigate(item.type === "venue" ? `/venue/${item.data.id}` : `/talent/${item.data.user_id}`)}
            className="h-screen w-full snap-start relative flex flex-col justify-end overflow-hidden"
          >
            {/* Background Image */}
            <img
              src={(item.type === "venue" ? item.data.image_url : item.data.media_url) || "/placeholder.svg"}
              className="absolute inset-0 w-full h-full object-cover"
              alt=""
            />

            {/* THE NEURAL SCRIM (Ensures Legibility) */}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-90" />

            {/* INTERACTION OVERLAY (Follow Icon) */}
            <div className="absolute top-1/2 right-6 -translate-y-1/2 z-20 flex flex-col gap-8 items-center">
              <button className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md border border-white/10 flex items-center justify-center hover:bg-neon-blue transition-all group">
                <UserPlus className="w-5 h-5 text-white group-active:scale-90 transition-transform" />
              </button>
              <div className="flex flex-col items-center gap-1">
                <div className="w-1 h-1 bg-neon-green rounded-full animate-pulse shadow-[0_0_8px_#39FF14]" />
                <span className="text-[7px] font-black text-white/40 uppercase tracking-widest">Live</span>
              </div>
            </div>

            {/* CONTENT OVERLAY */}
            <div className="relative p-10 pb-32 z-10 max-w-4xl">
              <Badge className="bg-neon-blue text-white border-none text-[8px] font-black uppercase tracking-[0.2em] px-4 py-1.5 rounded-full mb-4 inline-flex items-center shadow-lg">
                <MapPin className="w-3 h-3 mr-2" />
                {item.type === "venue" ? item.data.location || "Sector Alpha" : "Live Transmission"}
              </Badge>

              {/* Word Safe Title (Max 3 lines, No word splitting) */}
              <h3 className="font-display text-[clamp(2.5rem,10vw,5.5rem)] text-white uppercase italic tracking-tighter leading-[0.8] whitespace-normal break-normal hyphens-none line-clamp-3 mb-2">
                {item.type === "venue" ? item.data.name : item.data.profiles?.display_name}
              </h3>

              {item.type === "talent" && (
                <p className="text-[10px] text-neon-purple font-black uppercase tracking-[0.3em] flex items-center gap-2">
                  <Zap className="w-3 h-3 fill-neon-purple" /> Dynamic Intelligence
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
