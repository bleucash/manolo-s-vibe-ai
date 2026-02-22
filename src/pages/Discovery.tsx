import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin, Search, Target, Plus, Minus, ArrowRight, X } from "lucide-react";
import { useUserMode } from "@/contexts/UserModeContext";
import { HeroReel } from "@/components/HeroReel";
import { Venue } from "@/types/database";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const CATEGORIES = [
{ name: "All Vibes", color: "bg-white", text: "text-black", glow: "#FFFFFF" },
{ name: "Nightclubs", color: "bg-[#00B7FF]", text: "text-black", glow: "#00B7FF" },
{ name: "Bars", color: "bg-[#39FF14]", text: "text-black", glow: "#39FF14" },
{ name: "Live Music", color: "bg-[#FFD700]", text: "text-black", glow: "#FFD700" },
{ name: "Lounges", color: "bg-[#BF00FF]", text: "text-white", glow: "#BF00FF" },
{ name: "Hookah", color: "bg-[#00FFFF]", text: "text-black", glow: "#00FFFF" },
{ name: "Strip Clubs", color: "bg-[#FF007F]", text: "text-white", glow: "#FF007F" },
{ name: "LGBTQ+", color: "bg-[#FF5F1F]", text: "text-white", glow: "#FF5F1F" }];


/* ── Active badge component ─────────────────────────────────── */
const ActiveBadge = () =>
<span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-neon-green/15 border border-neon-green/30 text-neon-green text-[7px] font-black uppercase tracking-widest">
    <span className="w-1.5 h-1.5 rounded-full bg-neon-green animate-pulse" />
    ACTIVE
  </span>;


/* ── Follow button component ────────────────────────────────── */
const FollowButton = ({
  targetId,
  targetType,
  isFollowing,
  onClick,
  subtle = false






}: {targetId: string;targetType: "talent" | "venue";isFollowing: boolean;onClick: (e: React.MouseEvent) => void;subtle?: boolean;}) =>
<button
  onClick={onClick}
  className={cn(
    "relative flex items-center justify-center rounded-full transition-all active:scale-95",
    subtle ?
    "w-8 h-8 bg-white/10 backdrop-blur-md border border-white/20 hover:bg-white/20" :
    "w-10 h-10 bg-white text-black hover:bg-white/90"
  )}
  aria-label={isFollowing ? "Unfollow" : "Follow"}>

    {isFollowing ?
  <Minus className={subtle ? "w-3 h-3 text-white" : "w-4 h-4"} /> :

  <Plus className={subtle ? "w-3 h-3 text-white" : "w-4 h-4"} />
  }
  </button>;


/* ── Talent spotlight card (no follow button) ───────────────── */
const SpotlightCard = ({ talent, onNavigate }: {talent: any;onNavigate: () => void;}) =>
<div onClick={onNavigate} className="shrink-0 cursor-pointer">
    <div className="relative w-[75vw] md:w-80 h-[48dvh] rounded-[2.5rem] bg-zinc-950 border border-white/5 overflow-hidden shadow-2xl">
      <HeroReel
      videoUrl={talent.hero_reel_url}
      fallbackImageUrl={talent.avatar_url || "/placeholder.svg"}
      alt={talent.display_name}
      className="w-full h-full opacity-60 object-cover" />

      <div
      className="absolute inset-0"
      style={{
        background:
        "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0) 40%, rgba(0,0,0,0.7) 70%, rgba(0,0,0,1) 100%)",
        zIndex: 10
      }} />


      {/* Active badge */}
      {talent.venue_id &&
    <div className="absolute top-4 left-4 z-20">
          <ActiveBadge />
        </div>
    }

      {/* Bottom info */}
      <div className="absolute bottom-10 left-10 z-20">
        <p className="font-display text-4xl text-white uppercase tracking-tighter italic leading-none">
          {talent.display_name}
        </p>
        {talent.sub_role &&
      <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mt-1 block">
            {talent.sub_role}
          </span>
      }
      </div>
    </div>
  </div>;


/* ── Directory portal card ──────────────────────────────────── */
const DirectoryCard = ({ onNavigate }: {onNavigate: () => void;}) =>
<div
  onClick={onNavigate}
  className="shrink-0 flex flex-col items-center justify-center w-40 h-[48dvh] rounded-[2.5rem] border border-white/5 bg-zinc-950/40 cursor-pointer group hover:border-neon-blue transition-all">

    <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-4 group-hover:bg-neon-blue transition-colors">
      <ArrowRight className="w-5 h-5 text-white" />
    </div>
    <span className="text-[9px] font-black text-white/40 uppercase tracking-[0.2em] group-hover:text-white text-center px-4">
      View Directory
    </span>
  </div>;


