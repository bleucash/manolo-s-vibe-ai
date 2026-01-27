import { Navigate, useLocation } from "react-router-dom";
import { useUserMode } from "@/contexts/UserModeContext";
import { useWorkerPermissions } from "@/hooks/useWorkerPermissions";
import LoadingState from "@/components/ui/LoadingState";

type UserMode = "guest" | "talent" | "manager";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedModes?: UserMode[];
}

export const ProtectedRoute = ({ children, allowedModes }: ProtectedRouteProps) => {
  const { isLoading: contextLoading, session, mode } = useUserMode();
  const location = useLocation();
  const permissions = useWorkerPermissions(session?.user?.id || null);

  // 🛡️ PATIENCE GUARD: Wait for all handshakes to finish
  const isSyncing = contextLoading || permissions.loading;

  if (isSyncing && session) {
    return <LoadingState fullPage />;
  }

  // Auth Check
  if (!session && !contextLoading) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // Role/Mode Check
  if (allowedModes && !isSyncing) {
    const hasPermission = allowedModes.includes(mode);

    // Extra safety for Manager routes
    if (allowedModes.includes("manager") && !permissions.isStaffRole) {
      return <Navigate to="/" replace />;
    }

    if (!hasPermission) {
      return <Navigate to="/" replace />;
    }
  }

  return <>{children}</>;
};
