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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const CATEGORIES = [
  { name: "All Vibes", color: "bg-white", text: "text-black", glow: "#FFFFFF" },
  { name: "Nightclubs", color: "bg-[#00B7FF]", text: "text-black", glow: "#00B7FF" },
  { name: "Bars", color: "bg-[#39FF14]", text: "text-black", glow: "#39FF14" },
  { name: "Live Music", color: "bg-[#FFD700]", text: "text-black", glow: "#FFD700" },
  { name: "Lounges", color: "bg-[#BF00FF]", text: "text-white", glow: "#BF00FF" },
  { name: "Hookah", color: "bg-[#00FFFF]", text: "text-black", glow: "#00FFFF" },
  { name: "Strip Clubs", color: "bg-[#FF007F]", text: "text-white", glow: "#FF007F" },
  { name: "LGBTQ+", color: "bg-[#FF5F1F]", text: "text-white", glow: "#FF5F1F" },
];

const ActiveBadge = () => (
  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-neon-green/15 border border-neon-green/30 text-neon-green text-[7px] font-black uppercase tracking-widest">
    <span className="w-1.5 h-1.5 rounded-full bg-neon-green animate-pulse" />
    ACTIVE
  </span>
);

const ActiveFacepile = ({ staff }: { staff: any[] }) => {
  if (!staff || staff.length === 0) return null;
  return (
    <div className="flex -space-x-2 overflow-hidden pointer-events-none ml-2">
      {staff.slice(0, 3).map((item: any, i: number) => (
        <Avatar key={i} className="w-6 h-6 border border-black ring-1 ring-white/10">
          <AvatarImage src={item.profiles?.avatar_url} />
          <AvatarFallback className="text-[6px] bg-zinc-900 text-white">
            {item.profiles?.username?.[0]}
          </AvatarFallback>
        </Avatar>
      ))}
      {staff.length > 3 && (
        <div className="w-6 h-6 rounded-full bg-zinc-900 border border-black flex items-center justify-center text-[6px] font-black text-white">
          +{staff.length - 3}
        </div>
      )}
    </div>
  );
};

const FollowButton = ({ targetId, isFollowing, onClick, subtle = false }: any) => (
  <button
    onClick={onClick}
    className={cn(
      "relative flex items-center justify-center rounded-full transition-all active:scale-95",
      subtle ? "w-8 h-8 bg-white/10 backdrop-blur-md border border-white/20 hover:bg-white/20" : "w-10 h-10 bg-white text-black hover:bg-white/90",
    )}
  >
    {isFollowing ? <Minus className={subtle ? "w-3 h-3 text-white" : "w-4 h-4"} /> : <Plus className={subtle ? "w-3 h-3 text-white" : "w-4 h-4"} />}
  </button>
);

const SpotlightCard = ({ talent, onNavigate }: any) => (
  <div onClick={onNavigate} className="shrink-0 cursor-pointer">
    <div className="relative w-[75vw] md:w-80 h-[48dvh] rounded-[2.5rem] bg-zinc-950 border border-white/5 overflow-hidden shadow-2xl">
      <HeroReel videoUrl={talent.hero_reel_url} fallbackImageUrl={talent.avatar_url || "/placeholder.svg"} alt={talent.display_name} className="w-full h-full opacity-60 object-cover" />
      <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0) 40%, rgba(0,0,0,0.7) 70%, rgba(0,0,0,1) 100%)", zIndex: 10 }} />
      {talent.is_active && <div className="absolute top-6 left-6 z-20"><ActiveBadge /></div>}
      <div className="absolute bottom-10 left-10 z-20">
        <p className="font-display text-4xl text-white uppercase tracking-tighter italic leading-none">{talent.display_name}</p>
        <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mt-1 block">{talent.sub_role || "TALENT"}</span>
      </div>
    </div>
  </div>
);

const DirectoryCard = ({ onNavigate }: any) => (
  <div onClick={onNavigate} className="shrink-0 flex flex-col items-center justify-center w-40 h-[48dvh] rounded-[2.5rem] border border-white/5 bg-zinc-950/40 cursor-pointer group hover:border-neon-blue transition-all">
    <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-4 group-hover:bg-neon-blue transition-colors"><ArrowRight className="w-5 h-5 text-white" /></div>
    <span className="text-[9px] font-black text-white/40 uppercase tracking-[0.2em] group-hover:text-white text-center px-4">View Directory</span>
  </div>
);

