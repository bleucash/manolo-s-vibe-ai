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

const TALENT_SUB_ROLES = ["dj", "promoter", "host", "performer", "entertainer", "dancer"];
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
        const { data: profile } = await supabase
          .from("profiles")
          .select("role_type, sub_role")
          .eq("id", userId)
          .maybeSingle();

        setRoleType((profile?.role_type as RoleType) || "guest");
        setSubRole(profile?.sub_role || null);

        const { data: staffEntries } = await supabase
          .from("venue_staff")
          .select("venue_id, status, staff_role")
          .eq("user_id", userId);

        setVenueStaffEntries(staffEntries || []);
      } catch (error) {
        // Console error removed per Phase 3 cleanup guidelines
      } finally {
        setLoading(false);
      }
    };

    fetchPermissions();
  }, [userId]);

  const isTalentRole = roleType === "talent" || TALENT_SUB_ROLES.includes(subRole?.toLowerCase() || "");
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
