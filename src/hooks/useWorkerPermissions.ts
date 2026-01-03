import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface WorkerPermissions {
  isTalentRole: boolean;
  isStaffRole: boolean;
  hasActiveVenueStaff: boolean;
  isLoading: boolean;
  roleType: string | null;
  subRole: string | null;
}

export function useWorkerPermissions(userId: string | null): WorkerPermissions {
  const [isTalentRole, setIsTalentRole] = useState(false);
  const [isStaffRole, setIsStaffRole] = useState(false);
  const [hasActiveVenueStaff, setHasActiveVenueStaff] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [roleType, setRoleType] = useState<string | null>(null);
  const [subRole, setSubRole] = useState<string | null>(null);

  useEffect(() => {
    const fetchPermissions = async () => {
      if (!userId) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        // Query profile for role_type and sub_role
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("role_type, sub_role")
          .eq("id", userId)
          .maybeSingle();

        if (profileError) throw profileError;

        const userRoleType = profile?.role_type ?? null;
        const userSubRole = profile?.sub_role ?? null;

        setRoleType(userRoleType);
        setSubRole(userSubRole);
        setIsTalentRole(userRoleType === "talent");
        setIsStaffRole(userRoleType === "staff");

        // Query venue_staff for active status
        const { data: staffData, error: staffError } = await supabase
          .from("venue_staff")
          .select("id")
          .eq("user_id", userId)
          .eq("status", "active")
          .limit(1);

        if (staffError) throw staffError;

        setHasActiveVenueStaff((staffData ?? []).length > 0);
      } catch (err) {
        console.error("Failed to fetch worker permissions:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPermissions();
  }, [userId]);

  return {
    isTalentRole,
    isStaffRole,
    hasActiveVenueStaff,
    isLoading,
    roleType,
    subRole,
  };
}
