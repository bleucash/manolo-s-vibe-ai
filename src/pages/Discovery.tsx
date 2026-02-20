import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Sparkles, ArrowRight, Plus, MapPin } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useUserMode } from "@/contexts/UserModeContext";
import { HeroReel } from "@/components/HeroReel";
import { Venue } from "@/types/database";
import { toast } from "sonner";

const CATEGORIES = [
  { name: "All Vibes", color: "bg-foreground text-background", border: "border-foreground" },
  { name: "Nightclubs", color: "bg-neon-blue text-foreground shadow-[0_0_15px_hsl(var(--neon-blue)/0.6)]", border: "border-neon-blue" },
  { name: "Bars", color: "bg-neon-green text-background shadow-[0_0_15px_hsl(var(--neon-green)/0.6)]", border: "border-neon-green" },
  { name: "Live Music", color: "bg-neon-green text-background shadow-[0_0_15px_hsl(var(--neon-green)/0.6)]", border: "border-neon-green" },
  { name: "Lounges", color: "bg-neon-purple text-foreground shadow-[0_0_15px_hsl(var(--neon-purple)/0.6)]", border: "border-neon-purple" },
  { name: "Hookah", color: "bg-neon-cyan text-background shadow-[0_0_15px_hsl(var(--neon-cyan)/0.6)]", border: "border-neon-cyan" },
  { name: "Strip Clubs", color: "bg-neon-pink text-foreground shadow-[0_0_15px_hsl(var(--neon-pink)/0.6)]", border: "border-neon-pink" },
  { name: "LGBQT+", color: "bg-accent text-foreground shadow-[0_0_15px_hsl(var(--accent)/0.6)]", border: "border-accent" },
];

/* ── Charge button ──────────────────────────────────────────── */
const ChargeButton = ({
  targetId,
  targetType,
  onClick,
}: {
  targetId: string;
  targetType: "talent" | "venue";
  onClick: (e: React.MouseEvent) => void;
}) => (
  <button
    onClick={onClick}
    className="absolute bottom-4 right-4 z-20 w-10 h-10 rounded-full bg-neon-green/20 border border-neon-green/50 backdrop-blur-sm flex items-center justify-center transition-all hover:bg-neon-green/40 hover:scale-110 shadow-[0_0_12px_hsl(var(--neon-green)/0.4)]"
    aria-label="Charge"
  >
    <Plus className="w-4 h-4 text-neon-green" />
  </button>
);

/* ── Active badge ───────────────────────────────────────────── */
const ActiveBadge = () => (
  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-neon-green/15 border border-neon-green/30 text-neon-green text-[7px] font-black uppercase tracking-widest">
    <span className="w-1.5 h-1.5 rounded-full bg-neon-green animate-pulse" />
    ACTIVE
  </span>
);

/* ── Venue card ─────────────────────────────────────────────── */
const VenueCard = ({
  venue,
  onNavigate,
  onCharge,
}: {
  venue: Venue;
  onNavigate: () => void;
  onCharge: (e: React.MouseEvent) => void;
}) => (
  <div
    onClick={onNavigate}
    className="relative w-full h-96 rounded-3xl overflow-hidden border border-border/30 bg-card shadow-2xl cursor-pointer snap-start group transition-transform duration-300 active:scale-[0.99]"
  >
    <HeroReel
      videoUrl={venue.hero_reel_url}
      fallbackImageUrl={venue.image_url || "/placeholder.svg"}
      alt={venue.name}
      className="absolute inset-0 w-full h-full transition-transform duration-700 group-hover:scale-105"
    />
    <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />

    {/* Top badges */}
    <div className="absolute top-4 left-4 flex gap-2 flex-wrap">
      {venue.category && (
        <Badge className="bg-background/60 backdrop-blur-md border-border/40 text-foreground text-[7px] font-black uppercase px-2.5 py-1">
          {venue.category}
        </Badge>
      )}
      {venue.is_active && <ActiveBadge />}
    </div>

    {/* Bottom info */}
    <div className="absolute bottom-0 left-0 right-0 p-6">
      <h3 className="text-[clamp(2rem,8vw,3.5rem)] font-display text-foreground uppercase tracking-tighter leading-[0.9] italic line-clamp-2 drop-shadow-lg">
        {venue.name}
      </h3>
      <div className="flex items-center gap-1.5 mt-2">
        <MapPin className="w-3 h-3 text-muted-foreground" />
        <p className="text-[9px] text-muted-foreground font-black uppercase tracking-[0.2em]">
          {venue.location}
        </p>
      </div>
    </div>

    <ChargeButton targetId={venue.id} targetType="venue" onClick={onCharge} />
  </div>
);