/* ── Venue feed card (with follow button) ───────────────────── */
const VenueFeedCard = ({
  venue,
  onNavigate,
  isFollowing,
  onFollow





}: {venue: Venue;onNavigate: () => void;isFollowing: boolean;onFollow: (e: React.MouseEvent) => void;}) =>
<div
  onClick={onNavigate}
  className="h-[82dvh] w-full snap-end scroll-mt-32 relative overflow-hidden cursor-pointer"
  style={{ scrollSnapStop: "always" }}>

    {/* Full-screen background image */}
    <HeroReel
    videoUrl={venue.hero_reel_url}
    fallbackImageUrl={venue.image_url || "/placeholder.svg"}
    alt={venue.name}
    className="absolute inset-0 w-full h-full object-cover" />


    {/* Strong gradient overlay */}
    <div
    className="absolute inset-0"
    style={{
      background:
      "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0) 40%, rgba(0,0,0,0.7) 70%, rgba(0,0,0,1) 100%)",
      zIndex: 10
    }} />


    {/* Bottom content - absolutely positioned */}
    <div className="absolute bottom-0 left-0 right-0 p-10 z-20 max-w-4xl pb-[90px]">
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        {venue.is_active && <ActiveBadge />}
        <Badge className="bg-black/60 backdrop-blur-md border-white/10 text-white text-[9px] font-black uppercase tracking-[0.2em] px-4 py-2 rounded-full flex items-center gap-2">
          <MapPin className="w-3 h-3" />
          {venue.location || "Tampa Bay"}
        </Badge>
        {/* Follow button integrated with badges */}
        <div onClick={onFollow}>
          <FollowButton
          targetId={venue.id}
          targetType="venue"
          isFollowing={isFollowing}
          onClick={(e) => e.stopPropagation()}
          subtle />

        </div>
      </div>

      <h3 className="font-display text-[clamp(2rem,9vw,6rem)] text-white uppercase italic tracking-tighter leading-[0.85] pr-20 whitespace-normal break-normal line-clamp-3 mb-4">
        {venue.name}
      </h3>
    </div>
  </div>;


/* ── Talent feed card (with follow button) ──────────────────── */
const TalentFeedCard = ({
  talent,
  onNavigate,
  isFollowing,
  onFollow





}: {talent: any;onNavigate: () => void;isFollowing: boolean;onFollow: (e: React.MouseEvent) => void;}) =>
<div
  onClick={onNavigate}
  className="h-[82dvh] w-full snap-end scroll-mt-32 relative overflow-hidden cursor-pointer"
  style={{ scrollSnapStop: "always" }}>

    {/* Full-screen background image */}
    <HeroReel
    videoUrl={talent.hero_reel_url}
    fallbackImageUrl={talent.avatar_url || "/placeholder.svg"}
    alt={talent.display_name}
    className="absolute inset-0 w-full h-full object-cover" />


    {/* Strong gradient overlay */}
    <div
    className="absolute inset-0"
    style={{
      background:
      "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0) 40%, rgba(0,0,0,0.7) 70%, rgba(0,0,0,1) 100%)",
      zIndex: 10
    }} />


    {/* Bottom content - absolutely positioned */}
    <div className="absolute bottom-0 left-0 right-0 p-10 z-20 max-w-4xl pb-[90px]">
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        {talent.sub_role &&
      <Badge className="bg-neon-purple/20 backdrop-blur-md border-neon-purple/40 text-white text-[9px] font-black uppercase tracking-[0.2em] px-4 py-2 rounded-full">
            {talent.sub_role}
          </Badge>
      }
        {talent.venue_id && <ActiveBadge />}
        {/* Follow button integrated with badges */}
        <div onClick={onFollow}>
          <FollowButton
          targetId={talent.id}
          targetType="talent"
          isFollowing={isFollowing}
          onClick={(e) => e.stopPropagation()} />

        </div>
      </div>

      <h3 className="font-display text-[clamp(2rem,9vw,6rem)] text-white uppercase italic tracking-tighter leading-[0.85] pr-20 whitespace-normal break-normal line-clamp-3 mb-2">
        {talent.display_name}
      </h3>
      <p className="text-[10px] text-neon-purple font-black uppercase tracking-widest">Talent</p>
    </div>
  </div>;


