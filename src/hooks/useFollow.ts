import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { toast } from "sonner";

/**
 * Talent follows live in `followers` (follower_id -> following_id).
 * Venue follows live in `venue_followers` (follower_id -> venue_id).
 * Same shape, same UNIQUE constraint, same 23505 duplicate behaviour, so the
 * two differ only by table and target column.
 */
export type FollowTarget = "talent" | "venue";

/**
 * `as const` matters. Typed as `{ table: string }` these were plain strings,
 * and `supabase.from(aString)` matches no overload: the client keys every
 * query off a literal table name. Widening to `string` also meant a typo here
 * compiled fine and failed at runtime. `satisfies` checks both names against
 * the generated schema while `as const` keeps them literal.
 */
const TARGET_TABLE = {
  talent: { table: "followers", column: "following_id" },
  venue: { table: "venue_followers", column: "venue_id" },
} as const satisfies Record<FollowTarget, { table: keyof Database["public"]["Tables"]; column: string }>;

interface UseFollowReturn {
  isFollowing: boolean;
  isLoading: boolean;
  toggleFollow: () => Promise<void>;
}

/**
 * Raw write, no local state. Exported so callers that already hold follow
 * state in bulk (Discovery loads every follow in one batched query) can reuse
 * the exact insert/delete semantics without either duplicating them or
 * mounting one hook per card, which would turn a single query into N.
 * Throws on failure so the caller can roll its own optimistic state back;
 * 23505 propagates untouched for the caller to special-case.
 */
export async function writeFollow(
  targetId: string,
  targetType: FollowTarget,
  currentUserId: string,
  follow: boolean,
): Promise<void> {
  const { table, column } = TARGET_TABLE[targetType];

  if (follow) {
    const { error } = await supabase
      .from(table)
      .insert({ follower_id: currentUserId, [column]: targetId });
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from(table)
      .delete()
      .eq("follower_id", currentUserId)
      .eq(column, targetId);
    if (error) throw error;
  }
}

export function useFollow(targetId: string, targetType: FollowTarget = "talent"): UseFollowReturn {
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

        const { table, column } = TARGET_TABLE[targetType];
        const { data, error } = await supabase
          .from(table)
          .select("id")
          .eq("follower_id", user.id)
          .eq(column, targetId)
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

    if (targetId) {
      checkFollowStatus();
    }
  }, [targetId, targetType]);

  const toggleFollow = useCallback(async () => {
    if (!currentUserId) {
      toast.error("Please sign in to follow");
      return;
    }

    // Only reachable for talent in practice: a venue id is never a user id.
    // Kept unconditional so talent behaviour is preserved exactly.
    if (currentUserId === targetId) {
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
      await writeFollow(targetId, targetType, currentUserId, !wasFollowingAtTimeOfClick);
    } catch (error: any) {
      setIsFollowing(wasFollowingAtTimeOfClick);

      if (error.code === "23505") {
        setIsFollowing(true);
      } else {
        toast.error("Failed to update follow status");
      }
      // Console error removed per Phase 3 cleanup
    }
  }, [currentUserId, targetId, targetType]);

  return {
    isFollowing,
    isLoading,
    toggleFollow,
  };
}
