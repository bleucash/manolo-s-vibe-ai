import { useUserMode } from "@/contexts/UserModeContext";

/**
 * Tier 2 (business verification) gate for a single venue.
 *
 * Reads from `userVenues` in context rather than querying, deliberately: all
 * five Tier 2 surfaces (Go Active, VenuePriceEditor, StaffCommissionEditor,
 * ManagerApprovalPanel, PayoutsPanel) render simultaneously for the same
 * venue inside ManagerDashboard, so a per-component query would fire the same
 * lookup four or five times on every dashboard mount. `business_verified` is
 * already selected alongside the venue list in UserModeContext.
 *
 * `userVenues` only contains venues the signed-in user owns, which is exactly
 * the right scope: these five surfaces are all owner-only actions. A venueId
 * that isn't in the list means the user doesn't own it, so `false` is the
 * correct answer, not a missing-data case.
 *
 * Callers must respect `isLoading` before rendering a blocked state, otherwise
 * every dashboard flashes "verification required" for a beat while context
 * hydrates.
 */
export function useVenueVerified(venueId?: string | null) {
  const { userVenues, isLoading } = useUserMode();

  const venue = venueId ? userVenues.find((v) => v.id === venueId) : undefined;

  return {
    isVerified: !!venue?.business_verified,
    isLoading,
  };
}