/* ── Main Discovery page ────────────────────────────────────── */
const Discovery = () => {
  const navigate = useNavigate();
  const { session } = useUserMode();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const [venues, setVenues] = useState<Venue[]>([]);
  const [spotlightTalent, setSpotlightTalent] = useState<any[]>([]);
  const [feedTalent, setFeedTalent] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("All Vibes");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [followedTalent, setFollowedTalent] = useState<Set<string>>(new Set());
  const [followedVenues, setFollowedVenues] = useState<Set<string>>(new Set());

  const currentUserId = session?.user?.id || null;

  // Fetch discovery data + user's follows
  useEffect(() => {
    const fetchDiscoveryData = async () => {
      setLoading(true);
      try {
        // Build venue query with active-first sorting
        let venueQuery = supabase.from("venues").select("*").order("is_active", { ascending: false });

        if (activeCategory !== "All Vibes") {
          venueQuery = venueQuery.ilike("category", `%${activeCategory}%`);
        }

        const queries = [
        venueQuery,
        // Get top 3 charged talent
        supabase.rpc("get_talent_spotlight", { limit_count: 3 }),
        // Get talent profiles for 4:1 feed (working talent first)
        supabase.
        from("profiles").
        select("id, display_name, username, avatar_url, hero_reel_url, venue_id, sub_role").
        eq("role_type", "talent").
        order("venue_id", { ascending: false, nullsFirst: false }).
        limit(12)];


        // If logged in, fetch follows
        if (currentUserId) {
          queries.push(
            supabase.from("followers").select("following_id").eq("follower_id", currentUserId),
            supabase.from("venue_followers").select("venue_id").eq("follower_id", currentUserId)
          );
        }

        const results = await Promise.all(queries);
        const [vRes, spotlightRes, feedTalentRes, talentFollowsRes, venueFollowsRes] = results;

        if (vRes.data) setVenues(vRes.data as Venue[]);
        if (spotlightRes.data) setSpotlightTalent(spotlightRes.data);
        if (feedTalentRes.data) setFeedTalent(feedTalentRes.data);

        // Hydrate follows
        if (talentFollowsRes?.data) {
          const ids = talentFollowsRes.data.map((f: any) => f.following_id);
          setFollowedTalent(new Set(ids));
        }
        if (venueFollowsRes?.data) {
          const ids = venueFollowsRes.data.map((f: any) => f.venue_id);
          setFollowedVenues(new Set(ids));
        }
      } catch (err) {
        console.error("Discovery fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchDiscoveryData();
  }, [activeCategory, currentUserId]);

  // Scroll to top when category changes
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: "auto" });
    }
  }, [activeCategory]);

  // Handle passive charging on card click
  const handleCardClick = useCallback(
    async (targetId: string, targetType: "venue" | "talent", navigateTo: string) => {
      // Navigate first (don't block UX)
      navigate(navigateTo);

      // Log charge in background (if logged in)
      if (currentUserId) {
        await supabase.from("interactions").insert({
          user_id: currentUserId,
          target_id: targetId,
          target_type: targetType,
          interaction_type: "charge",
          action_value: 1 // Passive charge
        });
      }
    },
    [currentUserId, navigate]
  );

  // Handle follow/unfollow talent
  const handleFollowTalent = useCallback(
    async (talentId: string, e: React.MouseEvent) => {
      e.stopPropagation();

      if (!currentUserId) {
        toast.error("Sign in to follow");
        navigate("/auth");
        return;
      }

      if (talentId === currentUserId) {
        toast.error("Cannot follow yourself");
        return;
      }

      const isFollowing = followedTalent.has(talentId);

      // Optimistic update
      setFollowedTalent((prev) => {
        const next = new Set(prev);
        if (isFollowing) next.delete(talentId);else
        next.add(talentId);
        return next;
      });

      try {
        if (isFollowing) {
          await supabase.from("followers").delete().eq("follower_id", currentUserId).eq("following_id", talentId);
        } else {
          await supabase.from("followers").insert({ follower_id: currentUserId, following_id: talentId });
        }
      } catch (err) {
        console.error("Follow error:", err);
        toast.error("Connection failed");
        // Rollback
        setFollowedTalent((prev) => {
          const next = new Set(prev);
          if (isFollowing) next.add(talentId);else
          next.delete(talentId);
          return next;
        });
      }
    },
    [currentUserId, followedTalent, navigate]
  );

  // Handle follow/unfollow venue
  const handleFollowVenue = useCallback(
    async (venueId: string, e: React.MouseEvent) => {
      e.stopPropagation();

      if (!currentUserId) {
        toast.error("Sign in to follow");
        navigate("/auth");
        return;
      }

      const isFollowing = followedVenues.has(venueId);

      // Optimistic update
      setFollowedVenues((prev) => {
        const next = new Set(prev);
        if (isFollowing) next.delete(venueId);else
        next.add(venueId);
        return next;
      });

      try {
        if (isFollowing) {
          await supabase.from("venue_followers").delete().eq("follower_id", currentUserId).eq("venue_id", venueId);
        } else {
          await supabase.from("venue_followers").insert({ follower_id: currentUserId, venue_id: venueId });
        }
      } catch (err) {
        console.error("Follow venue error:", err);
        toast.error("Connection failed");
        // Rollback
        setFollowedVenues((prev) => {
          const next = new Set(prev);
          if (isFollowing) next.add(venueId);else
          next.delete(venueId);
          return next;
        });
      }
    },
    [currentUserId, followedVenues, navigate]
  );

  // Build 4:1 combined feed with search filter
  const combinedFeed = useMemo(() => {
    const filtered = venues.filter(
      (v) =>
      v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.location?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const feed: Array<{type: "venue" | "talent";data: any;}> = [];
    let talentIdx = 0;

    for (let i = 0; i < filtered.length; i++) {
      feed.push({ type: "venue", data: filtered[i] });
      // After every 4th venue, inject a talent
      if ((i + 1) % 4 === 0 && feedTalent[talentIdx]) {
        feed.push({ type: "talent", data: feedTalent[talentIdx] });
        talentIdx++;
      }
    }

    return feed;
  }, [venues, feedTalent, searchQuery]);

  return (
    <div className="h-screen bg-black overflow-hidden flex flex-col font-body relative">
      {/* SEARCH MODAL OVERLAY */}
      {isSearchOpen &&
      <div className="absolute inset-0 z-[200] bg-black/95 backdrop-blur-xl p-8 flex flex-col pt-24 animate-in fade-in slide-in-from-top-4 duration-300">
          <button
          onClick={() => setIsSearchOpen(false)}
          className="absolute top-8 right-8 text-white/40 hover:text-white transition-colors">

            <X className="w-6 h-6" />
          </button>
          <h2 className="text-white font-display text-4xl italic uppercase mb-8 tracking-tighter">Search Venues</h2>
          <div className="relative">
            <Search className="absolute left-0 top-1/2 -translate-y-1/2 w-6 h-6 text-neon-blue" />
            <input
            autoFocus
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ENTER VENUE OR LOCATION..."
            className="w-full bg-transparent border-b border-white/10 py-6 pl-10 text-xl font-bold uppercase tracking-widest text-white focus:outline-none focus:border-neon-blue transition-colors" />

          </div>

          {/* SEARCH RESULTS PREVIEW */}
          {searchQuery &&
        <div className="mt-12 space-y-4">
              <p className="text-white/40 text-xs font-black uppercase tracking-widest">
                {combinedFeed.filter((i) => i.type === "venue").length} Venues Found
              </p>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {combinedFeed.
            filter((i) => i.type === "venue").
            slice(0, 5).
            map((item, idx) =>
            <div
              key={idx}
              onClick={() => {
                setIsSearchOpen(false);
                handleCardClick(item.data.id, "venue", `/venue/${item.data.id}`);
              }}
              className="flex items-center gap-4 p-4 bg-white/5 rounded-xl cursor-pointer hover:bg-white/10 transition-colors">

                      <img
                src={item.data.image_url || "/placeholder.svg"}
                className="w-16 h-16 rounded-lg object-cover"
                alt="" />

                      <div>
                        <h3 className="text-white font-bold uppercase tracking-tight">{item.data.name}</h3>
                        <p className="text-white/40 text-xs uppercase tracking-wider">{item.data.location}</p>
                      </div>
                    </div>
            )}
              </div>
            </div>
        }
        </div>
      }

      {/* SLIM HUD HEADER */}
      <div className="fixed top-0 left-0 right-0 z-[150] glass pt-4 overflow-visible">
        <div className="px-8 flex justify-between items-center h-16">
          <div className="flex items-center gap-3">
            <Target className="w-4 h-4 text-neon-blue" />
            <h1 className="font-display text-2xl text-white uppercase tracking-wider italic pt-1 leading-none">
              Discovery
            </h1>
          </div>
          <button onClick={() => setIsSearchOpen(true)} className="text-white/40 hover:text-white transition-colors">
            <Search className="w-5 h-5" />
          </button>
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
                  isActive ?
                  `${cat.color} ${cat.text} border-transparent scale-105` :
                  "bg-zinc-900 text-white/30 border-white/5"
                )}
                style={{ boxShadow: isActive ? `0 0 25px ${cat.glow}99` : "none" }}>

                {cat.name}
              </button>);

          })}
        </div>

        {/* GRADIENT FADE */}
        <div
          className="absolute -bottom-16 left-0 right-0 h-16 gradient-header-fade pointer-events-none z-[140]"
          style={{
            background:
            "linear-gradient(to bottom, rgba(0, 0, 0, 1) 0%, rgba(0, 0, 0, 0.5) 50%, rgba(0, 0, 0, 0) 100%)"
          }} />

      </div>

      {/* IMMERSIVE SNAP STREAM */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-scroll snap-y snap-mandatory hide-scrollbar pt-32"
        style={{ WebkitOverflowScrolling: "touch", overscrollBehaviorY: "auto" }}>

        {/* TALENT SPOTLIGHT SECTION */}
        <div className="min-h-[52dvh] w-full snap-end scroll-mt-32 relative flex flex-col justify-center bg-black px-[10px] pt-[50px] pb-[50px]">
          <div className="flex overflow-x-auto gap-8 pl-[25px] pr-[40px] hide-scrollbar scroll-smooth items-center pt-[10px] pb-[10px]">
            {loading ?
            <>
                {[1, 2, 3].map((i) =>
              <Skeleton key={i} className="shrink-0 w-[75vw] md:w-80 h-[48dvh] rounded-[2.5rem] bg-zinc-950" />
              )}
              </> :
            spotlightTalent.length > 0 ?
            <>
                {spotlightTalent.map((talent) =>
              <SpotlightCard
                key={talent.talent_id}
                talent={talent}
                onNavigate={() => handleCardClick(talent.talent_id, "talent", `/talent/${talent.talent_id}`)} />

              )}
                <DirectoryCard onNavigate={() => navigate("/talent-directory")} />
              </> :

            <>
                {[1, 2, 3].map((i) =>
              <Skeleton key={i} className="shrink-0 w-[75vw] md:w-80 h-[48dvh] rounded-[2.5rem] bg-zinc-950" />
              )}
                <DirectoryCard onNavigate={() => navigate("/talent-directory")} />
              </>
            }
          </div>
        </div>

        {/* MAIN FEED */}
        {loading ?
        <div className="px-8 space-y-16">
            {[1, 2, 3].map((i) =>
          <Skeleton key={i} className="h-[78dvh] w-full rounded-3xl bg-zinc-950" />
          )}
          </div> :
        combinedFeed.length === 0 ?
        <div className="min-h-[78dvh] flex flex-col items-center justify-center text-center px-8">
            <Search className="w-16 h-16 text-zinc-900 mb-6" />
            <p className="text-zinc-600 font-black uppercase tracking-[0.3em] text-[10px]">No Venues Found</p>
            <p className="text-zinc-700 text-xs mt-2">Try a different category or search term</p>
          </div> :

        combinedFeed.map((item, idx) =>
        item.type === "venue" ?
        <VenueFeedCard
          key={`v-${item.data.id}`}
          venue={item.data}
          onNavigate={() => handleCardClick(item.data.id, "venue", `/venue/${item.data.id}`)}
          isFollowing={followedVenues.has(item.data.id)}
          onFollow={(e) => handleFollowVenue(item.data.id, e)} /> :


        <TalentFeedCard
          key={`t-${item.data.id}`}
          talent={item.data}
          onNavigate={() => handleCardClick(item.data.id, "talent", `/talent/${item.data.id}`)}
          isFollowing={followedTalent.has(item.data.id)}
          onFollow={(e) => handleFollowTalent(item.data.id, e)} />


        )
        }
      </div>
    </div>);

};

export default Discovery;