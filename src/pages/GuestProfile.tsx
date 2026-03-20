import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserMode } from "@/contexts/UserModeContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { FollowButton } from "@/components/profile/FollowButton";
import { useFollow } from "@/hooks/useFollow";
import { ArrowLeft, User, Users, MessageSquare } from "lucide-react";
import { toast } from "sonner";

interface GuestProfileData {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  bio: string | null;
}

const GuestProfile = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { session } = useUserMode();
  const [profile, setProfile] = useState<GuestProfileData | null>(null);
  const [followingCount, setFollowingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const { isFollowing } = useFollow(id || "");

  const isSelf = session?.user?.id === id;

  useEffect(() => {
    if (!id) return;

    const fetchData = async () => {
      setLoading(true);
      const [profileRes, followingRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, display_name, username, avatar_url, bio")
          .eq("id", id)
          .single(),
        supabase
          .from("followers")
          .select("id", { count: "exact", head: true })
          .eq("follower_id", id),
      ]);

      if (profileRes.data) setProfile(profileRes.data);
      if (followingRes.count !== null) setFollowingCount(followingRes.count);
      setLoading(false);
    };

    fetchData();
  }, [id]);

  const handleMessage = async () => {
    if (!session?.user?.id || !id) {
      toast.error("Sign in to send messages");
      return;
    }
    try {
      const { data, error } = await supabase.rpc("start_conversation", {
        target_user_id: id,
      });
      if (error) throw error;
      navigate("/messages");
    } catch (err: any) {
      toast.error(err.message || "Could not start conversation");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white/40 gap-4">
        <Users className="w-12 h-12" />
        <p className="text-sm">User not found</p>
      </div>
    );
  }

  const displayName = profile.display_name || "Anonymous";
  const fallbackLetter = displayName.charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Banner */}
      <div className="relative h-48 overflow-hidden">
        {profile.avatar_url && (
          <img
            src={profile.avatar_url}
            alt=""
            className="absolute inset-0 w-full h-full object-cover blur-2xl opacity-40 scale-110"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />

        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(-1)}
          className="absolute top-4 left-4 rounded-full backdrop-blur-md bg-black/30 text-white z-10"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
      </div>

      {/* Avatar + Info */}
      <div className="px-8 -mt-16 relative z-10">
        <Avatar className="w-32 h-32 border-[6px] border-black">
          <AvatarImage src={profile.avatar_url || undefined} alt={displayName} />
          <AvatarFallback className="bg-zinc-800 text-white text-3xl font-bold">
            {fallbackLetter}
          </AvatarFallback>
        </Avatar>

        <h1 className="text-4xl font-display text-white uppercase tracking-tighter italic mt-4">
          {displayName}
        </h1>

        {profile.username && (
          <p className="text-sm text-white/40 font-mono">@{profile.username}</p>
        )}

        <div className="flex gap-3 mt-3">
          <Badge variant="secondary" className="bg-white/5 border-white/10 text-white/60 gap-1.5">
            <Users className="w-3 h-3" />
            {followingCount} Following
          </Badge>
          <Badge variant="secondary" className="bg-white/5 border-white/10 text-white/60 gap-1.5">
            <User className="w-3 h-3" />
            Guest
          </Badge>
        </div>

        {profile.bio && (
          <p className="text-white/70 text-sm mt-4 leading-relaxed">{profile.bio}</p>
        )}

        {/* Actions */}
        {!isSelf && (
          <div className="flex gap-3 mt-6">
            <FollowButton targetId={id} targetName={displayName} />
            {isFollowing && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleMessage}
                className="border-white/10 text-white/70 hover:bg-white/5 gap-2"
              >
                <MessageSquare className="w-4 h-4" />
                Message
              </Button>
            )}
          </div>
        )}

        {/* Self-view card */}
        {isSelf && (
          <Card className="bg-zinc-900/20 border-white/5 rounded-2xl p-8 mt-6 flex flex-col items-center text-center gap-3">
            <User className="w-12 h-12 text-white/20" />
            <h3 className="text-white font-semibold text-lg">Your Public Profile</h3>
            <p className="text-white/50 text-sm">
              This is what others see when they visit your page.
            </p>
          </Card>
        )}

        {/* Empty state for non-self */}
        {!isSelf && !profile.bio && (
          <div className="flex flex-col items-center text-center mt-12 gap-3 text-white/30">
            <Users className="w-10 h-10" />
            <p className="text-sm">This user is exploring the nightlife scene</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default GuestProfile;
