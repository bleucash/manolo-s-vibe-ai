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

  /**
   * ✅ PERSISTENT NAVIGATION FIX:
   * Instead of a full-page 'blanket', we use the localized LoadingState.
   * By NOT passing 'fullPage', it defaults to a transparent background
   * and stays within the routing container, leaving the BottomNav visible.
   */
  if ((contextLoading || permissionsLoading) && session) {
    return <LoadingState />;
  }

  // Auth Check: No session and done loading? Go to Auth.
  if (!session && !contextLoading) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // Permission & Mode Check:
  // Only evaluate once we are 100% sure of the user's status.
  if (allowedModes && !contextLoading && !permissionsLoading) {
    const isManagerRoute = allowedModes.includes("manager");
    const isTalentRoute = allowedModes.includes("talent");

    // Manager Route Protection
    if (isManagerRoute && mode === "manager" && !isStaffRole) {
      return <Navigate to="/" replace />;
    }

    // Talent Route Protection
    if (isTalentRoute && mode === "talent" && !isTalentRole) {
      return <Navigate to="/" replace />;
    }

    // General Mode Switch Protection
    if (!allowedModes.includes(mode)) {
      return <Navigate to="/" replace />;
    }
  }

  // If all checks pass, show the page content
  return <>{children}</>;
};
