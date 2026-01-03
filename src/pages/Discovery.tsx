import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Search, Zap, Loader2 } from "lucide-react";
import { VibeFeed } from "@/components/VibeFeed";
import { PostWithVenue } from "@/types/database";
import { toast } from "sonner";

const Discovery = () => {
  const [posts, setPosts] = useState<PostWithVenue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchVibeData();
  }, []);

  const fetchVibeData = async () => {
    try {
      setLoading(true);
      // Fetch posts with joined profile and venue data for B2B attribution
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
      console.error("Discovery Engine Error:", err);
      setError("Failed to synchronize the vibe engine.");
      toast.error("Network synchronization failure.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen bg-black overflow-hidden flex flex-col">
      {/* ⚡ THE DISGUISE: Minimal Branding Header */}
      <div className="p-6 pt-12 flex justify-between items-center bg-gradient-to-b from-black to-transparent z-50 fixed top-0 left-0 right-0 pointer-events-none">
        <div>
          <h1 className="text-3xl font-display text-white uppercase tracking-tighter leading-none mb-1">
            Manolo <br /> <span className="text-neon-pink">Vibe AI</span>
          </h1>
          <p className="text-[8px] font-black text-zinc-500 uppercase tracking-[0.4em]">Live Intelligence</p>
        </div>
        <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center backdrop-blur-md pointer-events-auto cursor-pointer">
          <Search className="w-5 h-5 text-white" />
        </div>
      </div>

      {/* 🚀 THE ENGINE: High-Intensity Video Feed */}
      <div className="flex-1 h-full">
        <VibeFeed posts={posts} isLoading={loading} error={error} />
      </div>

      {/* 🎚️ BOTTOM DECK OVERLAY */}
      <div className="fixed bottom-24 left-6 right-6 z-50 pointer-events-none flex justify-between items-end">
        <div className="bg-black/40 backdrop-blur-xl border border-white/10 px-4 py-2 rounded-full pointer-events-auto">
          <span className="text-[9px] font-black text-white uppercase tracking-widest">
            {posts.length} Global Vibes Active
          </span>
        </div>
        <div className="w-10 h-10 rounded-full bg-neon-pink flex items-center justify-center animate-pulse pointer-events-auto cursor-pointer">
          <Zap className="w-5 h-5 text-black fill-black" />
        </div>
      </div>
    </div>
  );
};

export default Discovery;
