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

  const isSyncing = contextLoading || permissions.loading;

  if (isSyncing && session) {
    return <LoadingState fullPage />;
  }

  if (!session && !contextLoading) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  if (allowedModes && !isSyncing) {
    if (!allowedModes.includes(mode)) {
      return <Navigate to="/" replace />;
    }
    if (allowedModes.includes("manager") && !permissions.isStaffRole) {
      return <Navigate to="/" replace />;
    }
  }

  return <>{children}</>;
};
