import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export type RoleType = "venue_manager" | "talent" | "guest" | "manager" | null;

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

const TALENT_SUB_ROLES = ["dj", "promoter", "host", "performer", "entertainer", "dancer"];
const STAFF_SUB_ROLES = ["security", "bouncer", "staff"];

export function useWorkerPermissions(userId: string | null): WorkerPermissions {
  // ✅ HYDRATION FIX: Initializing from localStorage if available
  // to prevent the "Guest Lockout" during the first few milliseconds of a page load.
  const [roleType, setRoleType] = useState<RoleType>(() => {
    const cached = localStorage.getItem("userMode");
    if (cached === "manager") return "venue_manager";
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
    roleType === "venue_manager" || roleType === "manager" || STAFF_SUB_ROLES.includes(subRole?.toLowerCase() || "");

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
