import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export type RoleType = "venue_manager" | "talent" | "guest" | null;

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

// Sub-roles that show "Talent Dashboard" button
const TALENT_SUB_ROLES = ["dj", "promoter", "host", "performer", "entertainer", "dancer"];

// Sub-roles that show "Open Scanner" button (if venue_staff is active)
const STAFF_SUB_ROLES = ["security", "bouncer", "staff"];

export function useWorkerPermissions(userId: string | null): WorkerPermissions {
  const [roleType, setRoleType] = useState<RoleType>(null);
  const [subRole, setSubRole] = useState<string | null>(null);
  const [venueStaffEntries, setVenueStaffEntries] = useState<VenueStaffEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPermissions = async () => {
      if (!userId) {
        setLoading(false);
        return;
      }

      try {
        // Fetch profile role_type and sub_role
        const { data: profile } = await supabase
          .from("profiles")
          .select("role_type, sub_role")
          .eq("id", userId)
          .maybeSingle();

        setRoleType((profile?.role_type as RoleType) || "guest");
        setSubRole(profile?.sub_role || null);

        // Fetch venue_staff entries
        const { data: staffEntries } = await supabase
          .from("venue_staff")
          .select("venue_id, status, staff_role")
          .eq("user_id", userId);

        setVenueStaffEntries(staffEntries || []);
      } catch (error) {
        console.error("Error fetching worker permissions:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchPermissions();
  }, [userId]);

  // isTalentRole: true if role_type is 'talent' OR sub_role is in TALENT_SUB_ROLES
  const isTalentRole = roleType === "talent" || TALENT_SUB_ROLES.includes(subRole?.toLowerCase() || "");

  // isStaffRole: true if role_type is 'venue_manager' OR sub_role is in STAFF_SUB_ROLES
  const isStaffRole = roleType === "venue_manager" || STAFF_SUB_ROLES.includes(subRole?.toLowerCase() || "");

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