/* ── Talent feed card ───────────────────────────────────────── */
const TalentFeedCard = ({
  talent,
  onNavigate,
  onCharge,
}: {
  talent: any;
  onNavigate: () => void;
  onCharge: (e: React.MouseEvent) => void;
}) => (
  <div
    onClick={onNavigate}
    className="relative w-full h-96 rounded-3xl overflow-hidden border border-neon-purple/20 bg-card shadow-2xl cursor-pointer snap-start group transition-transform duration-300 active:scale-[0.99]"
  >
    <HeroReel
      videoUrl={talent.hero_reel_url}
      fallbackImageUrl={talent.avatar_url || "/placeholder.svg"}
      alt={talent.display_name}
      className="absolute inset-0 w-full h-full transition-transform duration-700 group-hover:scale-105"
    />
    <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />

    {/* Top badges */}
    <div className="absolute top-4 left-4 flex gap-2 flex-wrap">
      {talent.sub_role && (
        <Badge className="bg-neon-purple/20 backdrop-blur-md border-neon-purple/40 text-foreground text-[7px] font-black uppercase px-2.5 py-1">
          {talent.sub_role}
        </Badge>
      )}
      {talent.venue_id && <ActiveBadge />}
    </div>

    {/* Bottom info */}
    <div className="absolute bottom-0 left-0 right-0 p-6">
      <h3 className="text-[clamp(2rem,8vw,3.5rem)] font-display text-foreground uppercase tracking-tighter leading-[0.9] italic line-clamp-1 drop-shadow-lg">
        {talent.display_name}
      </h3>
      <p className="text-[9px] text-neon-purple font-black uppercase tracking-widest mt-1">
        Talent
      </p>
    </div>

    <ChargeButton targetId={talent.id} targetType="talent" onClick={onCharge} />
  </div>
);

/* ── Spotlight talent card ──────────────────────────────────── */
const SpotlightCard = ({
  talent,
  onNavigate,
  onCharge,
}: {
  talent: any;
  onNavigate: () => void;
  onCharge: (e: React.MouseEvent) => void;
}) => (
  <div
    onClick={onNavigate}
    className="relative shrink-0 w-[280px] h-80 rounded-3xl overflow-hidden border border-border/30 bg-card snap-center cursor-pointer group transition-transform duration-300 active:scale-[0.98]"
  >
    <HeroReel
      videoUrl={talent.hero_reel_url}
      fallbackImageUrl={talent.avatar_url || "/placeholder.svg"}
      alt={talent.display_name}
      className="absolute inset-0 w-full h-full transition-transform duration-700 group-hover:scale-105"
    />
    <div className="absolute inset-0 bg-gradient-to-t from-background via-background/10 to-transparent" />

    {/* Active badge */}
    {talent.venue_id && (
      <div className="absolute top-3 left-3">
        <ActiveBadge />
      </div>
    )}

    {/* Bottom info */}
    <div className="absolute bottom-0 left-0 right-0 p-5 pr-14">
      <h3 className="text-2xl font-display text-foreground uppercase tracking-tighter leading-none line-clamp-1">
        {talent.display_name}
      </h3>
      {talent.sub_role && (
        <p className="text-[8px] text-muted-foreground font-black uppercase tracking-widest mt-1">
          {talent.sub_role}
        </p>
      )}
    </div>

    <ChargeButton targetId={talent.talent_id || talent.id} targetType="talent" onClick={onCharge} />
  </div>
);

/* ── Directory card ─────────────────────────────────────────── */
const DirectoryCard = ({ onNavigate }: { onNavigate: () => void }) => (
  <div
    onClick={onNavigate}
    className="relative shrink-0 w-[160px] h-80 rounded-3xl overflow-hidden border border-border/20 bg-gradient-to-b from-card to-background snap-center cursor-pointer group flex flex-col items-center justify-center gap-4 px-4"
  >
    <div className="w-12 h-12 rounded-full bg-neon-blue/20 border border-neon-blue/40 flex items-center justify-center group-hover:bg-neon-blue/30 transition-colors">
      <ArrowRight className="w-5 h-5 text-neon-blue" />
    </div>
    <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest text-center leading-relaxed">
      Full Talent Directory
    </p>
    <div className="absolute inset-0 bg-gradient-to-r from-transparent to-background/80 pointer-events-none" />
  </div>
);

