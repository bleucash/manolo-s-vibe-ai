import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Search, Zap, User, MapPin } from "lucide-react";
import { PostWithVenue } from "@/types/database";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const Discovery = () => {
  const navigate = useNavigate();
  const [posts, setPosts] = useState<PostWithVenue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchVibeData();
  }, []);

  const fetchVibeData = async () => {
    try {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from("posts")
        .select(
          `
          *,
          profiles:user_id (id, display_name, username, avatar_url, sub_role),
          venues:venue_id (id, name, location)
        `,
        )
        .order("created_at", { ascending: false });

      if (fetchError) throw fetchError;
      setPosts((data as PostWithVenue[]) || []);
    } catch (err: any) {
      setError("Failed to synchronize the vibe engine.");
      toast.error("Network synchronization failure.");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return null;
  }

  return (
    <div className="min-h-screen bg-black flex flex-col animate-in fade-in duration-500 pb-24">
      {/* HEADER */}
      <div className="p-6 pt-12 flex justify-between items-center bg-gradient-to-b from-black to-transparent z-50 sticky top-0 left-0 right-0">
        <div>
          <h1 className="text-3xl font-display text-white uppercase tracking-tighter leading-none mb-1">
            Manolo <br /> <span className="text-neon-pink">Vibe AI</span>
          </h1>
          <p className="text-[8px] font-black text-zinc-500 uppercase tracking-[0.4em]">Live Intelligence</p>
        </div>
        <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center backdrop-blur-md cursor-pointer transition-transform active:scale-90">
          <Search className="w-5 h-5 text-white" />
        </div>
      </div>

      {/* DISCOVERY GRID - Replacing VibeFeed */}
      <div className="flex-1 px-4 overflow-y-auto">
        {error ? (
          <div className="h-64 flex items-center justify-center text-zinc-500 font-display uppercase tracking-widest text-[10px]">
            {error}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {posts.map((post) => (
              <Card
                key={post.id}
                className="relative aspect-[3/4] overflow-hidden border-white/5 bg-zinc-900 group cursor-pointer"
                onClick={() => navigate(`/venue/${post.venue_id}`)}
              >
                {post.media_url ? (
                  post.media_url.endsWith(".mp4") || post.media_url.includes("video") ? (
                    <video src={post.media_url} className="w-full h-full object-cover" muted playsInline />
                  ) : (
                    <img src={post.media_url} className="w-full h-full object-cover" alt="Discovery" />
                  )
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-zinc-800">
                    <Zap className="w-6 h-6 text-zinc-700" />
                  </div>
                )}

                {/* OVERLAY INFO */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-100 p-3 flex flex-col justify-end">
                  <div className="flex items-center gap-2 mb-1">
                    <Avatar className="w-5 h-5 border border-white/10">
                      <AvatarImage src={post.profiles?.avatar_url || undefined} />
                      <AvatarFallback>
                        <User className="w-3 h-3 text-white" />
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-[8px] font-black text-white uppercase truncate">
                      {post.venues?.name || "Unknown Venue"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-zinc-400">
                    <MapPin className="w-2 h-2 text-neon-pink" />
                    <span className="text-[7px] font-bold uppercase tracking-widest truncate">
                      {post.venues?.location || "Live"}
                    </span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* BOTTOM DECK OVERLAY */}
      <div className="fixed bottom-24 left-6 right-6 z-50 pointer-events-none flex justify-between items-end">
        <div className="bg-black/40 backdrop-blur-xl border border-white/10 px-4 py-2 rounded-full pointer-events-auto">
          <span className="text-[9px] font-black text-white uppercase tracking-widest">
            {posts.length} Global Vibes Active
          </span>
        </div>
        <div className="w-10 h-10 rounded-full bg-neon-pink flex items-center justify-center animate-pulse pointer-events-auto cursor-pointer shadow-[0_0_15px_rgba(255,16,140,0.3)]">
          <Zap className="w-5 h-5 text-black fill-black" />
        </div>
      </div>
    </div>
  );
};

export default Discovery;