const VenueFeedCard = ({ venue, onNavigate, isFollowing, onFollow }: any) => (
  <div onClick={onNavigate} className="h-[82dvh] w-full snap-end scroll-mt-32 relative overflow-hidden cursor-pointer" style={{ scrollSnapStop: "always" }}>
    <HeroReel videoUrl={venue.hero_reel_url} fallbackImageUrl={venue.image_url || "/placeholder.svg"} alt={venue.name} className="absolute inset-0 w-full h-full object-cover" />
    <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0) 40%, rgba(0,0,0,0.7) 70%, rgba(0,0,0,1) 100%)", zIndex: 10 }} />
    <div className="absolute bottom-0 left-0 right-0 p-10 z-20 max-w-4xl pb-[90px]">
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        {venue.is_active && <ActiveBadge />}
        <Badge className="bg-black/60 backdrop-blur-md border-white/10 text-white text-[9px] font-black uppercase tracking-[0.2em] px-4 py-2 rounded-full flex items-center gap-2">
          <MapPin className="w-3 h-3" /> {venue.location || "Sector Verified"}
        </Badge>
        <ActiveFacepile staff={venue.venue_staff || []} />
        <div onClick={onFollow}><FollowButton targetId={venue.id} targetType="venue" isFollowing={isFollowing} onClick={(e: any) => e.stopPropagation()} subtle /></div>
      </div>
      <h3 className="font-display text-[clamp(2rem,9vw,6rem)] text-white uppercase italic tracking-tighter leading-[0.85] pr-20 whitespace-normal break-normal line-clamp-3 mb-4">{venue.name}</h3>
    </div>
  </div>
);

const TalentFeedCard = ({ talent, onNavigate, isFollowing, onFollow }: any) => (
  <div onClick={onNavigate} className="h-[82dvh] w-full snap-end scroll-mt-32 relative overflow-hidden cursor-pointer" style={{ scrollSnapStop: "always" }}>
    <HeroReel videoUrl={talent.hero_reel_url} fallbackImageUrl={talent.avatar_url || "/placeholder.svg"} alt={talent.display_name} className="absolute inset-0 w-full h-full object-cover" />
    <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0) 40%, rgba(0,0,0,0.7) 70%, rgba(0,0,0,1) 100%)", zIndex: 10 }} />
    <div className="absolute bottom-0 left-0 right-0 p-10 z-20 max-w-4xl pb-[90px]">
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        {talent.sub_role && <Badge className="bg-neon-purple/20 backdrop-blur-md border-neon-purple/40 text-white text-[9px] font-black uppercase tracking-[0.2em] px-4 py-2 rounded-full">{talent.sub_role}</Badge>}
        {talent.is_active && <ActiveBadge />}
        <div onClick={onFollow}><FollowButton targetId={talent.id} targetType="talent" isFollowing={isFollowing} onClick={(e: any) => e.stopPropagation()} /></div>
      </div>
      <h3 className="font-display text-[clamp(2rem,9vw,6rem)] text-white uppercase italic tracking-tighter leading-[0.85] pr-20 whitespace-normal break-normal line-clamp-3 mb-2">{talent.display_name}</h3>
    </div>
  </div>
);