/* ── Main page ──────────────────────────────────────────────── */
const Discovery = () => {
  const navigate = useNavigate();
  const { isLoading: contextLoading } = useUserMode();

  const [venues, setVenues] = useState<Venue[]>([]);
  const [featuredTalent, setFeaturedTalent] = useState<any[]>([]);
  const [feedTalent, setFeedTalent] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("All Vibes");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchDiscoveryData();
  }, [activeCategory]);

  const fetchDiscoveryData = async () => {
    setLoading(true);
    try {
      let venueQuery = supabase
        .from("venues")
        .select("*")
        .order("is_active", { ascending: false });

      if (activeCategory !== "All Vibes") {
        venueQuery = venueQuery.ilike("category", `%${activeCategory}%`);
      }

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
      if (feedTalentRes.data) setFeedTalent(feedTalentRes.data);
    } catch (err) {
      console.error("Discovery Sync Error", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCharge = useCallback(
    async (e: React.MouseEvent, targetId: string, targetType: "talent" | "venue") => {
      e.stopPropagation();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error("Sign in to charge talent"); return; }
      const { error } = await supabase.from("interactions").insert({
        user_id: user.id,
        target_id: targetId,
        target_type: targetType,
        interaction_type: "charge",
        action_value: 10,
      });
      if (error) { toast.error("Failed to charge"); return; }
      toast.success("Charged! ⚡", { description: "Your energy has been sent." });
    },
    []
  );

  // Filter venues by search
  const filteredVenues = searchQuery.trim()
    ? venues.filter((v) => v.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : venues;

  // Build 4:1 combined feed
  const combinedFeed: Array<{ type: "venue"; data: Venue } | { type: "talent"; data: any }> = [];
  let talentIdx = 0;
  for (let i = 0; i < filteredVenues.length; i++) {
    combinedFeed.push({ type: "venue", data: filteredVenues[i] });
    if ((i + 1) % 4 === 0 && feedTalent[talentIdx]) {
      combinedFeed.push({ type: "talent", data: feedTalent[talentIdx] });
      talentIdx++;
    }
  }

  return (
    <div className="min-h-screen bg-background pb-32 overflow-y-auto no-scrollbar">
      {/* ── HEADER ────────────────────────────────────────────── */}
      <div className="sticky top-0 z-50 glass border-b border-border/30 pt-14 pb-5 px-5">
        <h1 className="text-5xl md:text-6xl font-display text-foreground uppercase tracking-tighter leading-[0.85] italic mb-6">
          What's{" "}
          <span className="text-neon-pink inline-flex items-center gap-3">
            The VIBES
            <span className="w-2.5 h-2.5 rounded-full bg-neon-pink animate-ping" />
          </span>
        </h1>

        {/* Search */}
        <div className="relative group mb-4">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-foreground transition-colors" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="SEARCH VENUES..."
            className="w-full bg-muted/60 border border-border/40 rounded-xl py-3.5 pl-11 pr-4 text-[10px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-neon-blue/50 font-black uppercase tracking-[0.2em] transition-colors"
          />
        </div>

        {/* Category pills */}
        <div className="flex overflow-x-auto gap-2 no-scrollbar py-0.5">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.name}
              onClick={() => setActiveCategory(cat.name)}
              className={`whitespace-nowrap px-3.5 py-1.5 rounded-full text-[8px] font-black uppercase tracking-widest transition-all duration-200 border ${
                activeCategory === cat.name
                  ? cat.color
                  : "bg-transparent text-muted-foreground border-border/20 hover:border-border/50"
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* ── TALENT SPOTLIGHT ──────────────────────────────────── */}
      <section className="mt-10 mb-12">
        <div className="px-5 flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <h2 className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.3em]">
              Charged Talent
            </h2>
          </div>
        </div>

        <div className="flex overflow-x-auto gap-4 px-5 no-scrollbar snap-x snap-mandatory pb-2">
          {loading
            ? [1, 2, 3].map((i) => (
                <Skeleton key={i} className="shrink-0 w-[280px] h-80 rounded-3xl bg-card" />
              ))
            : featuredTalent.map((talent) => (
                <SpotlightCard
                  key={talent.talent_id}
                  talent={talent}
                  onNavigate={() => navigate(`/talent/${talent.talent_id}`)}
                  onCharge={(e) => handleCharge(e, talent.talent_id, "talent")}
                />
              ))}

          {/* Directory CTA card */}
          {!loading && (
            <DirectoryCard onNavigate={() => navigate("/talent-directory")} />
          )}
        </div>
      </section>

      {/* ── MAIN FEED ─────────────────────────────────────────── */}
      <section className="px-5 flex flex-col gap-5 snap-y snap-mandatory">
        {loading ? (
          <>
            <Skeleton className="h-96 w-full rounded-3xl bg-card" />
            <Skeleton className="h-96 w-full rounded-3xl bg-card" />
            <Skeleton className="h-96 w-full rounded-3xl bg-card" />
          </>
        ) : combinedFeed.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <p className="text-muted-foreground text-sm font-black uppercase tracking-widest">
              No results found
            </p>
            <p className="text-muted-foreground/50 text-xs mt-2">
              Try a different category or search
            </p>
          </div>
        ) : (
          combinedFeed.map((item, idx) =>
            item.type === "venue" ? (
              <VenueCard
                key={`v-${item.data.id}`}
                venue={item.data}
                onNavigate={() => navigate(`/venue/${item.data.id}`)}
                onCharge={(e) => handleCharge(e, item.data.id, "venue")}
              />
            ) : (
              <TalentFeedCard
                key={`t-${item.data.id}`}
                talent={item.data}
                onNavigate={() => navigate(`/talent/${item.data.id}`)}
                onCharge={(e) => handleCharge(e, item.data.id, "talent")}
              />
            )
          )
        )}
      </section>
    </div>
  );
};

export default Discovery;
