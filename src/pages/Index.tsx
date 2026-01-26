import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Plus, Zap, Share2, MapPin, Radio, Activity, Target } from "lucide-react";
import { CreatePostDialog } from "@/components/CreatePostDialog";
import { useUserMode } from "@/contexts/UserModeContext";
import { formatDistanceToNow } from "date-fns";
import { ActivitySidebar } from "@/components/ActivitySidebar";
import { PostWithVenue } from "@/types/database";
import { toast } from "sonner";
import LoadingState from "@/components/ui/LoadingState";
import { cn } from "@/lib/utils";

const Index = () => {
  const navigate = useNavigate();
  const { mode, session, isLoading: contextLoading } = useUserMode();

  const [posts, setPosts] = useState<PostWithVenue[]>([]);
  const [liveNodes, setLiveNodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [chargedPosts, setChargedPosts] = useState<Set<string>>(new Set());

  const currentUserId = session?.user?.id || null;
  const isCreator = mode === "manager" || mode === "talent";

  useEffect(() => {
    const initializeRadar = async () => {
      if (contextLoading) return;
      setLoading(true);
      if (currentUserId) {
        await Promise.all([
          fetchFollowedLiveNodes(currentUserId),
          fetchFollowerFeed(currentUserId),
          fetchUserCharges(currentUserId),
        ]);
      }
      setLoading(false);
    };
    initializeRadar();
  }, [currentUserId, contextLoading]);

  const fetchUserCharges = async (userId: string) => {
    const { data } = await supabase.from("post_likes").select("post_id").eq("user_id", userId);
    if (data) setChargedPosts(new Set(data.map((l) => l.post_id)));
  };

  const fetchFollowedLiveNodes = async (userId: string) => {
    try {
      // 1. Fetch followed Talent
      const { data: followedTalent } = await supabase
        .from("followers")
        .select(`profiles:following_id (id, display_name, avatar_url, venue_id)`)
        .eq("follower_id", userId);

      // 2. Fetch followed Venues (Sectors)
      const { data: followedVenues } = await supabase
        .from("venue_followers")
        .select(`venues (id, name, image_url)`)
        .eq("follower_id", userId);

      // 3. Cast and filter for 'Live' status (venue_id is present)
      const activeTalent = (followedTalent || []).map((f) => f.profiles as any).filter((p) => p && p.venue_id);

      const activeVenues = (followedVenues || []).map((v) => ({ ...(v.venues as any), isVenue: true }));

      setLiveNodes([...activeTalent, ...activeVenues]);
    } catch (error) {
      console.error("Radar Node Sync Error:", error);
    }
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

  const handleChargeInteraction = async (postId: string) => {
    if (!currentUserId) return toast.error("Verification Required");
    const isCharged = chargedPosts.has(postId);
    setChargedPosts((prev) => {
      const next = new Set(prev);
      isCharged ? next.delete(postId) : next.add(postId);
      return next;
    });
    try {
      if (isCharged) {
        await supabase.from("post_likes").delete().eq("post_id", postId).eq("user_id", currentUserId);
      } else {
        await Promise.all([
          supabase.from("post_likes").insert({ post_id: postId, user_id: currentUserId }),
          supabase.from("interactions").insert({
            user_id: currentUserId,
            target_id: postId,
            target_type: "post",
            interaction_type: "charge",
          }),
        ]);
      }
    } catch {
      toast.error("Handshake Sync Failure");
    }
  };

  if (loading || contextLoading) return <LoadingState />;

  return (
    <div className="min-h-screen bg-black pb-32 animate-in fade-in duration-700 overflow-y-auto hide-scrollbar">
      {/* 🛠 GLASS HUD */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-black/40 backdrop-blur-md border-b border-white/5 px-8 h-20 flex justify-between items-center pt-4">
        <div className="flex items-center gap-3">
          <Activity className="w-4 h-4 text-neon-purple animate-pulse" />
          <h1 className="font-display text-2xl text-white uppercase tracking-wider italic pt-1 leading-none">
            The Radar
          </h1>
        </div>
        <ActivitySidebar />
      </div>

      {/* LIVE INTELLIGENCE STRIP */}
      <div className="pt-28 pb-8 border-b border-white/5 bg-zinc-950/20">
        <div className="px-8 flex items-center gap-2 mb-6">
          <Radio className="w-3 h-3 text-neon-green animate-pulse" />
          <h2 className="text-[10px] font-black text-white/40 uppercase tracking-[0.4em]">Live Intelligence</h2>
        </div>

        <div className="flex overflow-x-auto gap-6 px-8 hide-scrollbar scroll-smooth">
          {liveNodes.length > 0
            ? liveNodes.map((node) => (
                <div
                  key={node.id}
                  onClick={() => navigate(node.isVenue ? `/venue/${node.id}` : `/talent/${node.id}`)}
                  className="flex flex-col gap-3 shrink-0 group cursor-pointer"
                >
                  <div className="relative w-20 h-20 rounded-full border-2 border-neon-blue p-1 transition-all duration-500 hover:scale-110 shadow-[0_0_15px_rgba(0,183,255,0.2)]">
                    <div className="w-full h-full rounded-full overflow-hidden border border-white/10 bg-zinc-900">
                      <img
                        src={node.avatar_url || node.image_url || "/placeholder.svg"}
                        className="w-full h-full object-cover"
                        alt=""
                      />
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-black border border-white/20 rounded-full flex items-center justify-center">
                      <div className="w-2 h-2 bg-neon-green rounded-full animate-pulse shadow-[0_0_8px_#39FF14]" />
                    </div>
                  </div>
                  <span className="text-[9px] font-black text-white uppercase tracking-widest text-center truncate w-20 opacity-60 italic">
                    {node.display_name || node.name}
                  </span>
                </div>
              ))
            : // NEURAL SKELETONS
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex flex-col gap-3 shrink-0 animate-pulse">
                  <div className="w-20 h-20 rounded-full bg-zinc-900 border border-white/5 relative">
                    <div className="absolute inset-0 rounded-full border border-white/5" />
                  </div>
                  <div className="h-2 w-12 bg-zinc-900 rounded self-center" />
                </div>
              ))}
        </div>
      </div>

      {/* COMMUNITY CHARGE FEED */}
      <div className="p-8 space-y-20 max-w-2xl mx-auto">
        {posts.length === 0 ? (
          <div className="h-[40vh] flex flex-col items-center justify-center text-center px-12 pt-20">
            <div className="w-16 h-16 rounded-3xl bg-zinc-900/50 flex items-center justify-center mb-8 border border-white/5">
              <Target className="w-6 h-6 text-zinc-700" />
            </div>
            <p className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.4em] mb-8 leading-relaxed">
              No Neural Connections Detected in this Sector
            </p>
            <button
              onClick={() => navigate("/discovery")}
              className="bg-white text-black font-black uppercase text-[10px] tracking-widest px-10 h-14 rounded-2xl hover:bg-neon-blue transition-all active:scale-95 shadow-xl"
            >
              Initialize Discovery
            </button>
          </div>
        ) : (
          posts.map((post) => (
            <div key={post.id} className="group animate-in slide-in-from-bottom-12 duration-1000">
              <div className="flex items-center gap-4 mb-6 px-2">
                <Avatar
                  className="w-12 h-12 border border-white/5 cursor-pointer"
                  onClick={() => navigate(`/users/${post.user_id}`)}
                >
                  <AvatarImage src={post.profiles?.avatar_url || undefined} />
                  <AvatarFallback className="bg-zinc-900 text-zinc-500 text-[10px]">UP</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h3 className="font-display text-xl text-white uppercase tracking-wide leading-none italic">
                    {post.profiles?.display_name || "NODE"}
                  </h3>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[9px] font-black text-white/30 uppercase tracking-widest italic">
                      {formatDistanceToNow(new Date(post.created_at))} ago
                    </span>
                    <span className="text-[9px] font-black text-neon-blue uppercase tracking-widest italic opacity-80">
                      • {post.profiles?.sub_role || "UPLINK"}
                    </span>
                  </div>
                </div>
                <button className="text-zinc-600 hover:text-white transition-colors">
                  <Share2 className="w-4 h-4" />
                </button>
              </div>

              <div
                className={cn(
                  "relative rounded-[3.5rem] overflow-hidden bg-zinc-950 border transition-all duration-1000 shadow-2xl group",
                  chargedPosts.has(post.id) ? "border-neon-blue/50" : "border-white/5",
                )}
              >
                {post.media_url && (
                  <div className="w-full aspect-square overflow-hidden relative">
                    <img
                      src={post.media_url}
                      className="w-full h-full object-cover opacity-60 group-hover:opacity-90 transition-all duration-1000 group-hover:scale-105"
                      alt=""
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-80" />

                    {post.venues && (
                      <button
                        onClick={() => navigate(`/venue/${post.venues?.id}`)}
                        className="absolute top-8 right-8 flex items-center gap-2 bg-black/60 backdrop-blur-md border border-white/10 px-6 py-3 rounded-full hover:bg-neon-blue hover:text-black transition-all shadow-2xl"
                      >
                        <MapPin className="w-3 h-3" />
                        <span className="text-[10px] font-black uppercase tracking-widest">{post.venues.name}</span>
                      </button>
                    )}
                  </div>
                )}

                <div className="p-10 pt-6">
                  <p className="text-zinc-400 text-sm leading-relaxed mb-10 font-medium italic opacity-80">
                    {post.content}
                  </p>
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col items-center gap-2">
                      <button
                        onClick={() => handleChargeInteraction(post.id)}
                        className={cn(
                          "w-16 h-16 rounded-[1.5rem] flex items-center justify-center transition-all active:scale-90 border duration-500",
                          chargedPosts.has(post.id)
                            ? "bg-neon-blue/10 border-neon-blue text-neon-blue shadow-[0_0_20px_#00B7FF30]"
                            : "bg-white/5 border-white/5 text-white",
                        )}
                      >
                        <Zap className={cn("w-7 h-7 transition-all", chargedPosts.has(post.id) && "fill-neon-blue")} />
                      </button>
                      <span className="text-[8px] font-black text-zinc-600 uppercase tracking-[0.3em] mt-1">
                        Charge
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <Badge className="bg-zinc-900/80 text-zinc-500 border-white/5 font-black uppercase text-[8px] px-5 h-9 rounded-xl tracking-widest">
                        TRANSMISSION
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
          className="fixed bottom-32 right-10 z-50 w-16 h-16 rounded-[1.5rem] bg-white text-black shadow-2xl flex items-center justify-center hover:bg-neon-blue transition-all hover:scale-110 active:scale-95"
        >
          <Plus className="w-8 h-8" />
        </button>
      )}

      <CreatePostDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onPostCreated={() => currentUserId && fetchFollowerFeed(currentUserId)}
      />
    </div>
  );
};

export default Index;
