import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserMode } from "@/contexts/UserModeContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, User, Users, MessageSquare } from "lucide-react";
import { FollowButton } from "@/components/FollowButton";
import { useFollow } from "@/hooks/useFollow";
import { toast } from "sonner";

const GuestProfile = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { session } = useUserMode();

  const { isFollowing } = useFollow(id || "");
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [followingCount, setFollowingCount] = useState(0);
  const [initiatingChat, setInitiatingChat] = useState(false);

  const currentUserId = session?.user?.id || null;
  const isSelfView = currentUserId === id;

  useEffect(() => {
    fetchProfile();
  }, [id]);

  const fetchProfile = async () => {
    // `id` is `string | undefined` from useParams, but the only route that
    // mounts this page is "/users/:id" (App.tsx), so React Router cannot
    // render it without the segment. Guarding instead of asserting, because a
    // guard also covers the day someone mounts this component elsewhere.
    if (!id) return;

    try {
      // Fetch profile data
      const { data: profileData } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle();

      if (profileData) {
        setProfile(profileData);

        // Fetch following count
        const { count } = await supabase
          .from("followers")
          .select("*", { count: "exact", head: true })
          .eq("follower_id", id);

        setFollowingCount(count || 0);
      }
    } catch (error) {
      console.error("Error fetching guest profile:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleMessage = async () => {
    if (!currentUserId || !id || isSelfView) return;

    setInitiatingChat(true);

    try {
      // One RPC, not a lookup plus two inserts.
      //
      // This previously queried and inserted conversations.user1_id/user2_id.
      // Those columns have never existed: conversations is (id, created_at,
      // updated_at) and membership lives in conversation_participants. The
      // button therefore failed every time it was pressed, silently, behind a
      // generic toast.
      //
      // start_conversation creates the thread and both participant rows in one
      // transaction, so there is no window where a conversation exists with
      // nobody in it — a row invisible to every query but still present. It is
      // also idempotent and takes a lock on the pair, so pressing twice
      // returns the same thread instead of racing a second one into existence.
      const { data: conversationId, error } = await supabase.rpc("start_conversation", {
        target_user_id: id,
      });

      if (error) throw error;
      if (!conversationId) throw new Error("start_conversation returned no id");

      // Tell the sender when their message is a REQUEST rather than a
      // delivery. Without this the thread looks completely ordinary from this
      // side while being invisible to the recipient until they accept, so the
      // sender reasonably assumes it arrived. The black hole after a decline
      // is deliberate; leaving the sender uninformed before one is not.
      //
      // start_conversation returns only the id, so the recipient's state is
      // read back. It is visible to us: conversation_participants' SELECT
      // policy lets a participant see every row of their own conversations.
      const { data: theirRow } = await supabase
        .from("conversation_participants")
        .select("state")
        .eq("conversation_id", conversationId)
        .eq("user_id", id)
        .maybeSingle();

      if (theirRow?.state === "pending") {
        toast.success("Request Sent", { description: "They'll see it when they accept." });
      }

      navigate(`/messages?conversation=${conversationId}`);
    } catch (error: any) {
      // The 42501 rope branch that lived here is gone with the rope itself.
      // start_conversation no longer refuses a guest messaging someone who
      // does not follow them back; it queues the thread as a request. A branch
      // that can never fire is exactly the kind of dead check this codebase
      // has collected too many of.
      console.error("Message error:", error);
      toast.error("Failed to start conversation");
    } finally {
      setInitiatingChat(false);
    }
  };

  if (loading) return null;

  if (!profile) {
    return (
      <div className="h-screen flex items-center justify-center bg-black text-white font-display uppercase tracking-[0.5em] text-[10px]">
        User Not Found
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black pb-32 animate-in fade-in duration-700">
      {/* BANNER IMAGE */}
      <div className="relative w-full h-48 overflow-hidden bg-zinc-900">
        {profile.avatar_url && (
          <img src={profile.avatar_url} alt="Banner" className="w-full h-full object-cover opacity-30 blur-sm" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />

        {/* Back Button */}
        <div className="absolute top-6 left-6 z-20">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="bg-black/40 backdrop-blur-md rounded-full text-white border border-white/10"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* PROFILE INFO */}
      <div className="px-8 -mt-16 relative z-10">
        {/* Avatar */}
        <div className="relative inline-block mb-6">
          <Avatar className="w-32 h-32 border-[6px] border-black shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
            <AvatarImage src={profile.avatar_url} />
            <AvatarFallback className="bg-zinc-900 text-zinc-600 text-3xl font-display italic">
              {profile.display_name?.charAt(0)?.toUpperCase() || profile.username?.charAt(0)?.toUpperCase() || "G"}
            </AvatarFallback>
          </Avatar>
        </div>

        {/* Name & Username */}
        <div className="mb-6">
          <h1 className="text-4xl font-display text-white uppercase tracking-tighter italic leading-none mb-2">
            {profile.display_name || profile.username || "Guest User"}
          </h1>
          {profile.username && <p className="text-sm text-white/40 font-mono">@{profile.username}</p>}
        </div>

        {/* Stats & Actions */}
        <div className="flex items-center gap-3 mb-6">
          {/* Following Count */}
          <Badge className="bg-white/5 backdrop-blur-md text-white/60 border-white/10 uppercase text-[9px] font-black tracking-widest px-4 py-2 rounded-full">
            <Users className="w-3 h-3 mr-2" />
            {followingCount} Following
          </Badge>

          {/* Guest Badge */}
          <Badge className="bg-zinc-900/40 backdrop-blur-md text-white/40 border-white/10 uppercase text-[9px] font-black tracking-widest px-4 py-2 rounded-full">
            <User className="w-3 h-3 mr-2" />
            Guest
          </Badge>
        </div>

        {/* Bio */}
        {profile.bio && (
          <div className="mb-8">
            <p className="text-white/70 text-sm leading-relaxed">{profile.bio}</p>
          </div>
        )}

        {/* Action Buttons */}
        {!isSelfView && (
          <div className="flex gap-3 mb-8">
            {/* Follow Button */}
            <FollowButton targetId={id || ""} />

            {/* Message Button */}
            {isFollowing && (
              <Button
                onClick={handleMessage}
                disabled={initiatingChat}
                className="flex-1 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-full font-black uppercase text-[10px] tracking-widest transition-all"
              >
                <MessageSquare className="w-3.5 h-3.5 mr-2" />
                {initiatingChat ? "Opening..." : "Message"}
              </Button>
            )}
          </div>
        )}

        {/* Self-View Message */}
        {isSelfView && (
          <div className="bg-zinc-900/20 border border-white/5 rounded-2xl p-6 text-center">
            <User className="w-12 h-12 mx-auto mb-4 text-white/20" />
            <h3 className="text-white font-display uppercase tracking-wider text-sm mb-2">Your Public Profile</h3>
            <p className="text-white/40 text-xs leading-relaxed">This is what others see when they visit your page.</p>
          </div>
        )}

        {/* Empty State for Non-Self View */}
        {!isSelfView && (
          <div className="bg-zinc-900/20 border border-white/5 rounded-2xl p-6 text-center mt-8">
            <Users className="w-12 h-12 mx-auto mb-4 text-white/20" />
            <p className="text-white/40 text-xs">This user is exploring the nightlife scene.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default GuestProfile;
