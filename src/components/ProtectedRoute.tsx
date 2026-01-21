import { Navigate, useLocation } from "react-router-dom";
import { useUserMode } from "@/contexts/UserModeContext";
import { useWorkerPermissions } from "@/hooks/useWorkerPermissions";
import LoadingState from "@/components/ui/LoadingState"; // No curly braces here

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
  // This stays active until BOTH user context and DB permissions are ready
  if (contextLoading || permissionsLoading) {
    return <LoadingState />;
  }

  // 2. Auth Check: Send to login if no session exists
  if (!session) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // 3. Permission & Mode Integrity Check
  if (allowedModes) {
    if (mode === "manager" && !isStaffRole) {
      console.warn("Unauthorized Manager access attempt");
      return <Navigate to="/" replace />;
    }

    if (mode === "talent" && !isTalentRole) {
      console.warn("Unauthorized Talent access attempt");
      return <Navigate to="/" replace />;
    }

    if (!allowedModes.includes(mode)) {
      return <Navigate to="/" replace />;
    }
  }

  return <>{children}</>;
};
