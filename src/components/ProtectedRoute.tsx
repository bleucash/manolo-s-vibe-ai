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
  const { isTalentRole, isStaffRole, loading: permissionsLoading } = useWorkerPermissions(session?.user?.id || null);

  // ✅ THE SILENT CHECK:
  // If we have a session, we stay invisible during loading to prevent the flicker.
  if ((contextLoading || permissionsLoading) && !session) {
    return <LoadingState />;
  }

  // Auth Check
  if (!session) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // Permission & Mode Check
  if (allowedModes) {
    if (mode === "manager" && !isStaffRole) return <Navigate to="/" replace />;
    if (mode === "talent" && !isTalentRole) return <Navigate to="/" replace />;
    if (!allowedModes.includes(mode)) return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};
