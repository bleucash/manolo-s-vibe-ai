import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { UserPlus, UserCheck, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useUserMode } from "@/contexts/UserModeContext";

interface FollowButtonProps {
  targetId: string;
  targetName?: string;
  targetType: "talent" | "venue";
  className?: string;
}

export const FollowButton = ({ targetId, targetName = "User", targetType, className }: FollowButtonProps) => {
  const { session } = useUserMode();
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);

  const table = targetType === "talent" ? "followers" : "venue_followers";
  const column = targetType === "talent" ? "following_id" : "venue_id";

  useEffect(() => {
    const checkFollowStatus = async () => {
      if (!session?.user?.id || !targetId) {
        setLoading(false);
        return;
      }
      try {
        const { data, error } = await supabase
          .from(table)
          .select("id")
          .eq("follower_id", session.user.id)
          .eq(column, targetId)
          .maybeSingle();
        if (error) throw error;
        setIsFollowing(!!data);
      } finally {
        setLoading(false);
      }
    };
    checkFollowStatus();
  }, [session?.user?.id, targetId, table, column]);

  const handleToggleFollow = async () => {
    if (!session?.user?.id) {
      toast.error("Verification required");
      return;
    }
    setLoading(true);
    try {
      if (isFollowing) {
        await supabase.from(table).delete().eq("follower_id", session.user.id).eq(column, targetId);
        setIsFollowing(false);
      } else {
        await supabase.from(table).insert({ follower_id: session.user.id, [column]: targetId });
        setIsFollowing(true);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      onClick={handleToggleFollow}
      disabled={loading}
      size="sm"
      className={cn(
        "font-bold uppercase text-[10px] h-10 px-6 rounded-full",
        isFollowing ? "bg-white/10 text-white" : "bg-white text-black",
        className,
      )}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : isFollowing ? "Linked" : "Link"}
    </Button>
  );
};
