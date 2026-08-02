import { Button } from "@/components/ui/button";
import { UserPlus, UserCheck, Loader2 } from "lucide-react";
import { useFollow } from "@/hooks/useFollow";

interface FollowButtonProps {
  targetId?: string;
  targetName?: string;
  userId?: string; // Alias for targetId for compatibility
  className?: string;
}

export const FollowButton = ({ targetId, targetName = "User", userId, className }: FollowButtonProps) => {
  const id = targetId || userId || "";
  const { isFollowing, isLoading, toggleFollow } = useFollow(id);

  // No id yet (e.g. profile still loading) — useFollow("") never resolves
  // its loading state, so render a static disabled button instead of
  // spinning forever.
  if (!id) {
    return (
      <Button
        disabled
        size="sm"
        className={`font-bold uppercase tracking-widest text-[10px] transition-all bg-neon-pink text-white ${className}`}
      >
        <UserPlus className="h-4 w-4 mr-2" />
        Follow
      </Button>
    );
  }

  return (
    <Button
      onClick={toggleFollow}
      disabled={isLoading}
      size="sm"
      className={`font-bold uppercase tracking-widest text-[10px] transition-all ${
        isFollowing
          ? "bg-white/10 border border-white/20 text-white"
          : "bg-neon-pink text-white"
      } ${className}`}
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : isFollowing ? (
        <>
          <UserCheck className="h-4 w-4 mr-2" />
          Following
        </>
      ) : (
        <>
          <UserPlus className="h-4 w-4 mr-2" />
          Follow
        </>
      )}
    </Button>
  );
};
