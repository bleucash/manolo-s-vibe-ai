import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin, Search, Sparkles, ArrowRight, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Venue, PostWithVenue } from "@/types/database";

const CATEGORIES = [
  { name: "All Vibes", color: "bg-white text-black", border: "border-white" },
  { name: "Nightclubs", color: "bg-neon-blue text-black shadow-[0_0_15px_#00B7FF]", border: "border-neon-blue" },
  { name: "Bars", color: "bg-neon-cyan text-black shadow-[0_0_15px_#00FFFF]", border: "border-neon-cyan" },
  { name: "Live Music", color: "bg-neon-green text-black shadow-[0_0_15px_#39FF14]", border: "border-neon-green" },
  { name: "Lounges", color: "bg-neon-cyan text-black border-neon-cyan", border: "border-neon-cyan" },
  { name: "Hookah", color: "bg-neon-purple text-white shadow-[0_0_15px_#BF00FF]", border: "border-neon-purple" },
  { name: "Strip Clubs", color: "bg-neon-pink text-white shadow-[0_0_15px_#FF007F]", border: "border-neon-pink" },
  { name: "LGBQT+", color: "bg-zinc-100 text-black", border: "border-white" },
];

const Discovery = () => {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [featuredTalent, setFeaturedTalent] = useState<any[]>([]);
  const [talentPosts, setTalentPosts] = useState<PostWithVenue[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("All Vibes");
  const navigate = useNavigate();

  useEffect(() => {
    fetchDiscoveryData();
  }, [activeCategory]);

  const fetchDiscoveryData = async () => {
    setLoading(true);
    try {
      const { data: vData } = await supabase
        .from("venues")
        .select("*")
        .ilike("category", activeCategory === "All Vibes" ? "%%" : `%${activeCategory}%`);

      const { data: tData } = await supabase.from("profiles").select("*").eq("role_type", "talent").limit(10);
      const { data: pData } = await supabase.from("posts").select(`*, profiles:user_id (*)`).limit(20);

      if (vData) setVenues(vData as Venue[]);
      if (tData) setFeaturedTalent(tData);
      if (pData) setTalentPosts(pData as any);
    } catch (err) {
      console.error("Sync Error");
    } finally {
      setLoading(false);
    }
  };

  // Helper to interleave talent every 4 venues
  const combinedFeed = [];
  let talentIndex = 0;
  for (let i = 0; i < venues.length; i++) {
    combinedFeed.push({ type: "venue", data: venues[i] });
    if ((i + 1) % 4 === 0 && talentPosts[talentIndex]) {
      combinedFeed.push({ type: "talent", data: talentPosts[talentIndex] });
      talentIndex++;
    }
  }

  return (
    <div className="min-h-screen bg-black pb-32 animate-in fade-in duration-700 overflow-y-auto no-scrollbar">
      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      {/* HEADER ZONE */}
      <div className="sticky top-0 z-50 bg-black/95 backdrop-blur-xl pt-12 pb-4 px-6 border-b border-white/5">
        <h1 className="text-5xl md:text-7xl font-display text-white uppercase tracking-tighter leading-[0.8] italic mb-6">
          What's <br />{" "}
          <span className="text-neon-pink flex items-center gap-4">
            The VIBES
            <div className="w-3 h-3 bg-neon-pink rounded-full animate-ping mt-2 shadow-[0_0_15px_#FF007F]" />
          </span>
        </h1>

        <div className="relative group mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 group-focus-within:text-white transition-colors" />
          <input
            type="text"
            placeholder="SEARCH THE NETWORK..."
            className="w-full bg-zinc-900/60 border border-white/10 rounded-xl py-4 pl-12 pr-4 text-[10px] text-white focus:outline-none font-black uppercase tracking-[0.2em]"
          />
        </div>

        {/* SMALLER, COLOR-FILLED PILLS */}
        <div className="flex overflow-x-auto gap-2 no-scrollbar pb-2">
          {CATEGORIES.map((cat) => {
            const isActive = activeCategory === cat.name;
            return (
              <button
                key={cat.name}
                onClick={() => setActiveCategory(cat.name)}
                className={`whitespace-nowrap px-4 py-1.5 rounded-full text-[8px] font-black uppercase tracking-widest transition-all border ${
                  isActive ? cat.color : `bg-transparent text-zinc-500 ${cat.border.replace("neon", "zinc-800")}`
                }`}
              >
                {cat.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* TOP SPOTLIGHT */}
      <div className="mt-8 mb-12">
        <div className="px-6 flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-3 h-3 text-amber-500" />
            <h2 className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Featured Talent</h2>
          </div>
          <ArrowRight className="w-3 h-3 text-zinc-500 cursor-pointer" onClick={() => navigate("/talent-directory")} />
        </div>
        <div className="flex overflow-x-auto gap-4 px-6 no-scrollbar snap-x">
          {featuredTalent.map((t) => (
            <div key={t.id} onClick={() => navigate(`/talent/${t.id}`)} className="w-20 shrink-0 snap-center">
              <div className="aspect-square rounded-full border-2 border-neon-blue p-1 mb-2">
                <img src={t.avatar_url} className="w-full h-full rounded-full object-cover" />
              </div>
              <p className="text-[8px] font-black text-white text-center uppercase truncate">
                {t.display_name?.split(" ")[0]}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* INTEGRATED FEED */}
      <div className="px-6 space-y-12">
        {loading ? (
          <Skeleton className="h-[28rem] w-full rounded-[3.5rem] bg-zinc-900" />
        ) : (
          combinedFeed.map((item, idx) =>
            item.type === "venue" ? (
              <div
                key={`v-${idx}`}
                onClick={() => navigate(`/venue/${item.data.id}`)}
                className="relative h-[28rem] w-full rounded-[3.5rem] overflow-hidden border border-white/10 group"
              >
                <img
                  src={item.data.image_url || "/placeholder.svg"}
                  className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-1000"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
                <div className="absolute top-8 right-8 bg-black/60 backdrop-blur-xl border border-white/10 px-5 py-2 rounded-full flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-neon-green rounded-full shadow-[0_0_8px_#39FF14]" />
                  <span className="text-[8px] font-black text-white uppercase italic tracking-widest">Sizzling</span>
                </div>
                <div className="absolute bottom-12 left-10 right-10">
                  <h3 className="text-[12vw] md:text-7xl font-display text-white uppercase tracking-tighter leading-[0.8] italic drop-shadow-2xl truncate">
                    {item.data.name}
                  </h3>
                  <p className="text-[10px] text-zinc-400 font-black uppercase tracking-[0.2em] mt-2">
                    {item.data.location}
                  </p>
                </div>
              </div>
            ) : (
              <div
                key={`t-${idx}`}
                onClick={() => navigate(`/talent/${item.data.user_id}`)}
                className="relative h-96 w-full rounded-[2.5rem] overflow-hidden border-2 border-neon-purple/30 group bg-zinc-900"
              >
                <img src={item.data.media_url} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-neon-purple/40 via-transparent to-transparent" />
                <div className="absolute bottom-8 left-8 right-8 flex items-end justify-between">
                  <div>
                    <h4 className="text-4xl font-display text-white uppercase italic leading-none">
                      {item.data.profiles?.display_name}
                    </h4>
                    <p className="text-[9px] text-neon-purple font-black uppercase tracking-widest mt-2">
                      Vibe Intelligence Active
                    </p>
                  </div>
                  <Zap className="w-8 h-8 text-white fill-white animate-pulse" />
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
