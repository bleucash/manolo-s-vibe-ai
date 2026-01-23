import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Heart, MessageCircle, Share2, User, Plus, Sparkles, Zap } from "lucide-react";
import { CreatePostDialog } from "@/components/CreatePostDialog";
import { useUserMode } from "@/contexts/UserModeContext";
import { formatDistanceToNow } from "date-fns";
import { ActivitySidebar } from "@/components/ActivitySidebar";
import { EmptyFeedState } from "@/components/home/EmptyFeedState";
import { FollowButton } from "@/components/profile/FollowButton";
import { PostWithVenue } from "@/types/database";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

const Index = () => {
  const navigate = useNavigate();
  const { mode, session, isLoading: contextLoading } = useUserMode(); // ✅ Use global context

  const [posts, setPosts] = useState<PostWithVenue[]>([]);
  const [spotlightTalent, setSpotlightTalent] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("Guest");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());

  const currentUserId = session?.user?.id || null;
  const isCreator = mode === "manager" || mode === "talent";

  useEffect(() => {
    const initializeHome = async () => {
      if (contextLoading) return;

      setLoading(true);
      if (currentUserId) {
        // Fetch username from profile if logged in
        const { data: profile } = await supabase
          .from("profiles")
          .select("username")
          .eq("id", currentUserId)
          .maybeSingle();
        if (profile) setUserName(profile.username || "User");

        await Promise.all([fetchSpotlight(), fetchFollowerFeed(currentUserId), fetchUserLikes(currentUserId)]);
      } else {
        await fetchSpotlight();
      }
      setLoading(false);
    };
    initializeHome();
  }, [currentUserId, contextLoading]);

  const fetchUserLikes = async (userId: string) => {
    const { data } = await supabase.from("post_likes").select("post_id").eq("user_id", userId);
    if (data) setLikedPosts(new Set(data.map((l) => l.post_id)));
  };

  const fetchSpotlight = async () => {
    const { data: talent } = await supabase
      .from("profiles")
      .select("id, display_name, avatar_url, sub_role")
      .eq("role_type", "talent")
      .limit(10);
    if (talent) setSpotlightTalent(talent);
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

  const handleLikeToggle = async (postId: string) => {
    if (!currentUserId) return toast.error("Please sign in to like posts");
    const isLiked = likedPosts.has(postId);

    setLikedPosts((prev) => {
      const next = new Set(prev);
      isLiked ? next.delete(postId) : next.add(postId);
      return next;
    });

    try {
      if (isLiked) {
        await supabase.from("post_likes").delete().eq("post_id", postId).eq("user_id", currentUserId);
      } else {
        await supabase.from("post_likes").insert({ post_id: postId, user_id: currentUserId });
      }
    } catch (error) {
      toast.error("Sync failure");
    }
  };

  return (
    <div className="min-h-screen bg-black pb-32 animate-in fade-in duration-500">
      <div className="sticky top-0 z-30 bg-black/95 backdrop-blur-md border-b border-white/5 px-6 py-4 flex justify-between items-center pt-16">
        <h1 className="font-display text-2xl text-white tracking-tighter uppercase italic">
          Evening, <span className="text-neon-pink">{userName}</span>
        </h1>
        <ActivitySidebar />
      </div>

      {/* SPOTLIGHT SECTION */}
      <div className="py-8 overflow-hidden">
        <div className="px-6 flex items-center gap-2 mb-6">
          <Sparkles className="w-4 h-4 text-amber-500" />
          <h2 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Neural Spotlight</h2>
        </div>
        <div className="flex overflow-x-auto gap-6 px-6 no-scrollbar">
          {loading
            ? [1, 2, 3, 4].map((i) => <Skeleton key={i} className="w-16 h-16 rounded-full bg-zinc-900 shrink-0" />)
            : spotlightTalent.map((talent) => (
                <div
                  key={talent.id}
                  onClick={() => navigate(`/talent/${talent.id}`)}
                  className="flex flex-col items-center gap-3 shrink-0 cursor-pointer group"
                >
                  <div className="w-16 h-16 rounded-full p-[2px] bg-gradient-to-tr from-neon-pink to-neon-blue transition-transform group-active:scale-90">
                    <div className="w-full h-full rounded-full border-2 border-black overflow-hidden bg-zinc-900">
                      <Avatar className="w-full h-full">
                        <AvatarImage src={talent.avatar_url || ""} className="object-cover" />
                        <AvatarFallback>
                          <User className="w-6 h-6" />
                        </AvatarFallback>
                      </Avatar>
                    </div>
                  </div>
                  <p className="text-[9px] font-bold text-white uppercase truncate w-16 text-center">
                    {talent.display_name?.split(" ")[0] || "Talent"}
                  </p>
                </div>
              ))}
        </div>
      </div>

      {/* FEED SECTION */}
      <div className="p-6 space-y-8">
        {loading ? (
          <Skeleton className="h-96 w-full rounded-[2.5rem] bg-zinc-900" />
        ) : posts.length === 0 ? (
          <EmptyFeedState
            isCreator={isCreator}
            onAction={isCreator ? () => setDialogOpen(true) : () => navigate("/discovery")}
          />
        ) : (
          posts.map((post) => (
            <Card key={post.id} className="bg-zinc-900/40 border-white/5 overflow-hidden rounded-[2rem]">
              <CardHeader className="p-5 flex flex-row items-center gap-4 space-y-0">
                <Avatar
                  className="w-10 h-10 border border-white/10 cursor-pointer"
                  onClick={() => navigate(currentUserId === post.user_id ? "/profile" : `/users/${post.user_id}`)}
                >
                  <AvatarImage src={post.profiles?.avatar_url || undefined} />
                  <AvatarFallback className="bg-zinc-800">
                    <User className="w-4 h-4 text-zinc-500" />
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col flex-1">
                  <span className="text-white font-bold text-sm tracking-tight">
                    {post.profiles?.display_name || "Unknown"}
                  </span>
                  <span className="text-[10px] text-zinc-500 uppercase font-black">
                    {formatDistanceToNow(new Date(post.created_at))} ago
                  </span>
                </div>
                {currentUserId && currentUserId !== post.user_id && (
                  <FollowButton userId={post.user_id} className="ml-auto" />
                )}
              </CardHeader>
              {post.media_url && (
                <div className="w-full aspect-square bg-zinc-950">
                  <img src={post.media_url} className="w-full h-full object-cover" alt="Feed" />
                </div>
              )}
              <CardContent className="p-5">
                <div className="flex items-center gap-6 mb-4">
                  <Heart
                    onClick={() => handleLikeToggle(post.id)}
                    className={`w-7 h-7 cursor-pointer transition-all active:scale-125 ${likedPosts.has(post.id) ? "text-neon-pink fill-neon-pink" : "text-white"}`}
                  />
                  <MessageCircle className="w-7 h-7 text-white" />
                  <Share2 className="w-7 h-7 text-white" />
                </div>
                {post.content && (
                  <p className="text-zinc-300 text-sm leading-relaxed">
                    <span className="font-bold text-white mr-2">{post.profiles?.username}</span>
                    {post.content}
                  </p>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {isCreator && (
        <button
          onClick={() => setDialogOpen(true)}
          className="fixed bottom-28 right-6 z-40 w-16 h-16 rounded-full bg-neon-pink text-black shadow-[0_0_20px_#FF007F] flex items-center justify-center transition-all hover:scale-110 active:scale-90"
        >
          <Plus className="w-8 h-8" />
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
