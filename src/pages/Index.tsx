import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Heart, MessageCircle, Share2, User, Plus, Sparkles } from "lucide-react";
import { CreatePostDialog } from "@/components/CreatePostDialog";
import { useUserMode } from "@/contexts/UserModeContext";
import { formatDistanceToNow } from "date-fns";
import { ActivitySidebar } from "@/components/ActivitySidebar";
import { EmptyFeedState } from "@/components/home/EmptyFeedState";
import { FollowButton } from "@/components/profile/FollowButton";
import { PostWithVenue } from "@/types/database";

const Index = () => {
  const navigate = useNavigate();
  const [posts, setPosts] = useState<PostWithVenue[]>([]);
  const [spotlightTalent, setSpotlightTalent] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("Guest");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const { mode } = useUserMode();

  // Managers and talent users can create posts
  const isCreator = mode === "manager" || mode === "talent";

  useEffect(() => {
    const initializeHome = async () => {
      // Keep the "Neural Engine" visible while we aggregate all data
      setLoading(true);
      await Promise.all([fetchUserSession(), fetchSpotlight(), fetchFollowerFeed()]);
      setLoading(false);
    };
    initializeHome();
  }, []);

  const fetchUserSession = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      setCurrentUserId(user.id);
      const { data: profile } = await supabase.from("profiles").select("username").eq("id", user.id).maybeSingle();

      if (profile) setUserName(profile.username || "User");
    } catch (error) {
      console.error("Session Error:", error);
    }
  };

  const fetchSpotlight = async () => {
    try {
      const { data: talent } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url, sub_role")
        .eq("role_type", "talent")
        .limit(10);
      if (talent) setSpotlightTalent(talent);
    } catch (error) {
      console.error("Spotlight Error:", error);
    }
  };

  const fetchFollowerFeed = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: follows } = await supabase.from("followers").select("following_id").eq("follower_id", user.id);
      const followingIds = follows?.map((f) => f.following_id) || [];

      if (followingIds.length > 0) {
        const { data: postData } = await supabase
          .from("posts")
          .select(
            `
            *,
            profiles:user_id (id, display_name, username, avatar_url, sub_role),
            venues:venue_id (id, name, location)
          `,
          )
          .in("user_id", followingIds)
          .order("created_at", { ascending: false });

        if (postData) setPosts(postData as PostWithVenue[]);
      }
    } catch (error) {
      console.error("Feed Error:", error);
    }
  };

  const getTimeAgo = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch {
      return "Just now";
    }
  };

  // ✅ UNIFIED LOADING STRATEGY:
  // Returning null allows the ProtectedRoute's LoadingState (Big Green Circle)
  // to persist until this component is fully ready to display.
  if (loading) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background pb-24 animate-in fade-in duration-500">
      {/* HEADER */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-md border-b border-border px-4 py-3 flex justify-between items-center">
        <h1 className="font-display text-xl text-foreground tracking-wide">
          Good Evening, <span className="text-accent">{userName}</span>
        </h1>
        <ActivitySidebar />
      </div>

      {/* TALENT SPOTLIGHT */}
      <div className="py-6 overflow-hidden">
        <div className="px-4 flex items-center gap-2 mb-4">
          <Sparkles className="w-4 h-4 text-amber-500" />
          <h2 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Talent Spotlight</h2>
        </div>
        <div className="flex overflow-x-auto gap-4 px-4 no-scrollbar">
          {spotlightTalent.map((talent) => (
            <div
              key={talent.id}
              onClick={() => navigate(`/talent/${talent.id}`)}
              className="flex flex-col items-center gap-2 shrink-0 cursor-pointer"
            >
              <div className="w-16 h-16 rounded-full p-[2px] bg-gradient-to-tr from-neon-pink to-neon-blue">
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

      {/* FEED CONTENT */}
      <div className="p-4 space-y-6">
        {posts.length === 0 ? (
          <EmptyFeedState
            isCreator={isCreator}
            onAction={isCreator ? () => setDialogOpen(true) : () => navigate("/discovery")}
          />
        ) : (
          posts.map((post) => (
            <Card key={post.id} className="bg-card/40 border-border overflow-hidden shadow-sm">
              <CardHeader className="p-4 flex flex-row items-center gap-3 space-y-0">
                <Avatar
                  className="w-10 h-10 border border-border cursor-pointer"
                  onClick={() => navigate(currentUserId === post.user_id ? "/profile" : `/users/${post.user_id}`)}
                >
                  <AvatarImage src={post.profiles?.avatar_url || undefined} />
                  <AvatarFallback className="bg-secondary">
                    <User className="w-4 h-4 text-muted-foreground" />
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col flex-1">
                  <span
                    className="text-foreground font-bold text-sm cursor-pointer hover:underline"
                    onClick={() => navigate(currentUserId === post.user_id ? "/profile" : `/users/${post.user_id}`)}
                  >
                    {post.profiles?.display_name || post.profiles?.username || "Unknown"}
                  </span>
                  <span className="text-xs text-muted-foreground">{getTimeAgo(post.created_at)}</span>
                </div>
                {currentUserId && currentUserId !== post.user_id && (
                  <FollowButton userId={post.user_id} className="ml-auto" />
                )}
              </CardHeader>

              {post.media_url && (
                <div className="w-full aspect-square bg-background relative">
                  {post.media_url.endsWith(".mp4") || post.media_url.includes("video") ? (
                    <video src={post.media_url} className="w-full h-full object-cover" muted playsInline />
                  ) : (
                    <img src={post.media_url} className="w-full h-full object-cover" alt="Post" />
                  )}
                </div>
              )}

              <CardContent className="p-4 pb-2">
                <div className="flex items-center gap-4 mb-3">
                  <Heart className="w-6 h-6 text-foreground hover:text-pink-500 cursor-pointer transition-colors" />
                  <MessageCircle className="w-6 h-6 text-foreground hover:text-accent cursor-pointer transition-colors" />
                  <Share2 className="w-6 h-6 text-foreground hover:text-primary cursor-pointer transition-colors" />
                  <span className="ml-auto text-sm text-muted-foreground">
                    {post.likes_count ? `${post.likes_count} likes` : ""}
                  </span>
                </div>
                {post.content && (
                  <p className="text-foreground text-sm">
                    <span className="font-bold mr-2">{post.profiles?.username || "Unknown"}</span>
                    {post.content}
                  </p>
                )}
              </CardContent>

              <CardFooter className="p-4 pt-0">
                <p className="text-muted-foreground text-xs uppercase tracking-wider font-medium cursor-pointer hover:text-foreground">
                  View all comments
                </p>
              </CardFooter>
            </Card>
          ))
        )}
      </div>

      {isCreator && (
        <button
          onClick={() => setDialogOpen(true)}
          className="fixed bottom-24 right-4 z-40 w-14 h-14 rounded-full bg-pink-500 hover:bg-pink-600 text-white shadow-lg flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
        >
          <Plus className="w-7 h-7" />
        </button>
      )}

      <CreatePostDialog open={dialogOpen} onOpenChange={setDialogOpen} onPostCreated={fetchFollowerFeed} />
    </div>
  );
};

export default Index;
