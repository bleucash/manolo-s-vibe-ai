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

  // 🛡️ Guard the hook input
  const permissions = useWorkerPermissions(session?.user?.id || null);

  /**
   * ✅ FIX 1: THE NEURAL BUFFER
   * We do not allow ANY logic to run until BOTH syncs are finished.
   * Your old file checked session separately, which allowed the "Guest Gap".
   */
  const isSyncing = contextLoading || permissions.loading;

  if (isSyncing) {
    // We use fullPage here specifically for the Bouncer/Dashboard
    // to ensure the hardware/context has a clean slate.
    return <LoadingState fullPage />;
  }

  /**
   * ✅ FIX 2: HARD AUTH CHECK
   * Now that we are 100% sure loading is done, we check session.
   */
  if (!session) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  /**
   * ✅ FIX 3: SYNCHRONIZED ROLE VALIDATION
   * By this point, 'mode' is guaranteed to be its final value
   * (manager, talent, or guest) because we waited for permissions.loading.
   */
  if (allowedModes) {
    const hasPermission = allowedModes.includes(mode);

    // Role-specific cross-verification (The Bouncer Handshake)
    if (allowedModes.includes("manager") && !permissions.isStaffRole) {
      console.error("Neural Access Denied: Managerial Credentials Required");
      return <Navigate to="/" replace />;
    }

    if (!hasPermission) {
      return <Navigate to="/" replace />;
    }
  }

  return <>{children}</>;
};
