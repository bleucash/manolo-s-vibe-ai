import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { UserPlus, UserCheck, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useUserMode } from "@/contexts/UserModeContext";
import { cn } from "@/lib/utils";

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
      // 🛡️ CIRCUIT BREAKER: Prevents the "eq." 400 error in your console
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
      } catch (err) {
        // Silently catch to prevent global app crash
      } finally {
        setLoading(false);
      }
    };

    checkFollowStatus();
  }, [session?.user?.id, targetId, table, column]);

  const handleToggleFollow = async () => {
    if (!session?.user?.id) {
      toast.error("Neural handshake required");
      return;
    }

    setLoading(true);
    try {
      if (isFollowing) {
        const { error } = await supabase.from(table).delete().eq("follower_id", session.user.id).eq(column, targetId);

        if (error) throw error;
        setIsFollowing(false);
        toast.success(`Link severed with ${targetName}`);
      } else {
        const { error } = await supabase.from(table).insert({
          follower_id: session.user.id,
          [column]: targetId,
        });

        if (error) throw error;
        setIsFollowing(true);
        toast.success(`Link established with ${targetName}`);
      }
    } catch (err) {
      toast.error("Handshake failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleToggleFollow}
      disabled={loading}
      className={cn(
        "font-bold uppercase tracking-widest text-[10px] h-10 px-6 transition-all rounded-full flex items-center justify-center gap-2",
        isFollowing
          ? "bg-white/10 border border-white/20 text-white"
          : "bg-white text-black hover:bg-neon-blue hover:text-white",
        className,
      )}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : isFollowing ? (
        <>
          <UserCheck className="h-4 w-4" />
          Linked
        </>
      ) : (
        <>
          <UserPlus className="h-4 h-4" />
          Link
        </>
      )}
    </button>
  );
};
