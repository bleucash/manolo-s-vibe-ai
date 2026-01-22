import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin, Search, Sparkles, ArrowRight, Video, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Venue, PostWithVenue } from "@/types/database";

const CATEGORIES = [
  { name: "All Vibes", color: "border-white/20 text-white" },
  { name: "Nightclubs", color: "border-neon-blue text-neon-blue" },
  { name: "Lounges", color: "border-neon-cyan text-neon-cyan" },
  { name: "Hookah", color: "border-neon-purple text-neon-purple" },
  { name: "Strip Clubs", color: "border-neon-pink text-neon-pink" },
  { name: "LGBQT+", color: "border-neon-green text-neon-green" },
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
      // 1. Fetch Venues with Category Filter
      let venueQuery = supabase.from("venues").select("*");
      if (activeCategory !== "All Vibes") {
        venueQuery = venueQuery.ilike("category", `%${activeCategory}%`);
      }
      const { data: vData } = await venueQuery;
      if (vData) setVenues(vData as Venue[]);

      // 2. Fetch Spotlight Talent (Monetization Carousel)
      const { data: tData } = await supabase
        .from("profiles")
        .select("id, display_name, username, avatar_url, sub_role")
        .eq("role_type", "talent")
        .limit(8);
      if (tData) setFeaturedTalent(tData);

      // 3. Fetch Global Talent Vibe Feed
      const { data: pData } = await supabase
        .from("posts")
        .select(`*, profiles:user_id (display_name, username, avatar_url)`)
        .not("media_url", "is", null)
        .limit(10);
      if (pData) setTalentPosts(pData as any);
    } catch (err) {
      console.error("Neural Sync Error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black pb-32 animate-in fade-in duration-700">
      {/* STICKY HEADER: What's The VIBE */}
      <div className="sticky top-0 z-50 bg-black/95 backdrop-blur-xl pt-12 pb-4 px-6 border-b border-white/5">
        <div className="flex justify-between items-start mb-6">
          <h1 className="text-5xl md:text-7xl font-display text-white uppercase tracking-tighter leading-[0.8] italic">
            What's <br />{" "}
            <span className="text-neon-pink flex items-center gap-4">
              The VIBE
              <div className="w-3 h-3 bg-neon-pink rounded-full animate-ping mt-2 shadow-[0_0_15px_#FF007F]" />
            </span>
          </h1>
        </div>

        {/* NEURAL SEARCH */}
        <div className="relative group mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 group-focus-within:text-white transition-colors" />
          <input
            type="text"
            placeholder="SEARCH THE NETWORK..."
            className="w-full bg-zinc-900/60 border border-white/10 rounded-xl py-4 pl-12 pr-4 text-[10px] text-white focus:outline-none focus:border-white/30 transition-all font-black uppercase tracking-[0.2em]"
          />
        </div>

        {/* MULTI-CHROME PILLS */}
        <div className="flex overflow-x-auto gap-3 no-scrollbar pb-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.name}
              onClick={() => setActiveCategory(cat.name)}
              className={`whitespace-nowrap px-6 py-2 rounded-full text-[9px] font-black uppercase tracking-widest transition-all border ${
                activeCategory === cat.name ? "bg-white text-black border-white" : `${cat.color} bg-black/40`
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* SECTION 1: TALENT SPOTLIGHT */}
      <div className="mt-10 mb-16">
        <div className="px-6 flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <h2 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em]">Talent Spotlight</h2>
          </div>
          <button
            onClick={() => navigate("/talent-directory")}
            className="text-[9px] font-black text-neon-blue uppercase tracking-widest flex items-center gap-1 group"
          >
            Directory <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-all" />
          </button>
        </div>
        <div className="flex overflow-x-auto gap-4 px-6 no-scrollbar snap-x">
          {loading
            ? [1, 2, 3].map((i) => <Skeleton key={i} className="h-80 w-64 shrink-0 rounded-[2.5rem] bg-zinc-900" />)
            : featuredTalent.map((talent) => (
                <div
                  key={talent.id}
                  onClick={() => navigate(`/talent/${talent.id}`)}
                  className="relative h-80 w-64 shrink-0 rounded-[2.5rem] overflow-hidden snap-center border border-white/5 bg-zinc-900 transition-transform active:scale-95"
                >
                  <img
                    src={talent.avatar_url || ""}
                    className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-700"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
                  <div className="absolute bottom-6 left-6 right-6">
                    <h3 className="text-2xl font-display text-white uppercase tracking-tighter leading-none mb-1">
                      {talent.display_name}
                    </h3>
                    <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest">{talent.sub_role}</p>
                  </div>
                </div>
              ))}
        </div>
      </div>

      {/* SECTION 2: VENUE INTELLIGENCE */}
      <div className="px-6 space-y-12">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-neon-pink" />
          <h2 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em]">Intelligence Peak</h2>
        </div>
        {loading
          ? [1, 2].map((i) => <Skeleton key={i} className="h-[28rem] w-full rounded-[3.5rem] bg-zinc-900" />)
          : venues.map((venue) => (
              <div
                key={venue.id}
                onClick={() => navigate(`/venue/${venue.id}`)}
                className="relative h-[28rem] w-full rounded-[3.5rem] overflow-hidden border border-white/10 group shadow-2xl"
              >
                <img
                  src={venue.image_url || "/placeholder.svg"}
                  className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />
                <div className="absolute top-8 right-8 bg-black/60 backdrop-blur-xl border border-white/10 px-5 py-2 rounded-full flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-neon-green rounded-full shadow-[0_0_8px_#39FF14]" />
                  <span className="text-[8px] font-black text-white uppercase tracking-widest font-display italic">
                    Sizzling
                  </span>
                </div>
                <div className="absolute bottom-12 left-10 right-10">
                  <div className="space-y-4">
                    <h3 className="text-[12vw] md:text-7xl font-display text-white uppercase tracking-tighter leading-[0.8] italic drop-shadow-2xl">
                      {venue.name}
                    </h3>
                    <div className="flex items-center gap-4">
                      <span className="text-[10px] text-zinc-400 font-black uppercase tracking-[0.2em]">
                        {venue.location}
                      </span>
                      <Badge className="bg-white/5 border-white/10 text-white text-[7px] font-black tracking-widest uppercase">
                        {venue.category}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            ))}
      </div>

      {/* SECTION 3: GLOBAL TALENT VIBE GRID */}
      <div className="mt-20 px-6 pb-20">
        <div className="flex items-center gap-2 mb-8">
          <Video className="w-4 h-4 text-neon-blue" />
          <h2 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em]">Recent Vibe Collisions</h2>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {talentPosts.map((post) => (
            <div
              key={post.id}
              onClick={() => navigate(`/talent/${post.user_id}`)}
              className="relative aspect-[3/4] rounded-3xl overflow-hidden border border-white/5 group bg-zinc-900 active:scale-95 transition-all"
            >
              <img
                src={post.media_url || ""}
                className="w-full h-full object-cover transition-opacity group-hover:opacity-60"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
              <div className="absolute bottom-4 left-4 right-4">
                <p className="text-[10px] font-black text-white uppercase tracking-tighter truncate leading-none mb-1">
                  {post.profiles?.display_name}
                </p>
                <p className="text-[8px] text-zinc-500 font-bold uppercase truncate">@{post.profiles?.username}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Discovery;
