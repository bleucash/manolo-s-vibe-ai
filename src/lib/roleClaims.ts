import { supabase } from "@/integrations/supabase/client";

/**
 * One account holds exactly one role, permanently (see CLAUDE.md). This is the
 * submission-time half of enforcing that: it stops a conflicting application
 * being filed, so the user is told immediately instead of after review. The
 * half that actually enforces it lives server-side in admin-actions.
 *
 * "The other track" is the point: a manager claiming a second venue is the
 * same track and must stay allowed. Only talent-vs-manager conflicts block.
 */
export type RoleTrack = "talent" | "manager";

export interface TrackConflict {
  title: string;
  description: string;
}

/** Legacy value still present in the app_role enum; treat it as manager. */
const MANAGER_ROLES = ["manager", "venue_manager"];

/** Both states block: pending would race, approved already settled the role. */
const OPEN_STATUSES = ["pending", "approved"];

/**
 * Returns null when submission is allowed, or the reason it is blocked.
 *
 * Fails open on a read error, because it is not the enforcement point. The
 * enforcement point is findRoleConflict in supabase/functions/admin-actions,
 * which runs the same rule as service role before either approve branch
 * writes role_type, fails CLOSED, and returns 409 on conflict. No client path
 * can skip it. This copy exists to stop a conflicting application being filed
 * at all, so the user hears about it immediately rather than after review.
 *
 * That server gate is the twin of this function. If the rule changes here it
 * must change there too; they cannot share code because that module is a Deno
 * bundle that cannot resolve the "@/" alias or use the browser client.
 */
export const checkOtherTrackConflict = async (
  userId: string,
  track: RoleTrack,
): Promise<TrackConflict | null> => {
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role_type")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) {
    console.error(profileError);
    return null;
  }

  const role = profile?.role_type;

  if (track === "talent") {
    if (role && MANAGER_ROLES.includes(role)) {
      return {
        title: "You Already Manage a Venue",
        description:
          "This account is a venue manager. One account holds one role, so it cannot also be talent.",
      };
    }

    const { data, error } = await supabase
      .from("venue_claims")
      .select("id")
      .eq("user_id", userId)
      .in("status", OPEN_STATUSES)
      .limit(1);

    if (error) {
      console.error(error);
      return null;
    }
    if (data && data.length > 0) {
      return {
        title: "Venue Claim Already Open",
        description:
          "You have a venue claim in review. Wait for it to resolve before applying as talent.",
      };
    }
    return null;
  }

  if (role === "talent") {
    return {
      title: "You Are Already Talent",
      description:
        "This account is verified talent. One account holds one role, so it cannot also manage a venue.",
    };
  }

  const { data, error } = await supabase
    .from("talent_applications")
    .select("id")
    .eq("user_id", userId)
    .in("status", OPEN_STATUSES)
    .limit(1);

  if (error) {
    console.error(error);
    return null;
  }
  if (data && data.length > 0) {
    return {
      title: "Talent Application Already Open",
      description:
        "You have a talent application in review. Wait for it to resolve before claiming a venue.",
    };
  }
  return null;
};
