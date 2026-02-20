import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Sparkles, ArrowRight, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useUserMode } from "@/contexts/UserModeContext";
import { Venue } from "@/types/database";

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
  const { isLoading: contextLoading } = useUserMode(); // ✅ Check context state

  const [venues, setVenues] = useState<Venue[]>([]);
  const [featuredTalent, setFeaturedTalent] = useState<any[]>([]);
  const [talentPosts, setTalentPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("All Vibes");

  useEffect(() => {
    fetchDiscoveryData();
  }, [activeCategory]);

  const fetchDiscoveryData = async () => {
    setLoading(true);
    try {
      // 1. Venues: active first, then inactive; with optional category filter
      let venueQuery = supabase
        .from("venues")
        .select("*")
        .order("is_active", { ascending: false });

      if (activeCategory !== "All Vibes") {
        venueQuery = venueQuery.ilike("category", `%${activeCategory}%`);
      }

      // 2. Top 3 charged talent via RPC spotlight function
      // 3. Feed talent profiles: venue_id NOT NULL first, then others
      const [vRes, spotlightRes, feedTalentRes] = await Promise.all([
        venueQuery,
        supabase.rpc("get_talent_spotlight", { limit_count: 3 }),
        supabase
          .from("profiles")
          .select("id, display_name, username, avatar_url, hero_reel_url, venue_id, sub_role")
          .eq("role_type", "talent")
          .order("venue_id", { ascending: false, nullsFirst: false })
          .limit(12),
      ]);

      if (vRes.data) setVenues(vRes.data as Venue[]);
      if (spotlightRes.data) setFeaturedTalent(spotlightRes.data);
      if (feedTalentRes.data) setTalentPosts(feedTalentRes.data);
    } catch (err) {
      console.error("Discovery Sync Error", err);
    } finally {
      setLoading(false);
    }
  };

  const combinedFeed = [];
  let talentIndex = 0;
  for (let i = 0; i < (venues?.length || 0); i++) {
    combinedFeed.push({ type: "venue", data: venues[i] });
    if ((i + 1) % 4 === 0 && talentPosts[talentIndex]) {
      combinedFeed.push({ type: "talent", data: talentPosts[talentIndex] });
      talentIndex++;
    }
  }

  return (
    <div className="min-h-screen bg-black pb-32 animate-in fade-in duration-700 overflow-y-auto no-scrollbar">
      {/* HEADER */}
      <div className="sticky top-0 z-50 bg-black/95 backdrop-blur-xl pt-16 pb-6 px-6 border-b border-white/5">
        <h1 className="text-5xl md:text-7xl font-display text-white uppercase tracking-tighter leading-[0.8] italic mb-8">
          What's <br />{" "}
          <span className="text-neon-pink flex items-center gap-4">
            The VIBES <div className="w-3 h-3 bg-neon-pink rounded-full animate-ping mt-2" />
          </span>
        </h1>

        <div className="relative group mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 group-focus-within:text-white transition-colors" />
          <input
            type="text"
            placeholder="SEARCH..."
            className="w-full bg-zinc-900/60 border border-white/10 rounded-xl py-4 pl-12 pr-4 text-[10px] text-white focus:outline-none font-black uppercase tracking-[0.2em]"
          />
        </div>

        <div className="flex overflow-x-auto gap-2 no-scrollbar py-1">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.name}
              onClick={() => setActiveCategory(cat.name)}
              className={`whitespace-nowrap px-4 py-1.5 rounded-full text-[8px] font-black uppercase tracking-widest transition-all border ${activeCategory === cat.name ? cat.color : "bg-transparent text-zinc-600 border-white/5"}`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* TALENT SPOTLIGHT */}
      <div className="mt-12 mb-16">
        <div className="px-6 flex items-center justify-between mb-8">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <h2 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em]">Featured Talent</h2>
          </div>
          <button
            onClick={() => navigate("/talent-directory")}
            className="text-[9px] font-black text-neon-blue uppercase tracking-widest flex items-center gap-1"
          >
            Directory <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        <div className="flex overflow-x-auto gap-6 px-6 no-scrollbar snap-x">
          {loading
            ? [1, 2, 3].map((i) => <Skeleton key={i} className="h-80 w-64 shrink-0 rounded-[2.5rem] bg-zinc-900" />)
          : featuredTalent.map((talent) => (
                <div
                  key={talent.talent_id}
                  onClick={() => navigate(`/talent/${talent.talent_id}`)}
                  className="group relative h-80 w-64 shrink-0 rounded-[2.5rem] overflow-hidden snap-center border border-white/5 bg-zinc-900"
                >
                  <img
                    src={talent.avatar_url || ""}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
                  <div className="absolute bottom-8 left-8">
                    <h3 className="text-3xl font-display text-white uppercase tracking-tighter leading-none mb-1">
                      {talent.display_name}
                    </h3>
                    <p className="text-[9px] text-zinc-400 font-black uppercase tracking-widest">{talent.sub_role || "Talent"}</p>
                  </div>
                </div>
              ))}
        </div>
      </div>

      {/* INTEGRATED FEED */}
      <div className="px-6 space-y-16">
        {loading ? (
          <Skeleton className="h-[28rem] w-full rounded-[3.5rem] bg-zinc-900" />
        ) : (
          combinedFeed.map((item, idx) =>
            item.type === "venue" ? (
              <div
                key={`v-${idx}`}
                onClick={() => navigate(`/venue/${item.data.id}`)}
                className="relative h-[30rem] w-full rounded-[3.5rem] overflow-hidden border border-white/10 group shadow-2xl bg-zinc-900"
              >
                <img
                  src={item.data.image_url || "/placeholder.svg"}
                  className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
                <div className="absolute bottom-12 left-10 right-10">
                  <h3 className="text-[clamp(2.5rem,10vw,5rem)] font-display text-white uppercase tracking-tighter leading-[0.9] italic line-clamp-2">
                    {item.data.name}
                  </h3>
                  <div className="flex items-center gap-4 mt-4">
                    <p className="text-[10px] text-zinc-400 font-black uppercase tracking-[0.2em]">
                      {item.data.location}
                    </p>
                    <Badge className="bg-white/5 border-white/10 text-white text-[7px] font-black uppercase px-3 py-1">
                      {item.data.category}
                    </Badge>
                  </div>
                </div>
              </div>
            ) : (
              <div
                key={`t-${idx}`}
                onClick={() => navigate(`/talent/${item.data.id}`)}
                className="relative h-96 w-full rounded-[3rem] overflow-hidden border border-neon-purple/20 bg-zinc-900 shadow-2xl"
              >
                <img
                  src={item.data.hero_reel_url || item.data.avatar_url || "/placeholder.svg"}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                <div className="absolute bottom-10 left-10">
                  <h4 className="text-5xl font-display text-white uppercase italic leading-none tracking-tighter">
                    {item.data.display_name}
                  </h4>
                  <p className="text-[9px] text-neon-purple font-black uppercase tracking-widest mt-3 flex items-center gap-2">
                    <Zap className="w-3 h-3 fill-neon-purple animate-pulse" /> {item.data.sub_role || "Talent"}
                  </p>
                </div>
              </div>
            ),
          )
        )}
      </div>
    </div>
  );
};

export default Discovery;
