import { Navigate, useLocation } from "react-router-dom";
import { useUserMode } from "@/contexts/UserModeContext";
import { useWorkerPermissions } from "@/hooks/useWorkerPermissions";
import LoadingState from "@/components/ui/LoadingState";

export const ProtectedRoute = ({
  children,
  allowedModes,
}: {
  children: React.ReactNode;
  allowedModes?: ("guest" | "talent" | "manager")[];
}) => {
  const { isLoading: contextLoading, session, mode } = useUserMode();
  const location = useLocation();
  const { isTalentRole, isStaffRole, loading: permissionsLoading } = useWorkerPermissions(session?.user?.id || null);

  // ✅ FIX: Do not show LoadingState if we already have a session.
  // This stops the "Neural Engine" from popping up when switching tabs.
  if ((contextLoading || permissionsLoading) && !session) {
    return <LoadingState />;
  }

  if (!session) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  if (allowedModes) {
    if (mode === "manager" && !isStaffRole) return <Navigate to="/" replace />;
    if (mode === "talent" && !isTalentRole) return <Navigate to="/" replace />;
    if (!allowedModes.includes(mode)) return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};