const Discovery = () => {
  const navigate = useNavigate();
  const { session } = useUserMode();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [venues, setVenues] = useState<any[]>([]);
  const [spotlightTalent, setSpotlightTalent] = useState<any[]>([]);
  const [feedTalent, setFeedTalent] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("All Vibes");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [followedTalent, setFollowedTalent] = useState<Set<string>>(new Set());
  const [followedVenues, setFollowedVenues] = useState<Set<string>>(new Set());
  const currentUserId = session?.user?.id || null;

  useEffect(() => {
    const fetchDiscoveryData = async () => {
      setLoading(true);
      try {
        let venueQuery = supabase.from("venues").select("*, venue_staff(user_id, status, profiles(avatar_url, username))").eq("venue_staff.status", "active").order("is_active", { ascending: false }).limit(20);
        if (activeCategory !== "All Vibes") venueQuery = venueQuery.eq("category", activeCategory);
        const queries = [venueQuery, supabase.rpc("get_talent_spotlight", { limit_count: 3 }), supabase.from("profiles").select("id, display_name, username, avatar_url, hero_reel_url, is_active, current_venue_id, sub_role").eq("role_type", "talent").order("is_active", { ascending: false }).limit(20)];
        if (currentUserId) queries.push(supabase.from("followers").select("following_id").eq("follower_id", currentUserId), supabase.from("venue_followers").select("venue_id").eq("follower_id", currentUserId));
        const [vRes, sRes, fRes, tFRes, vFRes] = await Promise.all(queries);
        if (vRes.data) setVenues(vRes.data);
        if (sRes.data) setSpotlightTalent(sRes.data);
        if (fRes.data) setFeedTalent(fRes.data);
        if (tFRes?.data) setFollowedTalent(new Set(tFRes.data.map((f: any) => f.following_id)));
        if (vFRes?.data) setFollowedVenues(new Set(vFRes.data.map((f: any) => f.venue_id)));
      } catch (err) { console.error(err); } finally { setLoading(false); }
    };
    fetchDiscoveryData();
  }, [activeCategory, currentUserId]);

  const handleCardClick = (id: string, type: string, path: string) => {
    navigate(path);
    if (currentUserId) supabase.from("interactions").insert({ user_id: currentUserId, target_id: id, target_type: type, interaction_type: "charge", action_value: 1 });
  };

  const combinedFeed = useMemo(() => {
    const filtered = venues.filter(v => v.name.toLowerCase().includes(searchQuery.toLowerCase()));
    const feed: any[] = [];
    let tIdx = 0;
    for (let i = 0; i < filtered.length; i++) {
      feed.push({ type: "venue", data: filtered[i] });
      if ((i + 1) % 4 === 0 && feedTalent[tIdx]) { feed.push({ type: "talent", data: feedTalent[tIdx] }); tIdx++; }
    }
    return feed;
  }, [venues, feedTalent, searchQuery]);

  return (
    <div className="h-screen bg-black overflow-hidden flex flex-col relative">
      {/* HUD HEADER */}
      <div className="fixed top-0 left-0 right-0 z-[150] glass pt-4 shadow-[0_4px_20px_rgba(0,0,0,0.5)] overflow-visible">
        <div className="px-8 flex justify-between items-center h-16">
          <div className="flex items-center gap-3"><Target className="w-4 h-4 text-neon-blue" /><h1 className="font-display text-2xl text-white uppercase tracking-wider italic pt-1 leading-none">Discovery</h1></div>
          <button onClick={() => setIsSearchOpen(true)} className="text-white/40"><Search className="w-5 h-5" /></button>
        </div>
        <div className="flex overflow-x-auto gap-3 hide-scrollbar px-8 py-4 overflow-visible relative z-[160]">
          {CATEGORIES.map((cat) => (
            <button key={cat.name} onClick={() => setActiveCategory(cat.name)} className={cn("whitespace-nowrap px-4 py-1.5 rounded-full text-[8px] font-black uppercase tracking-widest border transition-all", activeCategory === cat.name ? `${cat.color} ${cat.text} border-transparent scale-105 shadow-[0_0_25px_rgba(255,255,255,0.3)]` : "bg-zinc-900 text-white/30 border-white/5")}>{cat.name}</button>
          ))}
        </div>
      </div>

      <div ref={scrollContainerRef} className="flex-1 overflow-y-scroll snap-y snap-mandatory hide-scrollbar pt-32">
        <div className="min-h-[52dvh] w-full snap-end scroll-mt-32 relative flex flex-col justify-center bg-black px-[10px] pt-[50px] pb-[50px]">
          <div className="flex overflow-x-auto gap-8 pl-[25px] pr-[40px] hide-scrollbar scroll-smooth items-center">
            {loading || spotlightTalent.length === 0 ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="shrink-0 w-[75vw] md:w-80 h-[48dvh] rounded-[2.5rem] bg-zinc-950 border border-white/5 animate-pulse overflow-hidden relative">
                  <div className="absolute bottom-10 left-8 space-y-3">
                    <div className="w-32 h-6 bg-white/10 rounded-full" />
                    <div className="w-20 h-3 bg-white/5 rounded-full" />
                  </div>
                </div>
              ))
            ) : (
              spotlightTalent.map((t) => (
                <SpotlightCard key={t.talent_id} talent={t} onNavigate={() => handleCardClick(t.talent_id, "talent", `/talent/${t.talent_id}`)} />
              ))
            )}
            <DirectoryCard onNavigate={() => navigate("/talent-directory")} />
          </div>
        </div>
        {combinedFeed.map((item, idx) => (
          item.type === "venue" ? (
            <VenueFeedCard key={`v-${item.data.id}`} venue={item.data} onNavigate={() => handleCardClick(item.data.id, "venue", `/venue/${item.data.id}`)} isFollowing={followedVenues.has(item.data.id)} />
          ) : (
            <TalentFeedCard key={`t-${item.data.id}`} talent={item.data} onNavigate={() => handleCardClick(item.data.id, "talent", `/talent/${item.data.id}`)} isFollowing={followedTalent.has(item.data.id)} />
          )
        ))}
      </div>
    </div>
  );
};

export default Discovery;

