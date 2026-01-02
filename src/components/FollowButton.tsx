import { useState } from "react";
import { Button } from "@/components/ui/button";
import { UserPlus, UserCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface FollowButtonProps {
  targetId?: string;
  targetName?: string;
  userId?: string; // Alias for targetId for compatibility
  className?: string;
}

export const FollowButton = ({ targetId, targetName = "User", userId, className }: FollowButtonProps) => {
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(false);

  const id = targetId || userId;

  const handleToggleFollow = async () => {
    if (!id) return;
    setLoading(true);
    // Placeholder for actual follow/unfollow logic
    await new Promise((resolve) => setTimeout(resolve, 300));
    
    if (isFollowing) {
      setIsFollowing(false);
      toast.success(`Unfollowed ${targetName}`);
    } else {
      setIsFollowing(true);
      toast.success(`Following ${targetName}`);
    }
    setLoading(false);
  };

  return (
    <Button
      onClick={handleToggleFollow}
      disabled={loading}
      size="sm"
      className={`font-bold uppercase tracking-widest text-[10px] transition-all ${
        isFollowing
          ? "bg-white/10 border border-white/20 text-white"
          : "bg-neon-pink text-white"
      } ${className}`}
    >
      {loading ? (
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
