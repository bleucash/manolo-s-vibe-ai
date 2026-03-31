import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserMode } from "@/contexts/UserModeContext";

export const useVenueStatus = (venueId: string) => {
  const { session } = useUserMode();
  const [isOwner, setIsOwner] = useState(false);
  const [hasPendingClaim, setHasPendingClaim] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkStatus = async () => {
      if (!session?.user?.id || !venueId) {
        setLoading(false);
        return;
      }

      const { data: venue } = await supabase
        .from("venues")
        .select("owner_id")
        .eq("id", venueId)
        .single();

      const { data: claim } = await supabase
        .from("venue_claims")
        .select("status")
        .eq("venue_id", venueId)
        .eq("user_id", session.user.id)
        .maybeSingle();

      setIsOwner(venue?.owner_id === session.user.id);
      setHasPendingClaim(claim?.status === "pending");
      setLoading(false);
    };

    checkStatus();
  }, [venueId, session]);

  // "Temporary Manager" is someone who has a pending claim OR is the official owner
  const isTempManager = isOwner || hasPendingClaim;

  return { isOwner, isTempManager, hasPendingClaim, loading };
};
