import { Navigate } from "react-router-dom";
import { useUserMode } from "@/contexts/UserModeContext";

type UserMode = "guest" | "talent" | "manager";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedModes?: UserMode[];
}

export const ProtectedRoute = ({ children, allowedModes }: ProtectedRouteProps) => {
  const { isLoading, session, mode } = useUserMode();

  // Wait for context to finish loading
  if (isLoading) {
    return null;
  }

  // No session = redirect to auth
  if (!session) {
    return <Navigate to="/auth" replace />;
  }

  // If allowedModes is provided and current mode isn't in it, redirect home
  if (allowedModes && !allowedModes.includes(mode)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};
