import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button"; // ✅ FIXED: Added missing import
import { Badge } from "@/components/ui/badge"; // ✅ FIXED: Added missing import
import { User, Plus, Zap, Share2, MapPin, Radio, Target } from "lucide-react";
import { CreatePostDialog } from "@/components/CreatePostDialog";
import { useUserMode } from "@/contexts/UserModeContext";
import { formatDistanceToNow } from "date-fns";
import { ActivitySidebar } from "@/components/ActivitySidebar";
import { EmptyFeedState } from "@/components/home/EmptyFeedState";
import { PostWithVenue } from "@/types/database";
import { toast } from "sonner";
import LoadingState from "@/components/ui/LoadingState";
import { cn } from "@/lib/utils";

const Index = () => {
  const navigate = useNavigate();
  const { mode, session, isLoading: contextLoading } = useUserMode();

  const [posts, setPosts] = useState<PostWithVenue[]>([]);
  const [activeNodes, setActiveNodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [chargedPosts, setChargedPosts] = useState<Set<string>>(new Set());

  const currentUserId = session?.user?.id || null;
  const isCreator = mode === "manager" || mode === "talent";

  useEffect(() => {
    const initializeHome = async () => {
      if (contextLoading) return;
      setLoading(true);
      if (currentUserId) {
        await Promise.all([fetchActiveNodes(), fetchFollowerFeed(currentUserId), fetchUserCharges(currentUserId)]);
      } else {
        await fetchActiveNodes();
      }
      setLoading(false);
    };
    initializeHome();
  }, [currentUserId, contextLoading]);

  const fetchUserCharges = async (userId: string) => {
    const { data } = await supabase.from("post_likes").select("post_id").eq("user_id", userId);
    if (data) setChargedPosts(new Set(data.map((l) => l.post_id)));
  };

  const fetchActiveNodes = async () => {
    const { data: talent } = await supabase
      .from("profiles")
      .select("id, display_name, avatar_url, sub_role")
      .eq("role_type", "talent")
      .limit(6);
    if (talent) setActiveNodes(talent);
  };

  const fetchFollowerFeed = async (userId: string) => {
    const { data: follows } = await supabase.from("followers").select("following_id").eq("follower_id", userId);
    const followingIds = follows?.map((f) => f.following_id) || [];
    if (followingIds.length > 0) {
      const { data: postData } = await supabase
        .from("posts")
        .select(
          `*, profiles:user_id (id, display_name, username, avatar_url, sub_role), venues:venue_id (id, name, location)`,
        )
        .in("user_id", followingIds)
        .order("created_at", { ascending: false });
      if (postData) setPosts(postData as PostWithVenue[]);
    }
  };

  const handleChargeToggle = async (postId: string) => {
    if (!currentUserId) return toast.error("Handshake required for charging.");
    const isCharged = chargedPosts.has(postId);
    setChargedPosts((prev) => {
      const next = new Set(prev);
      isCharged ? next.delete(postId) : next.add(postId);
      return next;
    });
    try {
      if (isCharged) await supabase.from("post_likes").delete().eq("post_id", postId).eq("user_id", currentUserId);
      else await supabase.from("post_likes").insert({ post_id: postId, user_id: currentUserId });
    } catch {
      toast.error("Sync Failure");
    }
  };

  if (loading || contextLoading) return <LoadingState />;

  return (
    <div className="min-h-screen bg-black pb-32 animate-in fade-in duration-700">
      {/* HUD HEADER: SLIM & UNIFORM */}
      <div className="fixed top-0 left-0 right-0 z-40 bg-black/90 backdrop-blur-xl border-b border-white/5 px-8 h-20 flex justify-between items-center pt-8">
        <div className="flex items-center gap-3">
          <Target className="w-4 h-4 text-neon-blue" />
          <h1 className="font-display text-xl text-white uppercase tracking-[0.2em] italic">Intel Feed</h1>
        </div>
        <ActivitySidebar />
      </div>

      {/* EXPANDED ACTIVE NODES (LARGE SQUIRCLES) */}
      <div className="pt-28 pb-10 border-b border-white/5">
        <div className="px-8 flex items-center gap-2 mb-8">
          <Radio className="w-3 h-3 text-neon-green animate-pulse" />
          <h2 className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.4em]">Active Nodes</h2>
        </div>
        <div className="flex overflow-x-auto gap-6 px-8 no-scrollbar">
          {activeNodes.map((node) => (
            <div
              key={node.id}
              onClick={() => navigate(`/talent/${node.id}`)}
              className="flex flex-col gap-3 shrink-0 group cursor-pointer"
            >
              <div className="relative w-28 h-28 rounded-[2rem] bg-zinc-900 border border-white/5 group-hover:border-neon-blue/50 transition-all overflow-hidden">
                <img
                  src={node.avatar_url || "/placeholder.svg"}
                  className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity"
                  alt=""
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
                <div className="absolute bottom-3 left-3 flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 bg-neon-green rounded-full shadow-[0_0_8px_#39FF14]" />
                  <span className="text-[7px] font-black text-white uppercase tracking-widest">Live</span>
                </div>
              </div>
              <span className="text-[9px] font-black text-white uppercase tracking-widest italic truncate w-28 px-1">
                {node.display_name || "Unknown"}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* INTELLIGENCE STREAM */}
      <div className="p-8 space-y-16 max-w-2xl mx-auto">
        {posts.length === 0 ? (
          <EmptyFeedState
            isCreator={isCreator}
            onAction={isCreator ? () => setDialogOpen(true) : () => navigate("/discovery")}
          />
        ) : (
          posts.map((post) => (
            <div key={post.id} className="group">
              <div className="flex items-center gap-4 mb-6">
                <Avatar className="w-11 h-11 border border-white/5" onClick={() => navigate(`/users/${post.user_id}`)}>
                  <AvatarImage src={post.profiles?.avatar_url || undefined} />
                  <AvatarFallback className="bg-zinc-900 text-zinc-700">?</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h3 className="text-sm font-bold text-white uppercase italic tracking-tight">
                    {post.profiles?.display_name || "NODE"}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">
                      {formatDistanceToNow(new Date(post.created_at))} ago
                    </span>
                    <span className="w-1 h-1 bg-zinc-800 rounded-full" />
                    <span className="text-[9px] font-black text-neon-blue uppercase tracking-widest">
                      {post.profiles?.sub_role || "NEURAL"}
                    </span>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="text-zinc-800 hover:text-white">
                  <Share2 className="w-4 h-4" />
                </Button>
              </div>

              <div
                className={cn(
                  "relative rounded-[3rem] overflow-hidden bg-zinc-900/10 border transition-all duration-700",
                  chargedPosts.has(post.id)
                    ? "border-neon-blue shadow-[0_0_40px_rgba(0,229,255,0.1)]"
                    : "border-white/5",
                )}
              >
                {post.media_url && (
                  <div className="w-full aspect-square bg-black overflow-hidden relative">
                    <img
                      src={post.media_url}
                      className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity duration-1000"
                      alt=""
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-60" />

                    {post.venues && (
                      <button
                        onClick={() => navigate(`/venue/${post.venues?.id}`)}
                        className="absolute top-6 right-6 flex items-center gap-2 bg-black/60 backdrop-blur-md border border-white/10 px-4 py-2 rounded-full hover:bg-neon-blue hover:text-black transition-all"
                      >
                        <MapPin className="w-3 h-3" />
                        <span className="text-[8px] font-black uppercase tracking-widest">{post.venues.name}</span>
                      </button>
                    )}
                  </div>
                )}

                <div className="p-8">
                  {post.content && (
                    <p className="text-zinc-400 text-sm leading-relaxed mb-8 font-medium">{post.content}</p>
                  )}

                  <div className="flex items-center justify-between">
                    <div className="flex flex-col items-center gap-2">
                      <button
                        onClick={() => handleChargeToggle(post.id)}
                        className={cn(
                          "w-14 h-14 rounded-2xl flex items-center justify-center transition-all active:scale-90 border",
                          chargedPosts.has(post.id)
                            ? "bg-neon-blue/10 border-neon-blue shadow-[0_0_20px_rgba(0,229,255,0.4)]"
                            : "bg-white/5 border-white/5 text-white hover:border-white/20",
                        )}
                      >
                        <Zap
                          className={cn(
                            "w-6 h-6 transition-all",
                            chargedPosts.has(post.id) ? "text-neon-blue fill-neon-blue" : "text-white",
                          )}
                        />
                      </button>
                      <span className="text-[8px] font-black text-zinc-700 uppercase tracking-[0.2em]">VOLTS</span>
                    </div>

                    <div className="flex gap-2">
                      <Badge
                        variant="outline"
                        className="h-8 border-white/5 text-zinc-600 text-[8px] font-black uppercase tracking-widest px-4 rounded-full"
                      >
                        ENERGY HIGH
                      </Badge>
                      <Badge
                        variant="outline"
                        className="h-8 border-white/5 text-zinc-600 text-[8px] font-black uppercase tracking-widest px-4 rounded-full"
                      >
                        SECTOR CLEARED
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {isCreator && (
        <button
          onClick={() => setDialogOpen(true)}
          className="fixed bottom-28 right-8 z-40 w-16 h-16 rounded-2xl bg-white text-black shadow-2xl flex items-center justify-center hover:scale-110 active:scale-90 transition-all group"
        >
          <Plus className="w-8 h-8 group-hover:rotate-90 transition-transform duration-500" />
        </button>
      )}

      <CreatePostDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onPostCreated={() => fetchFollowerFeed(currentUserId || "")}
      />
    </div>
  );
};

export default Index;
