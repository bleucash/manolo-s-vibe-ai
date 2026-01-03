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

        const { data, error } = await supabase
          .from("follows")
          .select("id")
          .eq("follower_id", user.id)
          .eq("following_id", targetUserId)
          .maybeSingle();

        if (!error) {
          setIsFollowing(!!data);
        }
      } catch (err) {
        console.error("Error checking follow status:", err);
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

    // Capture the state at the exact moment of the click
    // This local variable ensures the DB call matches the UI flip
    let wasFollowingAtTimeOfClick = false;

    // Optimistic UI Update: Use functional state to guarantee we have the absolute latest value
    setIsFollowing((prev) => {
      wasFollowingAtTimeOfClick = prev;
      return !prev;
    });

    try {
      if (wasFollowingAtTimeOfClick) {
        // Was following, so we delete the record (Unfollow)
        const { error } = await supabase
          .from("follows")
          .delete()
          .eq("follower_id", currentUserId)
          .eq("following_id", targetUserId);

        if (error) throw error;
      } else {
        // Was NOT following, so we insert the record (Follow)
        const { error } = await supabase.from("follows").insert({
          follower_id: currentUserId,
          following_id: targetUserId,
        });

        if (error) throw error;
      }
    } catch (error: any) {
      // Surgical Revert: Put the UI back to exactly what it was for THIS specific click
      setIsFollowing(wasFollowingAtTimeOfClick);

      // Handle the "Already following" error gracefully if the unique constraint is triggered
      if (error.code === "23505") {
        setIsFollowing(true); // Ensure UI stays as "Following"
      } else {
        toast.error("Failed to update follow status");
      }
      console.error("Follow toggle error:", error);
    }
  }, [currentUserId, targetUserId]);

  return {
    isFollowing,
    isLoading,
    toggleFollow,
  };
}
