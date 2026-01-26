import { useEffect, useState, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { MapPin, Search, Target, Plus, Minus, ArrowRight, X } from "lucide-react";
import { useUserMode } from "@/contexts/UserModeContext";
import { Venue } from "@/types/database";
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
  const { session, isLoading: contextLoading } = useUserMode();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const [venues, setVenues] = useState<Venue[]>([]);
  const [featuredTalent, setFeaturedTalent] = useState<any[]>([]);
  const [talentPosts, setTalentPosts] = useState<any[]>([]);
  const [initialLoad, setInitialLoad] = useState(true);
  const [activeCategory, setActiveCategory] = useState("All Vibes");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set());
  const [expandingRing, setExpandingRing] = useState<string | null>(null);

  // 1. Unified Sync: Tables + Follow States
  useEffect(() => {
    const fetchDiscoveryData = async () => {
      try {
        let venueQuery = supabase.from("venues").select("*");
        if (activeCategory !== "All Vibes") {
          venueQuery = venueQuery.ilike("category", `%${activeCategory}%`);
        }

        const [vRes, tRes, pRes, fRes, vfRes] = await Promise.all([
          venueQuery,
          supabase
            .from("profiles")
            .select("id, display_name, username, avatar_url, venue_id")
            .eq("role_type", "talent")
            .limit(8),
          supabase
            .from("posts")
            .select(`*, profiles:user_id (display_name, username, avatar_url, venue_id)`)
            .not("media_url", "is", null)
            .order("created_at", { ascending: false })
            .limit(20),
          session ? supabase.from("followers").select("following_id").eq("follower_id", session.user.id) : null,
          session ? supabase.from("venue_followers").select("venue_id").eq("follower_id", session.user.id) : null,
        ]);

        if (vRes.data) setVenues(vRes.data as Venue[]);
        if (tRes.data) setFeaturedTalent(tRes.data);
        if (pRes.data) setTalentPosts(pRes.data);

        const follows = new Set<string>();
        fRes?.data?.forEach((f) => follows.add(f.following_id));
        vfRes?.data?.forEach((vf) => follows.add(vf.venue_id));
        setFollowedIds(follows);
      } catch (err) {
        console.error("Discovery Sync Error", err);
      } finally {
        setInitialLoad(false);
      }
    };
    fetchDiscoveryData();
  }, [activeCategory, session]);

  // 2. High-End Scroll Restoration
  useEffect(() => {
    const savedPos = sessionStorage.getItem("discovery_scroll_pos");
    if (savedPos && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = parseInt(savedPos);
    }
    return () => {
      if (scrollContainerRef.current) {
        sessionStorage.setItem("discovery_scroll_pos", scrollContainerRef.current.scrollTop.toString());
      }
    };
  }, []);

  // 3. Follow/Charge Hybrid Interaction
  const handleInteraction = async (id: string, type: "venue" | "talent", e: React.MouseEvent) => {
    e.stopPropagation();
    if (!session) return navigate("/auth");

    setExpandingRing(id);
    setTimeout(() => setExpandingRing(null), 600);

    const isCurrentlyFollowing = followedIds.has(id);
    const table = type === "venue" ? "venue_followers" : "followers";
    const column = type === "venue" ? "venue_id" : "following_id";

    try {
      if (isCurrentlyFollowing) {
        await supabase.from(table).delete().eq("follower_id", session.user.id).eq(column, id);
        setFollowedIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      } else {
        await Promise.all([
          supabase.from(table).insert({ follower_id: session.user.id, [column]: id }),
          supabase.from("interactions").insert({
            user_id: session.user.id,
            target_id: id,
            target_type: type,
            interaction_type: "charge",
          }),
        ]);
        setFollowedIds((prev) => new Set(prev).add(id));
        toast.success("Neural Link Established");
      }
    } catch (err) {
      toast.error("Handshake Failed");
    }
  };

  // 4. 4:1 Ratio & Live-Priority Logic
  const combinedFeed = useMemo(() => {
    const filtered = (venues || []).filter((v) => v.name.toLowerCase().includes(searchQuery.toLowerCase()));
    const feed = [];
    let talentPtr = 0;
    const liveTalent = talentPosts.filter((p) => p.profiles?.venue_id !== null);
    const staticTalent = talentPosts.filter((p) => p.profiles?.venue_id === null);

    for (let i = 0; i < filtered.length; i++) {
      feed.push({ type: "venue", data: filtered[i] });
      if ((i + 1) % 4 === 0) {
        const talentToInject = liveTalent[talentPtr] || staticTalent[talentPtr];
        if (talentToInject) {
          feed.push({ type: "talent", data: talentToInject });
          talentPtr++;
        }
      }
    }
    return feed;
  }, [venues, searchQuery, talentPosts]);

  if (initialLoad || contextLoading) return <LoadingState />;

  return (
    <div className="h-screen bg-black overflow-hidden flex flex-col font-body relative">
      {isSearchOpen && (
        <div className="absolute inset-0 z-[300] bg-black/95 backdrop-blur-2xl p-8 pt-24 animate-in slide-in-from-top-full duration-500">
          <button
            onClick={() => setIsSearchOpen(false)}
            className="absolute top-8 right-8 text-white/40 hover:text-white"
          >
            <X className="w-8 h-8" />
          </button>
          <div className="max-w-xl mx-auto">
            <h2 className="text-white font-display text-5xl italic uppercase mb-12 tracking-tighter">Search Sector</h2>
            <div className="relative border-b-2 border-neon-blue shadow-[0_4px_20px_rgba(0,183,255,0.2)]">
              <Search className="absolute left-0 top-1/2 -translate-y-1/2 w-6 h-6 text-neon-blue" />
              <input
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Enter Sector Name..."
                className="w-full bg-transparent py-8 pl-12 text-2xl font-bold uppercase tracking-widest text-white focus:outline-none placeholder:text-white/10"
              />
            </div>
          </div>
        </div>
      )}

      {/* SLIM HUD - Activity/Bell Stripped */}
      <div className="fixed top-0 left-0 right-0 z-[150] bg-black/40 backdrop-blur-md pt-4 pb-2 border-b border-white/5">
        <div className="px-8 flex justify-between items-center h-16">
          <div className="flex items-center gap-3">
            <Target className="w-4 h-4 text-neon-blue animate-pulse" />
            <h1 className="font-display text-2xl text-white uppercase tracking-wider italic pt-1 leading-none">
              Discovery
            </h1>
          </div>
          <button
            onClick={() => setIsSearchOpen(true)}
            className="w-10 h-10 flex items-center justify-center bg-white/5 rounded-full border border-white/5"
          >
            <Search className="w-5 h-5 text-white/40" />
          </button>
        </div>

        <div className="flex overflow-x-auto gap-3 hide-scrollbar px-8 overflow-visible relative z-[160] py-[10px]">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.name}
              onClick={() => setActiveCategory(cat.name)}
              className={cn(
                "whitespace-nowrap px-5 rounded-full text-[9px] font-black uppercase tracking-[0.15em] transition-all duration-300 border py-[7px]",
                activeCategory === cat.name
                  ? `${cat.color} ${cat.text} border-transparent scale-105`
                  : "bg-zinc-900/50 text-white/30 border-white/5",
              )}
              style={{ boxShadow: activeCategory === cat.name ? `0 0 30px ${cat.glow}80` : "none" }}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-scroll snap-y snap-mandatory hide-scrollbar"
        style={{ scrollSnapType: "y mandatory", WebkitOverflowScrolling: "touch" }}
      >
        <div className="h-[11rem] w-full shrink-0 snap-start pointer-events-none" />

        {/* SPOTLIGHT SECTION with Talent Directory Portal */}
        <div className="h-[45dvh] w-full snap-start scroll-mt-[11rem] relative flex flex-col justify-center bg-black">
          <div className="flex overflow-x-auto gap-5 px-6 hide-scrollbar items-center py-[15px]">
            {featuredTalent.map((talent) => (
              <div
                key={talent.id}
                onClick={() => navigate(`/talent/${talent.id}`)}
                className="shrink-0 cursor-pointer group"
              >
                <div className="relative w-[65vw] md:w-64 h-[38dvh] rounded-[2rem] bg-zinc-950 border border-white/5 overflow-hidden shadow-2xl transition-transform duration-500 group-hover:scale-[1.02]">
                  <img
                    src={talent.avatar_url || "/placeholder.svg"}
                    className="w-full h-full object-cover opacity-60"
                    alt=""
                  />
                  <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-transparent to-black opacity-90" />
                  <div className="absolute bottom-6 left-6">
                    <p className="font-display text-2xl text-white uppercase tracking-tighter italic leading-none">
                      {talent.display_name}
                    </p>
                    <span className="text-[9px] font-black text-neon-blue uppercase tracking-widest italic opacity-60 mt-1.5 block">
                      {talent.venue_id ? "Live Now" : "Uplink Profile"}
                    </span>
                  </div>
                </div>
              </div>
            ))}
            <div
              onClick={() => navigate("/talent-directory")}
              className="shrink-0 flex flex-col items-center justify-center w-32 h-[38dvh] rounded-[2rem] border border-white/5 bg-zinc-900/40 cursor-pointer group hover:border-neon-blue transition-all"
            >
              <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-4 group-hover:bg-neon-blue transition-colors">
                <ArrowRight className="w-5 h-5 text-white" />
              </div>
              <span className="text-[9px] font-black text-white/40 uppercase tracking-[0.15em]">Full Sector</span>
            </div>
          </div>
        </div>

        {/* CINEMATIC SNAP STREAM */}
        {combinedFeed.map((item, idx) => (
          <div
            key={`${item.type}-${idx}`}
            onClick={() => navigate(item.type === "venue" ? `/venue/${item.data.id}` : `/talent/${item.data.user_id}`)}
            className="h-[65dvh] w-full snap-start scroll-mt-[11rem] relative flex flex-col justify-end overflow-hidden mb-4 border-b border-white/5"
            style={{ scrollSnapStop: "always" }}
          >
            <img
              src={(item.type === "venue" ? item.data.image_url : item.data.media_url) || "/placeholder.svg"}
              className="absolute inset-0 w-full h-full object-cover"
              alt=""
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/90 via-transparent to-black" />
            <div className="relative p-10 pb-12 z-10 max-w-4xl">
              <div className="flex items-center gap-3 mb-6">
                <Badge className="bg-neon-blue text-white border-none text-[10px] font-black uppercase tracking-[0.2em] px-6 py-2.5 rounded-full flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5" />
                  {item.type === "venue" ? item.data.location || "Sector Alpha" : "Transmission"}
                </Badge>
                <div className="flex items-center gap-2 bg-black/60 backdrop-blur-xl px-4 rounded-full border border-white/10 relative py-[3px]">
                  {(item.type === "venue" || item.data.profiles?.venue_id) && (
                    <>
                      <div className="w-2 h-2 bg-neon-green rounded-full animate-pulse shadow-[0_0_10px_#39FF14]" />
                      <span className="text-[9px] font-black text-white uppercase tracking-[0.2em] mr-2">Live</span>
                    </>
                  )}
                  <button
                    onClick={(e) =>
                      handleInteraction(
                        item.data.id || item.data.user_id,
                        item.type === "venue" ? "venue" : "talent",
                        e,
                      )
                    }
                    className={cn(
                      "relative w-7 h-7 flex items-center justify-center rounded-full transition-transform active:scale-90",
                      followedIds.has(item.data.id || item.data.user_id)
                        ? "bg-neon-blue text-white shadow-[0_0_15px_#00B7FF]"
                        : "bg-white text-black",
                    )}
                  >
                    {followedIds.has(item.data.id || item.data.user_id) ? (
                      <Minus className="w-4 h-4" />
                    ) : (
                      <Plus className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
              <h3 className="font-display text-[clamp(2.5rem,11.5vw,5.5rem)] text-white uppercase italic tracking-tighter leading-[0.8] pr-12 whitespace-normal break-normal text-glow-white">
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
