import { Navigate, useLocation } from "react-router-dom";
import { useUserMode } from "@/contexts/UserModeContext";
import { useWorkerPermissions } from "@/hooks/useWorkerPermissions";
// Ensure this import does NOT have curly braces {}
import LoadingState from "@/components/ui/LoadingState";

// ... rest of your ProtectedRoute code
type UserMode = "guest" | "talent" | "manager";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedModes?: UserMode[];
}

export const ProtectedRoute = ({ children, allowedModes }: ProtectedRouteProps) => {
  const { isLoading: contextLoading, session, mode } = useUserMode();
  const location = useLocation();

  // Use our permissions hook to verify the database status
  const { isTalentRole, isStaffRole, loading: permissionsLoading } = useWorkerPermissions(session?.user?.id || null);

  // 1. Unified Loading State
  // This covers the initial "Security Check" with the Big Green Loader
  if (contextLoading || permissionsLoading) {
    return <LoadingState />;
  }

  // 2. Auth Check
  if (!session) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // 3. Permission & Mode Check
  if (allowedModes) {
    if (mode === "manager" && !isStaffRole) {
      return <Navigate to="/" replace />;
    }

    if (mode === "talent" && !isTalentRole) {
      return <Navigate to="/" replace />;
    }

    if (!allowedModes.includes(mode)) {
      return <Navigate to="/" replace />;
    }
  }

  return <>{children}</>;
};
