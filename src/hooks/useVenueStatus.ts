import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserMode } from "@/contexts/UserModeContext";

export const useVenueStatus = (venueId: string) => {
  const { session, isLoading: contextLoading } = useUserMode();
  const [isOwner, setIsOwner] = useState(false);
  const [hasPendingClaim, setHasPendingClaim] = useState(false);
  // The venue Instagram the claimant named, so the pending state can tell them
  // which account to DM from. Null when there is no pending claim.
  const [pendingClaimHandle, setPendingClaimHandle] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (contextLoading) return; // wait for the shared auth context to hydrate first

    const checkStatus = async () => {
      setLoadFailed(false);
      if (!session?.user?.id || !venueId) {
        setLoading(false);
        return;
      }

      const [venueRes, claimRes] = await Promise.all([
        supabase.from("venues").select("owner_id").eq("id", venueId).maybeSingle(),
        // A7: one user can hold several claims on one venue over time
        // (rejected or revoked history, then a new pending one), so this
        // reads only the live pending claim. Unfiltered, .maybeSingle() errors
        // on the second row, and that error used to be discarded, which made
        // a pending claimant look like a stranger. At most one pending claim
        // per venue can exist, so .limit(1) drops nothing.
        supabase
          .from("venue_claims")
          .select("id, instagram_handle")
          .eq("venue_id", venueId)
          .eq("user_id", session.user.id)
          .eq("status", "pending")
          .limit(1),
      ]);

      // Surfaced, not swallowed: a failed read must not be mistaken for
      // "not the owner, no claim". Callers decide what to render.
      if (venueRes.error || claimRes.error) {
        console.error(venueRes.error ?? claimRes.error);
        setLoadFailed(true);
      }

      setIsOwner(venueRes.data?.owner_id === session.user.id);
      setHasPendingClaim((claimRes.data?.length ?? 0) > 0);
      setPendingClaimHandle(claimRes.data?.[0]?.instagram_handle ?? null);
      setLoading(false);
    };

    checkStatus();
  }, [venueId, session, contextLoading]);

  // There is no "temporary manager". A pending claim confers nothing until an
  // admin has verified the Instagram handshake and approved it (owner
  // decision, 2026-10-21): it used to unlock hero-reel and portfolio edit
  // controls here, whose saves RLS then refused silently. Edit rights come
  // from isOwner alone.
  return { isOwner, hasPendingClaim, pendingClaimHandle, loadFailed, loading };
};
