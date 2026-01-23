import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
    if (!currentUserId) return toast.error("Verification Required");
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
    <div className="min-h-screen bg-background pb-32 animate-in fade-in duration-700 hide-scrollbar">
      {/* HUD HEADER */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-background/90 backdrop-blur-xl border-b border-white/5 px-8 h-20 flex justify-between items-center pt-4">
        <div className="flex items-center gap-3">
          <Target className="w-4 h-4 text-neon-blue" />
          <h1 className="font-display text-2xl text-white uppercase tracking-wider italic pt-1">Intel Feed</h1>
        </div>
        <ActivitySidebar />
      </div>

      {/* ACTIVE NODES */}
      <div className="pt-24 pb-6">
        <div className="px-8 flex items-center gap-2 mb-6">
          <Radio className="w-3 h-3 text-neon-green animate-pulse" />
          <h2 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.4em]">Live Intelligence</h2>
        </div>

        <div
          className={cn(
            "flex overflow-x-auto gap-6 px-8 hide-scrollbar scroll-smooth",
            activeNodes.length <= 2 ? "justify-center" : "justify-start",
          )}
        >
          {activeNodes.map((node) => (
            <div
              key={node.id}
              onClick={() => navigate(`/talent/${node.id}`)}
              className="flex flex-col gap-3 shrink-0 group cursor-pointer"
            >
              <div className="relative w-44 h-44 rounded-[2.5rem] bg-card border border-white/5 group-hover:border-neon-blue/50 transition-all duration-700 overflow-hidden shadow-2xl">
                <img
                  src={node.avatar_url || "/placeholder.svg"}
                  className="w-full h-full object-cover opacity-40 group-hover:opacity-100 transition-all duration-700 group-hover:scale-110"
                  alt=""
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
                <div className="absolute bottom-5 left-6 right-6">
                  <p className="font-display text-lg text-white uppercase tracking-wide truncate mb-0.5">
                    {node.display_name}
                  </p>
                  <div className="flex items-center gap-1.5">
                    <div className="w-1 h-1 bg-neon-green rounded-full shadow-[var(--shadow-green)] animate-pulse" />
                    <span className="text-[8px] font-black text-neon-green uppercase tracking-widest">Active</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* FEED */}
      <div className="p-8 space-y-16 max-w-2xl mx-auto">
        {posts.map((post) => (
          <div key={post.id} className="group animate-in slide-in-from-bottom-6 duration-1000">
            <div className="flex items-center gap-4 mb-6 px-2">
              <Avatar className="w-12 h-12 border border-white/5" onClick={() => navigate(`/users/${post.user_id}`)}>
                <AvatarImage src={post.profiles?.avatar_url || undefined} />
                <AvatarFallback className="bg-muted text-muted-foreground">?</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h3 className="font-display text-xl text-white uppercase tracking-wide leading-none">
                  {post.profiles?.display_name || "NODE"}
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">
                    {formatDistanceToNow(new Date(post.created_at))} ago
                  </span>
                  <span className="text-[9px] font-black text-neon-blue uppercase tracking-widest">
                    • {post.profiles?.sub_role || "NEURAL"}
                  </span>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-white transition-colors">
                <Share2 className="w-4 h-4" />
              </Button>
            </div>

            <div
              className={cn(
                "relative rounded-[3.5rem] overflow-hidden bg-card/30 border transition-all duration-1000 shadow-2xl",
                chargedPosts.has(post.id) ? "border-neon-blue shadow-[var(--shadow-neon)]" : "border-white/5",
              )}
            >
              {post.media_url && (
                <div className="w-full aspect-square bg-black overflow-hidden relative">
                  <img
                    src={post.media_url}
                    className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity duration-1000"
                    alt=""
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent opacity-60" />
                  {post.venues && (
                    <button
                      onClick={() => navigate(`/venue/${post.venues?.id}`)}
                      className="absolute top-8 right-8 flex items-center gap-2 bg-background/60 backdrop-blur-md border border-white/10 px-6 py-3 rounded-full hover:bg-neon-blue hover:text-black transition-all shadow-2xl"
                    >
                      <MapPin className="w-3 h-3" />
                      <span className="text-[10px] font-black uppercase tracking-widest">{post.venues.name}</span>
                    </button>
                  )}
                </div>
              )}
              <div className="p-10">
                <p className="text-muted-foreground text-sm leading-relaxed mb-12 font-medium">{post.content}</p>
                <div className="flex items-center justify-between">
                  <div className="flex flex-col items-center gap-2">
                    <button
                      onClick={() => handleChargeToggle(post.id)}
                      className={cn(
                        "w-16 h-16 rounded-[1.5rem] flex items-center justify-center transition-all active:scale-90 border duration-500",
                        chargedPosts.has(post.id)
                          ? "bg-neon-blue/10 border-neon-blue shadow-[var(--shadow-neon)]"
                          : "bg-white/5 border-white/5 text-white",
                      )}
                    >
                      <Zap
                        className={cn(
                          "w-7 h-7 transition-all duration-500",
                          chargedPosts.has(post.id) ? "text-neon-blue fill-neon-blue" : "text-white",
                        )}
                      />
                    </button>
                    <span className="text-[8px] font-black text-muted-foreground uppercase tracking-[0.3em]">
                      Charge Node
                    </span>
                  </div>
                  <div className="flex gap-3">
                    <Badge
                      variant="outline"
                      className="h-10 border-white/5 bg-background/50 text-muted-foreground text-[9px] font-black uppercase tracking-widest px-6 rounded-xl cursor-default"
                    >
                      ENERGY HIGH
                    </Badge>
                    <Badge
                      variant="outline"
                      className="h-10 border-white/5 bg-background/50 text-muted-foreground text-[9px] font-black uppercase tracking-widest px-6 rounded-xl cursor-default"
                    >
                      PEAK VIBE
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {isCreator && (
        <button
          onClick={() => setDialogOpen(true)}
          className="fixed bottom-28 right-10 z-50 w-16 h-16 rounded-[1.5rem] bg-white text-black shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all hover:bg-neon-blue"
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
