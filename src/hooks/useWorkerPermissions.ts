import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ALL_POSITIONS, GUEST_FACING_POSITIONS, POSITIONS } from "@/config/positions";

export type RoleType = "talent" | "guest" | "manager" | null;

interface VenueStaffEntry {
  venue_id: string;
  status: string;
  staff_role?: string;
}

interface WorkerPermissions {
  roleType: RoleType;
  subRole: string | null;
  isTalentRole: boolean;
  isStaffRole: boolean;
  hasActiveVenueStaff: boolean;
  venueStaffEntries: VenueStaffEntry[];
  loading: boolean;
}

// BEHAVIOUR CHANGE. These were two hardcoded lists that had drifted out of
// sync with the real position set:
//
//   in the lists, not positions:  performer, dancer, bouncer, staff
//   positions, in neither list:   bartender, bottle_girl, media, event_staff
//
// So a bartender counted as neither talent nor staff, and event_staff failed
// the staff check outright, because membership is exact and the old list held
// "staff" rather than "event_staff". Both sets are now derived from the config
// map, so adding a position updates permissions with it.
//
// This hook currently has no consumers. ProtectedRoute, its only one, was
// deleted for an auth bug. The role logic here is kept deliberately rather
// than removed as collateral.
const TALENT_SUB_ROLES: string[] = GUEST_FACING_POSITIONS;
const STAFF_SUB_ROLES: string[] = ALL_POSITIONS.filter((p) => !POSITIONS[p].guestFacing);

export function useWorkerPermissions(userId: string | null): WorkerPermissions {
  // ✅ HYDRATION FIX: Initializing from localStorage if available
  // to prevent the "Guest Lockout" during the first few milliseconds of a page load.
  const [roleType, setRoleType] = useState<RoleType>(() => {
    const cached = localStorage.getItem("userMode");
    return (cached as RoleType) || null;
  });

  const [subRole, setSubRole] = useState<string | null>(null);
  const [venueStaffEntries, setVenueStaffEntries] = useState<VenueStaffEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPermissions = async () => {
      // If no user ID, we are definitely a guest
      if (!userId) {
        setRoleType("guest");
        setLoading(false);
        return;
      }

      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role_type, sub_role")
          .eq("id", userId)
          .maybeSingle();

        if (profile) {
          const actualRole = profile.role_type as RoleType;
          setRoleType(actualRole || "guest");
          setSubRole(profile.sub_role || null);
        }

        const { data: staffEntries } = await supabase
          .from("venue_staff")
          .select("venue_id, status, staff_role")
          .eq("user_id", userId);

        setVenueStaffEntries(staffEntries || []);
      } catch (error) {
        // Silently handle errors to maintain "Neural Engine" smoothness
      } finally {
        setLoading(false);
      }
    };

    fetchPermissions();
  }, [userId]);

  // ✅ LOGIC REFACTOR:
  // We check BOTH the explicit role_type AND the sub_role categories.
  const isTalentRole = roleType === "talent" || TALENT_SUB_ROLES.includes(subRole?.toLowerCase() || "");

  const isStaffRole =
    roleType === "manager" || STAFF_SUB_ROLES.includes(subRole?.toLowerCase() || "");

  const hasActiveVenueStaff = venueStaffEntries.some(
    (entry) => entry.status === "confirmed" || entry.status === "active",
  );

  return {
    roleType,
    subRole,
    isTalentRole,
    isStaffRole,
    hasActiveVenueStaff,
    venueStaffEntries,
    loading,
  };
}
