import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Loader2, Heart, MessageCircle, Share2, User, Plus } from "lucide-react";
import { CreatePostDialog } from "@/components/CreatePostDialog";
import { useUserMode } from "@/contexts/UserModeContext";
import { formatDistanceToNow } from "date-fns";
import { ActivitySidebar } from "@/components/ActivitySidebar";
import { EmptyFeedState } from "@/components/home/EmptyFeedState";
import { FollowButton } from "@/components/profile/FollowButton";

interface ProfileData {
  username: string | null;
  avatar_url: string | null;
  display_name: string | null;
}

interface PostItem {
  id: string;
  image_url: string | null;
  caption: string | null;
  created_at: string;
  likes_count: number;
  user_id: string;
  profiles: ProfileData | ProfileData[] | null;
}

// Helper to get profile data from join result
const getProfile = (profiles: ProfileData | ProfileData[] | null): ProfileData | null => {
  if (!profiles) return null;
  if (Array.isArray(profiles)) return profiles[0] || null;
  return profiles;
};

const Index = () => {
  const navigate = useNavigate();
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("Guest");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const { mode } = useUserMode();

  // Managers and talent users can create posts
  const isCreator = mode === "manager" || mode === "talent";

  useEffect(() => {
    fetchUserName();
  }, []);

  const fetchUserName = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      setCurrentUserId(user.id);

      // Get user profile for header greeting
      const { data: profile } = await supabase.from("profiles").select("username").eq("id", user.id).maybeSingle();

      if (profile) {
        setUserName(profile.username || "User");
      }
    } catch (error) {
      console.error("Error fetching username:", error);
    } finally {
      setLoading(false);
    }
  };

  const getTimeAgo = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch {
      return "Just now";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-neon-green" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* HEADER */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-md border-b border-border px-4 py-3 flex justify-between items-center">
        <h1 className="font-display text-xl text-foreground tracking-wide">
          Good Evening, <span className="text-accent">{userName}</span>
        </h1>
        <ActivitySidebar />
      </div>

      {/* FEED CONTENT */}
      <div className="p-4 space-y-6">
        {posts.length === 0 ? (
          <EmptyFeedState
            isCreator={isCreator}
            onAction={isCreator ? () => setDialogOpen(true) : () => navigate("/discovery")}
          />
        ) : (
          /* POSTS FEED */
          posts.map((post) => {
            const profile = getProfile(post.profiles);
            return (
              <Card key={post.id} className="bg-card/40 border-border overflow-hidden">
                {/* Post Header */}
                <CardHeader className="p-4 flex flex-row items-center gap-3 space-y-0">
                  <Avatar
                    className="w-10 h-10 border border-border cursor-pointer"
                    onClick={() => navigate(currentUserId === post.user_id ? "/profile" : `/users/${post.user_id}`)}
                  >
                    <AvatarImage src={profile?.avatar_url || undefined} />
                    <AvatarFallback className="bg-secondary">
                      <User className="w-4 h-4 text-muted-foreground" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col flex-1">
                    <span
                      className="text-foreground font-bold text-sm cursor-pointer hover:underline"
                      onClick={() => navigate(currentUserId === post.user_id ? "/profile" : `/users/${post.user_id}`)}
                    >
                      {profile?.display_name || profile?.username || "Unknown"}
                    </span>
                    <span className="text-xs text-muted-foreground">{getTimeAgo(post.created_at)}</span>
                  </div>
                  {currentUserId && currentUserId !== post.user_id && (
                    <FollowButton userId={post.user_id} className="ml-auto" />
                  )}
                </CardHeader>

                {/* Post Image */}
                {post.image_url && (
                  <div className="w-full aspect-square bg-background relative">
                    <img
                      src={post.image_url}
                      alt="Post"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = "/placeholder.svg";
                      }}
                    />
                  </div>
                )}

                {/* Actions */}
                <CardContent className="p-4 pb-2">
                  <div className="flex items-center gap-4 mb-3">
                    <Heart className="w-6 h-6 text-foreground hover:text-pink-500 cursor-pointer transition-colors" />
                    <MessageCircle className="w-6 h-6 text-foreground hover:text-accent cursor-pointer transition-colors" />
                    <Share2 className="w-6 h-6 text-foreground hover:text-primary cursor-pointer transition-colors" />
                    <span className="ml-auto text-sm text-muted-foreground">
                      {post.likes_count > 0 && `${post.likes_count} likes`}
                    </span>
                  </div>

                  {/* Caption */}
                  {post.caption && (
                    <p className="text-foreground text-sm">
                      <span className="font-bold mr-2">{profile?.username || "Unknown"}</span>
                      {post.caption}
                    </p>
                  )}
                </CardContent>

                <CardFooter className="p-4 pt-0">
                  <p className="text-muted-foreground text-xs uppercase tracking-wider font-medium cursor-pointer hover:text-foreground">
                    View all comments
                  </p>
                </CardFooter>
              </Card>
            );
          })
        )}
      </div>

      {/* FLOATING ACTION BUTTON - Managers & Talent */}
      {isCreator && (
        <button
          onClick={() => setDialogOpen(true)}
          className="fixed bottom-24 right-4 z-40 w-14 h-14 rounded-full bg-pink-500 hover:bg-pink-600 text-white shadow-lg flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
          aria-label="Create Post"
        >
          <Plus className="w-7 h-7" />
        </button>
      )}

      {/* Create Post Dialog */}
      <CreatePostDialog open={dialogOpen} onOpenChange={setDialogOpen} onPostCreated={() => {}} />
    </div>
  );
};

export default Index;
