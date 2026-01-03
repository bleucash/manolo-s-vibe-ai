import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useFollow(userId: string) {
  const [isFollowing, setIsFollowing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isToggling, setIsToggling] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Get current user
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id ?? null);
    };
    getUser();
  }, []);

  // Check if following
  const checkFollowStatus = useCallback(async () => {
    if (!currentUserId || !userId || currentUserId === userId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("follows")
        .select("id")
        .eq("follower_id", currentUserId)
        .eq("following_id", userId)
        .maybeSingle();

      if (error) throw error;
      setIsFollowing(!!data);
    } catch (err) {
      console.error("Failed to check follow status:", err);
    } finally {
      setIsLoading(false);
    }
  }, [currentUserId, userId]);

  useEffect(() => {
    checkFollowStatus();
  }, [checkFollowStatus]);

  const toggleFollow = async () => {
    if (!currentUserId || !userId || currentUserId === userId) return;

    setIsToggling(true);
    try {
      if (isFollowing) {
        const { error } = await supabase
          .from("follows")
          .delete()
          .eq("follower_id", currentUserId)
          .eq("following_id", userId);

        if (error) throw error;
        setIsFollowing(false);
      } else {
        const { error } = await supabase
          .from("follows")
          .insert({
            follower_id: currentUserId,
            following_id: userId,
          });

        if (error) throw error;
        setIsFollowing(true);
      }
    } catch (err) {
      console.error("Failed to toggle follow:", err);
      throw err;
    } finally {
      setIsToggling(false);
    }
  };

  return {
    isFollowing,
    isLoading,
    isToggling,
    toggleFollow,
    canFollow: currentUserId !== null && currentUserId !== userId,
  };
}
