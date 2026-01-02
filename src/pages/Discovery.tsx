import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin, Search, Star, Sparkles, UserCheck, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Venue } from "@/types/venues";

interface Talent {
  id: string;
  display_name: string;
  username: string;
  avatar_url: string;
  bio?: string;
}

interface Talent {
  id: string;
  display_name: string;
  username: string;
  avatar_url: string;
  bio?: string;
}

const Discovery = () => {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [featuredTalent, setFeaturedTalent] = useState<Talent[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchDiscoveryData();
  }, []);

  const fetchDiscoveryData = async () => {
    try {
      // 1. Fetch Venues
      const { data: venueData } = await supabase.from("venues").select("*");
      if (venueData) setVenues(venueData);

      // 2. Fetch Featured Talent (DJs, etc)
      const { data: talentData } = await supabase
        .from("profiles")
        .select("id, display_name, username, avatar_url")
        .limit(5); // Pulling top 5 for the spotlight

      if (talentData) setFeaturedTalent(talentData);
    } catch {
      // Silently handle errors
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black pb-32 overflow-x-hidden">
      {/* HEADER SECTION */}
      <div className="p-6 pt-12 flex justify-between items-center">
        <h1 className="text-5xl font-display text-white uppercase tracking-tighter leading-[0.8] mb-2">
          Find <br /> <span className="text-neon-pink">The Vibe</span>
        </h1>
        <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-white/5 flex items-center justify-center">
          <Zap className="w-6 h-6 text-neon-blue fill-neon-blue/20" />
        </div>
      </div>

      {/* SEARCH OVERLAY */}
      <div className="px-6 mb-10">
        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-600 group-focus-within:text-neon-pink transition-colors" />
          <input
            type="text"
            placeholder="Search DJs, Venues, or Events..."
            className="w-full bg-zinc-900/80 border border-white/5 rounded-2xl py-5 pl-12 pr-4 text-sm text-white focus:outline-none focus:ring-1 focus:ring-neon-pink/50 transition-all placeholder:text-zinc-700 backdrop-blur-md"
          />
        </div>
      </div>

      {/* 1. TALENT SPOTLIGHT (Restored & Fixed) */}
      <div className="mb-12">
        <div className="px-6 flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <h2 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em]">Talent Spotlight</h2>
          </div>
          <p
            className="text-[9px] font-bold text-neon-pink uppercase tracking-widest cursor-pointer"
            onClick={() => navigate("/talent-directory")}
          >
            View All
          </p>
        </div>

        <div className="flex overflow-x-auto gap-4 px-6 no-scrollbar snap-x">
          {loading
            ? [1, 2, 3].map((i) => <Skeleton key={i} className="h-72 w-56 shrink-0 rounded-[2.5rem] bg-zinc-900" />)
            : featuredTalent.map((talent) => (
                <div
                  key={talent.id}
                  onClick={() => navigate(`/talent/${talent.id}`)}
                  className="relative h-80 w-64 shrink-0 rounded-[2.5rem] overflow-hidden snap-center border border-white/5 group shadow-2xl"
                >
                  <img
                    src={talent.avatar_url || ""}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                  />
                  {/* Visual Overlays */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/10 to-transparent" />
                  <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                  <div className="absolute bottom-6 left-6 right-6">
                    <div className="flex items-center gap-1 mb-2">
                      <UserCheck className="w-3 h-3 text-neon-blue" />
                      <span className="text-[8px] font-black text-neon-blue uppercase tracking-[0.2em]">
                        Verified Talent
                      </span>
                    </div>
                    <h3 className="text-2xl font-display text-white uppercase tracking-tighter leading-none mb-1">
                      {talent.display_name}
                    </h3>
                    <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">@{talent.username}</p>
                  </div>
                </div>
              ))}
        </div>
      </div>

      {/* 2. VENUE FEED (Bigger, immersive cards) */}
      <div className="px-6 space-y-8">
        <div className="flex items-center gap-2 mb-2">
          <MapPin className="w-4 h-4 text-neon-pink" />
          <h2 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em]">Live Near You</h2>
        </div>

        {loading
          ? [1, 2].map((i) => <Skeleton key={i} className="h-96 w-full rounded-[3rem] bg-zinc-900" />)
          : venues.map((venue) => (
              <div
                key={venue.id}
                onClick={() => navigate(`/venue/${venue.id}`)}
                className="relative h-[28rem] w-full rounded-[3rem] overflow-hidden border border-white/10 group shadow-2xl transition-all"
              >
                <img
                  src={venue.image_url || ""}
                  className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
                />

                {/* Immersive Overlays */}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
                <div className="absolute top-6 right-6">
                  <Badge className="bg-black/60 backdrop-blur-xl border-white/10 text-white text-[9px] font-black tracking-[0.2em] px-4 py-2 rounded-full uppercase">
                    {venue.category || "Nightclub"}
                  </Badge>
                </div>

                <div className="absolute bottom-10 left-10 right-10">
                  <div className="flex justify-between items-end">
                    <div className="space-y-2">
                      <h3 className="text-5xl font-display text-white uppercase tracking-tighter leading-[0.85] drop-shadow-2xl">
                        {venue.name}
                      </h3>
                      <div className="flex items-center gap-2 text-[11px] text-zinc-300 font-bold uppercase tracking-widest">
                        <MapPin className="w-4 h-4 text-neon-pink" />
                        {venue.location}
                      </div>
                    </div>
                    <div className="bg-white/10 backdrop-blur-xl border border-white/20 p-4 rounded-3xl flex items-center gap-2">
                      <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                      <span className="text-white font-black text-sm tracking-tighter">4.9</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
      </div>
    </div>
  );
};

export default Discovery;
