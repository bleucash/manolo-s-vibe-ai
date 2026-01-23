import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { User, Plus, Sparkles, Zap, Share2, MapPin, Radio, Activity } from "lucide-react";
import { CreatePostDialog } from "@/components/CreatePostDialog";
import { useUserMode } from "@/contexts/UserModeContext";
import { formatDistanceToNow } from "date-fns";
import { ActivitySidebar } from "@/components/ActivitySidebar";
import { EmptyFeedState } from "@/components/home/EmptyFeedState";
import { PostWithVenue } from "@/types/database";
import { toast } from "sonner";
import LoadingState from "@/components/ui/LoadingState";
import { cn } from "@/lib/utils";

const ECHO_SIGNALS = ["ENERGY HIGH", "SECTOR CLEARED", "SOUND SYNCED", "ELITE VIBE"];

const Index = () => {
  const navigate = useNavigate();
  const { mode, session, isLoading: contextLoading } = useUserMode();

  const [posts, setPosts] = useState<PostWithVenue[]>([]);
  const [activeNodes, setActiveNodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("GUEST");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [chargedPosts, setChargedPosts] = useState<Set<string>>(new Set());

  const currentUserId = session?.user?.id || null;
  const isCreator = mode === "manager" || mode === "talent";

  useEffect(() => {
    const initializeHome = async () => {
      if (contextLoading) return;
      setLoading(true);
      if (currentUserId) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("username")
          .eq("id", currentUserId)
          .maybeSingle();
        if (profile) setUserName(profile.username?.toUpperCase() || "USER");
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
      .limit(8);
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
    if (!currentUserId) return toast.error("Log in to charge the system.");
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
      toast.error("Neural Sync Error");
    }
  };

  if (loading || contextLoading) return <LoadingState />;

  return (
    <div className="min-h-screen bg-black pb-32 animate-in fade-in duration-700">
      {/* HEADER: NEURAL STATUS */}
      <div className="sticky top-0 z-40 bg-black/80 backdrop-blur-xl border-b border-white/5 px-8 py-6 pt-16 flex justify-between items-center">
        <div>
          <p className="text-[8px] font-black text-zinc-600 uppercase tracking-[0.4em] mb-1">System Greeting</p>
          <h1 className="font-display text-3xl text-white uppercase tracking-tighter italic leading-none">
            Welcome, <span className="text-neon-pink">{userName}</span>
          </h1>
        </div>
        <ActivitySidebar />
      </div>

      {/* ACTIVE NODES (Formerly Stories) */}
      <div className="py-10 border-b border-white/5">
        <div className="px-8 flex items-center gap-2 mb-6">
          <Radio className="w-3 h-3 text-neon-blue animate-pulse" />
          <h2 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em]">Live Intelligence Nodes</h2>
        </div>
        <div className="flex overflow-x-auto gap-8 px-8 no-scrollbar">
          {activeNodes.map((node) => (
            <div
              key={node.id}
              onClick={() => navigate(`/talent/${node.id}`)}
              className="flex flex-col items-center gap-3 shrink-0 group cursor-pointer"
            >
              <div className="relative p-[1px] rounded-2xl bg-zinc-800 group-hover:bg-neon-blue transition-all">
                <Avatar className="w-14 h-14 rounded-[14px] border-2 border-black overflow-hidden">
                  <AvatarImage src={node.avatar_url} className="object-cover" />
                  <AvatarFallback className="bg-zinc-900">
                    <User className="w-4 h-4 text-zinc-700" />
                  </AvatarFallback>
                </Avatar>
                <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-neon-green rounded-full border-2 border-black" />
              </div>
              <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">
                {node.display_name?.split(" ")[0]}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* INTELLIGENCE STREAM */}
      <div className="p-8 space-y-12 max-w-2xl mx-auto">
        {posts.length === 0 ? (
          <EmptyFeedState
            isCreator={isCreator}
            onAction={isCreator ? () => setDialogOpen(true) : () => navigate("/discovery")}
          />
        ) : (
          posts.map((post) => (
            <div key={post.id} className="group animate-in slide-in-from-bottom-4 duration-700">
              {/* POST HEADER */}
              <div className="flex items-center gap-4 mb-5">
                <Avatar className="w-10 h-10 border border-white/5" onClick={() => navigate(`/users/${post.user_id}`)}>
                  <AvatarImage src={post.profiles?.avatar_url || undefined} />
                  <AvatarFallback>
                    <User className="w-4 h-4" />
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h3 className="text-sm font-bold text-white uppercase italic tracking-tight leading-none">
                    {post.profiles?.display_name || "UNKNOWN NODE"}
                  </h3>
                  <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mt-1">
                    {formatDistanceToNow(new Date(post.created_at))} AGO • {post.profiles?.sub_role || "SYSTEM"}
                  </p>
                </div>
                <Button variant="ghost" size="icon" className="text-zinc-700 hover:text-white">
                  <Share2 className="w-4 h-4" />
                </Button>
              </div>

              {/* MEDIA CARD */}
              <Card className="bg-zinc-900/10 border-white/5 overflow-hidden rounded-[2.5rem] relative group/card">
                {post.media_url && (
                  <div className="w-full aspect-square relative">
                    <img
                      src={post.media_url}
                      className="w-full h-full object-cover opacity-80 group-hover/card:opacity-100 transition-opacity duration-700"
                      alt="Transmission"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                  </div>
                )}

                {/* TETHERED GATEWAY (UTILITY) */}
                {post.venues && (
                  <div className="absolute top-6 right-6">
                    <Button
                      size="sm"
                      onClick={() => navigate(`/venue/${post.venues?.id}`)}
                      className="bg-black/60 backdrop-blur-xl border border-white/10 text-white rounded-full text-[8px] font-black uppercase tracking-widest h-8 px-4"
                    >
                      <MapPin className="w-3 h-3 mr-2 text-neon-blue" /> Sector: {post.venues.name}
                    </Button>
                  </div>
                )}

                <CardContent className="p-8">
                  {post.content && (
                    <p className="text-zinc-400 text-sm leading-relaxed font-medium mb-8">{post.content}</p>
                  )}

                  {/* NEURAL INTERACTIONS */}
                  <div className="flex items-center justify-between pt-2 border-t border-white/5">
                    <div className="flex items-center gap-6">
                      {/* THE CHARGE BUTTON */}
                      <div className="flex flex-col items-center gap-1">
                        <button
                          onClick={() => handleChargeToggle(post.id)}
                          className={cn(
                            "w-12 h-12 rounded-2xl flex items-center justify-center transition-all active:scale-90 border",
                            chargedPosts.has(post.id)
                              ? "bg-neon-pink/10 border-neon-pink/40 shadow-[0_0_15px_rgba(255,0,127,0.2)]"
                              : "bg-white/5 border-white/5 text-white hover:border-white/20",
                          )}
                        >
                          <Zap
                            className={cn(
                              "w-5 h-5 transition-all",
                              chargedPosts.has(post.id) ? "text-neon-pink fill-neon-pink" : "text-white",
                            )}
                          />
                        </button>
                        <span className="text-[8px] font-black text-zinc-700 uppercase tracking-widest">Charge</span>
                      </div>

                      {/* ECHO SIGNALS (ANTI-COMMENT) */}
                      <div className="flex gap-2">
                        {ECHO_SIGNALS.map((signal) => (
                          <button
                            key={signal}
                            className="h-8 px-3 rounded-full border border-white/5 bg-white/5 text-[7px] font-black text-zinc-500 uppercase tracking-widest hover:border-white/20 hover:text-white transition-all"
                          >
                            {signal}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ))
        )}
      </div>

      {/* NEURAL CREATION HUB */}
      {isCreator && (
        <button
          onClick={() => setDialogOpen(true)}
          className="fixed bottom-28 right-8 z-40 w-16 h-16 rounded-2xl bg-white text-black shadow-2xl flex items-center justify-center transition-all hover:bg-neon-pink hover:scale-110 active:scale-90 group"
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
