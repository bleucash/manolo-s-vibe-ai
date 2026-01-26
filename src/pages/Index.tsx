import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Zap, Share2, MapPin, Radio, Activity } from "lucide-react";
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
        // Parallel sync of Followed Live Nodes and Feed
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

  // Logic: Show Talent/Venues you follow who are currently "Live"
  const fetchFollowedLiveNodes = async (userId: string) => {
    const { data: followedTalent } = await supabase
      .from("followers")
      .select(`profiles!following_id (id, display_name, avatar_url, venue_id)`)
      .eq("follower_id", userId);

    const { data: followedVenues } = await supabase
      .from("venue_followers")
      .select(`venues (id, name, image_url)`)
      .eq("follower_id", userId);

    // Filter only those who are active/live in the last 24h cycle
    const activeNodes = [
      ...(followedTalent?.map((f) => f.profiles).filter((p) => p.venue_id) || []),
      ...(followedVenues?.map((v) => ({ ...v.venues, isVenue: true })) || []),
    ];

    setLiveNodes(activeNodes);
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

    // Optimistic UI Update
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
          // Feed the global Heat Index log
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
    <div className="min-h-screen bg-black pb-32 animate-in fade-in duration-700 hide-scrollbar">
      {/* 🛠 COMMAND PORTAL HUD (Re-integrated ActivitySidebar) */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-xl border-b border-white/5 px-8 h-20 flex justify-between items-center pt-4">
        <div className="flex items-center gap-3">
          <Activity className="w-4 h-4 text-neon-purple animate-pulse" />
          <h1 className="font-display text-2xl text-white uppercase tracking-wider italic pt-1 leading-none">
            The Radar
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <ActivitySidebar /> {/* The Notification Bell/Drawer returns here */}
        </div>
      </div>

      {/* LIVE INTELLIGENCE STRIP */}
      <div className="pt-24 pb-6 border-b border-white/5 bg-zinc-950/20">
        <div className="px-8 flex items-center gap-2 mb-6">
          <Radio className="w-3 h-3 text-neon-green animate-pulse" />
          <h2 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.4em]">Live Intelligence</h2>
        </div>

        <div className="flex overflow-x-auto gap-6 px-8 hide-scrollbar scroll-smooth">
          {liveNodes.map((node) => (
            <div
              key={node.id}
              onClick={() => navigate(node.isVenue ? `/venue/${node.id}` : `/talent/${node.id}`)}
              className="flex flex-col gap-3 shrink-0 group cursor-pointer"
            >
              <div className="relative w-20 h-20 rounded-full border-2 border-neon-blue p-1 transition-all duration-500 hover:scale-110">
                <div className="w-full h-full rounded-full overflow-hidden border border-white/10">
                  <img
                    src={node.avatar_url || node.image_url || "/placeholder.svg"}
                    className="w-full h-full object-cover"
                    alt=""
                  />
                </div>
                <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-black border border-white/20 rounded-full flex items-center justify-center">
                  <div className="w-2 h-2 bg-neon-green rounded-full animate-pulse" />
                </div>
              </div>
              <span className="text-[9px] font-black text-white uppercase tracking-widest text-center truncate w-20 opacity-60">
                {node.display_name || node.name}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* COMMUNITY CHARGE FEED */}
      <div className="p-8 space-y-16 max-w-2xl mx-auto">
        {posts.length === 0 ? (
          <div className="h-[40vh] flex flex-col items-center justify-center text-center px-12">
            <p className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.4em] mb-6">
              No Neural Connections Detected
            </p>
            <Button
              onClick={() => navigate("/discovery")}
              className="bg-white text-black font-black uppercase text-[10px] tracking-widest px-8 h-12 rounded-2xl"
            >
              Initialize Discovery
            </Button>
          </div>
        ) : (
          posts.map((post) => (
            <div key={post.id} className="group animate-in slide-in-from-bottom-6 duration-1000">
              {/* Post Metadata Header... */}
              {/* Media Content with Shadow Neon interaction... */}
              <div className="p-10 border border-white/5 rounded-[2.5rem] bg-zinc-950/40 backdrop-blur-sm">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col items-center gap-2">
                    <button
                      onClick={() => handleChargeInteraction(post.id)}
                      className={cn(
                        "w-16 h-16 rounded-2xl flex items-center justify-center transition-all active:scale-90 border duration-500",
                        chargedPosts.has(post.id)
                          ? "bg-neon-blue/10 border-neon-blue text-neon-blue shadow-[0_0_20px_#00B7FF]"
                          : "bg-white/5 border-white/5 text-white",
                      )}
                    >
                      <Zap className={cn("w-7 h-7", chargedPosts.has(post.id) && "fill-neon-blue")} />
                    </button>
                    <span className="text-[8px] font-black text-muted-foreground uppercase tracking-[0.3em]">
                      Charge
                    </span>
                  </div>
                  <Badge className="bg-zinc-900 text-zinc-500 border-white/5 font-black uppercase text-[9px] px-6 h-10 rounded-xl">
                    Follower Intelligence
                  </Badge>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {isCreator && (
        <button
          onClick={() => setDialogOpen(true)}
          className="fixed bottom-32 right-10 z-50 w-16 h-16 rounded-2xl bg-white text-black shadow-2xl flex items-center justify-center hover:bg-neon-blue transition-all"
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
