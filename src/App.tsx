import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { UserModeProvider, useUserMode } from "@/contexts/UserModeContext";
import { DashboardGuard } from "@/components/DashboardGuard";
import LoadingState from "@/components/ui/LoadingState";
import BottomNav from "@/components/BottomNav";
import Index from "./pages/Index";
import Discovery from "./pages/Discovery";
import Venue from "./pages/Venue";
import TalentProfile from "./pages/TalentProfile";
import Profile from "./pages/Profile";
import Gigs from "./pages/Gigs";
import Dashboard from "./pages/Dashboard";
import TalentManage from "./pages/TalentManage";
import CEODashboard from "./pages/CEODashboard";
import Auth from "./pages/Auth";
import Messages from "./pages/Messages";
import Wallet from "./pages/Wallet";
import VenueManage from "./pages/VenueManage";
import GuestProfile from "./pages/GuestProfile";
import Bouncer from "./pages/Bouncer";
import Events from "./pages/Events";
import Notifications from "./pages/Notifications";
import TalentDirectory from "./pages/TalentDirectory";

// 🛡️ CEO ROUTE: UI convenience only — hides the dashboard from non-CEO users.
// The real security boundary lives server-side in the `admin-actions` edge function,
// which validates the caller's JWT against the ADMIN_USER_ID secret before any write.
const CEORoute = ({ children }: { children: React.ReactNode }) => {
  const { session, isLoading } = useUserMode();
  const isCEO = session?.user?.email === "jbray131@gmail.com";

  if (isLoading) return <LoadingState fullPage />;
  if (!session) return <Navigate to="/auth" />;
  if (!isCEO) {
    console.error("Access Denied: Neural credentials do not match CEO signature.");
    return <Navigate to="/discovery" />;
  }

  return <>{children}</>;
};

// 🔒 REQUIRE AUTH: gates a route behind a logged-in session.
const RequireAuth = ({ children }: { children: React.ReactNode }) => {
  const { session, isLoading } = useUserMode();

  if (isLoading) return <LoadingState fullPage />;
  if (!session) return <Navigate to="/auth" />;

  return <>{children}</>;
};

// 🛡️ BOUNCER ROUTE: reuses DashboardGuard's ownership check rather than
// inventing a new one — activeVenueId only ever resolves to a venue the
// user owns (see UserModeContext), but DashboardGuard re-verifies that
// server-side via useVenueStatus regardless.
const BouncerRoute = ({ children }: { children: React.ReactNode }) => {
  const { activeVenueId, isLoading } = useUserMode();

  if (isLoading) return <LoadingState fullPage />;
  if (!activeVenueId) return <Navigate to="/dashboard" />;

  return <DashboardGuard venueId={activeVenueId}>{children}</DashboardGuard>;
};

const App = () => (
  <BrowserRouter>
    <UserModeProvider>
      <div className="min-h-screen bg-background pb-20">
        {" "}
        {/* pb-20 prevents BottomNav overlap */}
        <Routes>
          {/* PUBLIC SECTOR */}
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/discovery" element={<Discovery />} />
          <Route path="/venue/manage" element={<VenueManage />} />
          <Route path="/venue/:id" element={<Venue />} />
          <Route path="/talent/:id" element={<TalentProfile />} />
          <Route path="/talent-directory" element={<TalentDirectory />} />
          <Route path="/users/:id" element={<GuestProfile />} />
          <Route path="/events" element={<Events />} />

          {/* GUEST & IDENTITY SETTINGS */}
          <Route path="/profile" element={<Profile />} />
          <Route path="/wallet" element={<Wallet />} />

          {/* SOCIAL SECTOR */}
          <Route path="/messages" element={<Messages />} />
          <Route
            path="/notifications"
            element={
              <RequireAuth>
                <Notifications />
              </RequireAuth>
            }
          />

          {/* TALENT PROFESSIONAL SECTOR */}
          <Route path="/gigs" element={<Gigs />} />
          <Route path="/talent-manage" element={<TalentManage />} />

          {/* MANAGER/VENUE PROFESSIONAL SECTOR */}
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/dashboard/:id" element={<Dashboard />} />
          <Route
            path="/bouncer"
            element={
              <BouncerRoute>
                <Bouncer />
              </BouncerRoute>
            }
          />

          {/* 🔐 CEO COMMAND & CONTROL (HIDDEN) */}
          <Route
            path="/ceo"
            element={
              <CEORoute>
                <CEODashboard />
              </CEORoute>
            }
          />

          {/* FALLBACK */}
          <Route path="*" element={<Navigate to="/discovery" />} />
        </Routes>
        <BottomNav />
      </div>
      <Toaster />
    </UserModeProvider>
  </BrowserRouter>
);

export default App;
