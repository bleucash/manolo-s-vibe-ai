import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { useUserMode } from "@/contexts/UserModeContext";
import { DashboardGuard } from "@/components/DashboardGuard";
import ManagerDashboard from "@/components/ManagerDashboard";
import LoadingState from "@/components/ui/LoadingState";

// Only ever mounted as DashboardGuard's children - i.e. only after
// ownership of the target venue has already been confirmed true. Safe to
// sync the URL's venue id into the shared activeVenueId session state
// here: a user who doesn't own this venue never reaches this component,
// so activeVenueId can never get overwritten for a venue they don't own.
const ManagerDashboardPanel = ({ urlVenueId }: { urlVenueId?: string }) => {
  const { session, activeVenueId, setActiveVenueId } = useUserMode();

  useEffect(() => {
    if (urlVenueId && urlVenueId !== activeVenueId) {
      setActiveVenueId(urlVenueId);
    }
  }, [urlVenueId, activeVenueId, setActiveVenueId]);

  return <ManagerDashboard userId={session?.user?.id ?? ""} />;
};

const Dashboard = () => {
  const { id: urlVenueId } = useParams(); // Assumes URL is /dashboard/:id
  const { activeVenueId, isLoading } = useUserMode();

  // Use the ID from the URL or the one active in the user's session
  const targetVenueId = urlVenueId || activeVenueId;

  if (isLoading) {
    return <LoadingState fullPage />;
  }

  return (
    <DashboardGuard venueId={targetVenueId || ""}>
      <ManagerDashboardPanel urlVenueId={urlVenueId} />
    </DashboardGuard>
  );
};

export default Dashboard;
