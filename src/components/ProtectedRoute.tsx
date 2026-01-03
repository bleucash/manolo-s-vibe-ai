import { Navigate, useLocation } from "react-router-dom";
import { useUserMode } from "@/contexts/UserModeContext";
import { useWorkerPermissions } from "@/hooks/useWorkerPermissions";

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

  // 1. Loading State: Don't redirect until we know who the user is
  if (contextLoading || permissionsLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  // 2. Auth Check: If no session, send to login but save the current location to redirect back later
  if (!session) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // 3. Permission & Mode Check:
  if (allowedModes) {
    // If they want to enter 'manager' mode, check if they actually have staff permissions
    if (mode === "manager" && !isStaffRole) {
      return <Navigate to="/" replace />;
    }

    // If they want to enter 'talent' mode, check if they are actually talent
    if (mode === "talent" && !isTalentRole) {
      return <Navigate to="/" replace />;
    }

    // Finally, check if the current mode is allowed for this specific route
    if (!allowedModes.includes(mode)) {
      return <Navigate to="/" replace />;
    }
  }

  return <>{children}</>;
};
