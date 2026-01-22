import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface UseFollowReturn {
  isFollowing: boolean;
  isLoading: boolean;
  toggleFollow: () => Promise<void>;
}

export function useFollow(targetUserId: string): UseFollowReturn {
  const [isFollowing, setIsFollowing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Check initial follow status on mount
  useEffect(() => {
    const checkFollowStatus = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          setIsLoading(false);
          return;
        }

        setCurrentUserId(user.id);

        // Updated to use the 'followers' table per Phase 2 consolidation
        const { data, error } = await supabase
          .from("followers")
          .select("id")
          .eq("follower_id", user.id)
          .eq("following_id", targetUserId)
          .maybeSingle();

        if (!error) {
          setIsFollowing(!!data);
        }
      } catch (err) {
        // Console error removed per Phase 3 cleanup
      } finally {
        setIsLoading(false);
      }
    };

    if (targetUserId) {
      checkFollowStatus();
    }
  }, [targetUserId]);

  const toggleFollow = useCallback(async () => {
    if (!currentUserId) {
      toast.error("Please sign in to follow");
      return;
    }

    if (currentUserId === targetUserId) {
      toast.error("You can't follow yourself");
      return;
    }

    let wasFollowingAtTimeOfClick = false;

    // Optimistic UI Update
    setIsFollowing((prev) => {
      wasFollowingAtTimeOfClick = prev;
      return !prev;
    });

    try {
      if (wasFollowingAtTimeOfClick) {
        // Was following, so we delete the record (Unfollow) using standard 'followers' table
        const { error } = await supabase
          .from("followers")
          .delete()
          .eq("follower_id", currentUserId)
          .eq("following_id", targetUserId);

        if (error) throw error;
      } else {
        // Was NOT following, so we insert the record (Follow) using standard 'followers' table
        const { error } = await supabase.from("followers").insert({
          follower_id: currentUserId,
          following_id: targetUserId,
        });

        if (error) throw error;
      }
    } catch (error: any) {
      setIsFollowing(wasFollowingAtTimeOfClick);

      if (error.code === "23505") {
        setIsFollowing(true);
      } else {
        toast.error("Failed to update follow status");
      }
      // Console error removed per Phase 3 cleanup
    }
  }, [currentUserId, targetUserId]);

  return {
    isFollowing,
    isLoading,
    toggleFollow,
  };
}
