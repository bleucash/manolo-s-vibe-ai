import { useEffect, useState, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { MapPin, Search, Target, Plus, Minus, ArrowRight, X } from "lucide-react";
import { useUserMode } from "@/contexts/UserModeContext";
import { Venue } from "@/types/database";
import { ActivitySidebar } from "@/components/ActivitySidebar";
import LoadingState from "@/components/ui/LoadingState";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

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
  const { isLoading: contextLoading, session } = useUserMode();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const [venues, setVenues] = useState<Venue[]>([]);
  const [featuredTalent, setFeaturedTalent] = useState<any[]>([]);
  const [talentPosts, setTalentPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialLoad, setInitialLoad] = useState(true);
  const [activeCategory, setActiveCategory] = useState("All Vibes");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [followedTalent, setFollowedTalent] = useState<Set<string>>(new Set());
  const [expandingRing, setExpandingRing] = useState<string | null>(null);

  const currentUserId = session?.user?.id || null;

  // ✅ FETCH: Load Discovery Data + User's Existing Follows
  useEffect(() => {
    const fetchDiscoveryData = async () => {
      try {
        let venueQuery = supabase.from("venues").select("*");
        if (activeCategory !== "All Vibes") {
          venueQuery = venueQuery.ilike("category", `%${activeCategory}%`);
        }

        const queries = [
          venueQuery,
          supabase.from("profiles").select("id, display_name, username, avatar_url").eq("role_type", "talent").limit(8),
          supabase
            .from("posts")
            .select(`*, profiles:user_id (display_name, username, avatar_url)`)
            .not("media_url", "is", null)
            .limit(10),
        ];

        // ✅ If logged in, also fetch their existing follows
        if (currentUserId) {
          queries.push(supabase.from("followers").select("following_id").eq("follower_id", currentUserId));
        }

        const [vRes, tRes, pRes, fRes] = await Promise.all(queries);

        if (vRes.data) setVenues(vRes.data as Venue[]);
        if (tRes.data) setFeaturedTalent(tRes.data);
        if (pRes.data) setTalentPosts(pRes.data);

        // ✅ Hydrate followed talent from database
        if (fRes?.data) {
          const followedIds = fRes.data.map((f: any) => f.following_id);
          setFollowedTalent(new Set(followedIds));
        }
      } catch (err) {
        console.error("Discovery Sync Error", err);
      } finally {
        setLoading(false);
        setInitialLoad(false);
      }
    };

    fetchDiscoveryData();
  }, [activeCategory, currentUserId]);

  // ✅ SCROLL TO TOP: When category changes, reset scroll position
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: "auto" });
    }
  }, [activeCategory]);

  // ✅ FOLLOW/UNFOLLOW: Integrated with Supabase followers table
  const handleFollowTalent = async (talentId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    // 🔒 Auth Check
    if (!currentUserId) {
      toast.error("Sign in Required");
      navigate("/auth");
      return;
    }

    // 🎯 Prevent self-follow
    if (talentId === currentUserId) {
      toast.error("Cannot Follow Yourself");
      return;
    }

    const isFollowing = followedTalent.has(talentId);

    // ✨ Optimistic UI Update
    setExpandingRing(talentId);
    setTimeout(() => setExpandingRing(null), 600);

    setFollowedTalent((prev) => {
      const next = new Set(prev);
      if (isFollowing) next.delete(talentId);
      else next.add(talentId);
      return next;
    });

    // 🔄 Database Sync
    try {
      if (isFollowing) {
        const { error } = await supabase
          .from("followers")
          .delete()
          .eq("follower_id", currentUserId)
          .eq("following_id", talentId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("followers")
          .insert({ follower_id: currentUserId, following_id: talentId });

        if (error) throw error;
      }
    } catch (err) {
      console.error("Follow Sync Error:", err);
      toast.error("Connection Failed");

      // ❌ Rollback optimistic update on error
      setFollowedTalent((prev) => {
        const next = new Set(prev);
        if (isFollowing) next.add(talentId);
        else next.delete(talentId);
        return next;
      });
    }
  };

  // 🔍 COMBINED FEED: Venues + Talent Posts with Search Filter
  const combinedFeed = useMemo(() => {
    const filtered = (venues || []).filter(
      (v) =>
        v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.location?.toLowerCase().includes(searchQuery.toLowerCase()),
    );

    const feed: Array<{ type: "venue" | "talent"; data: any }> = [];
    let postIndex = 0;

    for (let i = 0; i < filtered.length; i++) {
      feed.push({ type: "venue", data: filtered[i] });
      // ✅ Inject talent posts every 2 venues (instead of 4)
      if ((i + 1) % 2 === 0 && talentPosts[postIndex]) {
        feed.push({ type: "talent", data: talentPosts[postIndex] });
        postIndex++;
      }
    }
    return feed;
  }, [venues, searchQuery, talentPosts]);

  if (initialLoad || contextLoading) return <LoadingState />;

  return (
    <div className="h-screen bg-black overflow-hidden flex flex-col font-body relative">
      {/* 🔍 SEARCH MODAL OVERLAY */}
      {isSearchOpen && (
        <div className="absolute inset-0 z-[200] bg-black/95 backdrop-blur-xl p-8 flex flex-col pt-24 animate-in fade-in slide-in-from-top-4 duration-300">
          <button
            onClick={() => setIsSearchOpen(false)}
            className="absolute top-8 right-8 text-white/40 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
          <h2 className="text-white font-display text-4xl italic uppercase mb-8 tracking-tighter">Search Sector</h2>
          <div className="relative">
            <Search className="absolute left-0 top-1/2 -translate-y-1/2 w-6 h-6 text-neon-blue" />
            <input
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ENTER VENUE OR LOCATION..."
              className="w-full bg-transparent border-b border-white/10 py-6 pl-10 text-xl font-bold uppercase tracking-widest text-white focus:outline-none focus:border-neon-blue transition-colors"
            />
          </div>

          {/* ✅ SEARCH RESULTS PREVIEW */}
          {searchQuery && (
            <div className="mt-12 space-y-4">
              <p className="text-white/40 text-xs font-black uppercase tracking-widest">
                {combinedFeed.filter((i) => i.type === "venue").length} Venues Found
              </p>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {combinedFeed
                  .filter((i) => i.type === "venue")
                  .slice(0, 5)
                  .map((item, idx) => (
                    <div
                      key={idx}
                      onClick={() => {
                        setIsSearchOpen(false);
                        navigate(`/venue/${item.data.id}`);
                      }}
                      className="flex items-center gap-4 p-4 bg-white/5 rounded-xl cursor-pointer hover:bg-white/10 transition-colors"
                    >
                      <img
                        src={item.data.image_url || "/placeholder.svg"}
                        className="w-16 h-16 rounded-lg object-cover"
                        alt=""
                      />
                      <div>
                        <h3 className="text-white font-bold uppercase tracking-tight">{item.data.name}</h3>
                        <p className="text-white/40 text-xs uppercase tracking-wider">{item.data.location}</p>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 🛠 SLIM HUD HEADER */}
      <div className="fixed top-0 left-0 right-0 z-[150] bg-black pt-4 overflow-visible">
        <div className="px-8 flex justify-between items-center h-16">
          <div className="flex items-center gap-3">
            <Target className="w-4 h-4 text-neon-blue" />
            <h1 className="font-display text-2xl text-white uppercase tracking-wider italic pt-1 leading-none">
              Discovery
            </h1>
          </div>
          <div className="flex items-center gap-6">
            <button onClick={() => setIsSearchOpen(true)} className="text-white/40 hover:text-white transition-colors">
              <Search className="w-5 h-5" />
            </button>
            <ActivitySidebar />
          </div>
        </div>

        {/* CATEGORY PILLS */}
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
                style={{ boxShadow: isActive ? `0 0 25px ${cat.glow}99` : "none" }}
              >
                {cat.name}
              </button>
            );
          })}
        </div>

        {/* GRADIENT FADE */}
        <div className="absolute -bottom-16 left-0 right-0 h-16 bg-gradient-to-b from-black via-black/80 to-transparent pointer-events-none z-[140]" />
      </div>

      {/* 📱 IMMERSIVE SNAP STREAM */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-scroll snap-y snap-mandatory hide-scrollbar pt-[11rem]"
      >
        {/* SLIDE 1: SPOTLIGHT */}
        <div className="min-h-[65dvh] w-full snap-start scroll-mt-[11rem] relative flex flex-col justify-center bg-black pt-4 pb-2">
          <div className="flex overflow-x-auto gap-6 px-8 hide-scrollbar scroll-smooth pb-6 items-center">
            {featuredTalent.map((talent) => (
              <div key={talent.id} onClick={() => navigate(`/talent/${talent.id}`)} className="shrink-0 cursor-pointer">
                <div className="relative w-[75vw] md:w-80 h-[48dvh] rounded-[2.5rem] bg-zinc-950 border border-white/5 overflow-hidden shadow-2xl">
                  <img
                    src={talent.avatar_url || "/placeholder.svg"}
                    className="w-full h-full object-cover opacity-60"
                    alt=""
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-95" />
                  <div className="absolute bottom-10 left-10">
                    <p className="font-display text-4xl text-white uppercase tracking-tighter italic leading-none">
                      {talent.display_name}
                    </p>
                    <span className="text-[9px] font-black text-neon-blue uppercase tracking-widest italic opacity-40 mt-1 block">
                      Uplink Profile
                    </span>
                  </div>
                </div>
              </div>
            ))}
            <div
              onClick={() => navigate("/talent-directory")}
              className="shrink-0 flex flex-col items-center justify-center w-40 h-[48dvh] rounded-[2.5rem] border border-white/5 bg-zinc-950/40 cursor-pointer group hover:border-neon-blue transition-all"
            >
              <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-4 group-hover:bg-neon-blue transition-colors">
                <ArrowRight className="w-5 h-5 text-white" />
              </div>
              <span className="text-[9px] font-black text-white/40 uppercase tracking-[0.2em] group-hover:text-white">
                View Directory
              </span>
            </div>
          </div>
        </div>

        {/* FEED SLIDES */}
        {combinedFeed.length === 0 && !loading ? (
          <div className="min-h-[78dvh] flex flex-col items-center justify-center text-center px-8">
            <Search className="w-16 h-16 text-zinc-900 mb-6" />
            <p className="text-zinc-600 font-black uppercase tracking-[0.3em] text-[10px]">No Venues Found</p>
            <p className="text-zinc-700 text-xs mt-2">Try a different category or search term</p>
          </div>
        ) : (
          combinedFeed.map((item, idx) => {
            const isTalentPost = item.type === "talent";
            const talentId = isTalentPost ? item.data.user_id : null;
            const isFollowing = talentId ? followedTalent.has(talentId) : false;

            return (
              <div
                key={`${item.type}-${idx}`}
                onClick={() => navigate(isTalentPost ? `/talent/${talentId}` : `/venue/${item.data.id}`)}
                className="min-h-[78dvh] w-full snap-start scroll-mt-[11rem] relative flex flex-col justify-end overflow-hidden mb-16 cursor-pointer"
                style={{ scrollSnapStop: "always" }}
              >
                <img
                  src={(isTalentPost ? item.data.media_url : item.data.image_url) || "/placeholder.svg"}
                  className="absolute inset-0 w-full h-full object-cover"
                  alt=""
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/10 to-transparent opacity-95" />

                <div className="relative p-10 pb-12 z-10 max-w-4xl">
                  <div className="flex items-center gap-3 mb-6">
                    <Badge className="bg-neon-blue text-white border-none text-[9px] font-black uppercase tracking-[0.2em] px-5 py-2 rounded-full flex items-center gap-2">
                      <MapPin className="w-3 h-3" />
                      {isTalentPost ? "Transmission" : item.data.location || "Sector Alpha"}
                    </Badge>

                    {/* ✅ FOLLOW BUTTON: Only shows on talent posts */}
                    {isTalentPost && talentId && (
                      <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 relative">
                        <div className="w-1.5 h-1.5 bg-neon-green rounded-full animate-pulse shadow-[0_0_8px_#39FF14]" />
                        <span className="text-[8px] font-black text-white uppercase tracking-widest mr-2">Live</span>

                        <button
                          onClick={(e) => handleFollowTalent(talentId, e)}
                          className="relative w-6 h-6 flex items-center justify-center bg-white text-black rounded-full transition-transform active:scale-95"
                        >
                          {isFollowing ? <Minus className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                          {expandingRing === talentId && (
                            <div className="absolute inset-0 rounded-full border-2 border-white animate-ping opacity-0" />
                          )}
                        </button>
                      </div>
                    )}
                  </div>

                  <h3 className="font-display text-[clamp(2.5rem,11.5vw,6rem)] text-white uppercase italic tracking-tighter leading-[0.8] pr-10 whitespace-normal break-normal line-clamp-3">
                    {isTalentPost ? item.data.profiles?.display_name : item.data.name}
                  </h3>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default Discovery;
