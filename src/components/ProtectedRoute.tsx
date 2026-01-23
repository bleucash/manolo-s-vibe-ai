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

  // ✅ We pass the session user ID to the permissions hook
  const { isTalentRole, isStaffRole, loading: permissionsLoading } = useWorkerPermissions(session?.user?.id || null);

  /**
   * ✅ THE "STAY PUT" LOGIC
   * If the context OR the permission hook is still loading,
   * and we HAVE a session, we show the loading state.
   * This prevents the app from "thinking" you are a guest
   * and redirecting you to "/" prematurely.
   */
  if ((contextLoading || permissionsLoading) && session) {
    return <LoadingState />;
  }

  // Auth Check: If definitely no session, send to login
  if (!session && !contextLoading) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // Permission & Mode Check
  if (allowedModes && !contextLoading && !permissionsLoading) {
    // Check if the user's role matches the required mode for this route
    const isManagerRoute = allowedModes.includes("manager");
    const isTalentRoute = allowedModes.includes("talent");

    if (isManagerRoute && mode === "manager" && !isStaffRole) {
      return <Navigate to="/" replace />;
    }

    if (isTalentRoute && mode === "talent" && !isTalentRole) {
      return <Navigate to="/" replace />;
    }

    // General mode check
    if (!allowedModes.includes(mode)) {
      return <Navigate to="/" replace />;
    }
  }

  return <>{children}</>;
};
