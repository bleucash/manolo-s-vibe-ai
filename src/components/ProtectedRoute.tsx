import { Navigate, useLocation } from "react-router-dom";
import { useUserMode } from "@/contexts/UserModeContext";
import { useWorkerPermissions } from "@/hooks/useWorkerPermissions";
import { LoadingState } from "@/components/ui/LoadingState";

type UserMode = "guest" | "talent" | "manager";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedModes?: UserMode[];
}

export const ProtectedRoute = ({ children, allowedModes }: ProtectedRouteProps) => {
  const { isLoading: contextLoading, session, mode } = useUserMode();
  const location = useLocation();

  // Verify database permissions (Staff/Talent checks)
  const { isTalentRole, isStaffRole, loading: permissionsLoading } = useWorkerPermissions(session?.user?.id || null);

  // 1. Unified Loading State
  // This replaces the blue/different colored circles with your branded green loader
  if (contextLoading || permissionsLoading) {
    return <LoadingState />;
  }

  // 2. Auth Check: Send to login if no session exists
  if (!session) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // 3. Permission & Mode Integrity Check
  if (allowedModes) {
    // Block access to Manager mode if the DB says they aren't staff
    if (mode === "manager" && !isStaffRole) {
      console.warn("Unauthorized Manager access attempt");
      return <Navigate to="/" replace />;
    }

    // Block access to Talent mode if the DB says they aren't talent
    if (mode === "talent" && !isTalentRole) {
      console.warn("Unauthorized Talent access attempt");
      return <Navigate to="/" replace />;
    }

    // Ensure the current mode is explicitly allowed for this route
    if (!allowedModes.includes(mode)) {
      return <Navigate to="/" replace />;
    }
  }

  // Return the children (the actual page) once all checks pass
  return <>{children}</>;
};
