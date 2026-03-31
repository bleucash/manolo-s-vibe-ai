import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { UserModeProvider, useUserMode } from "@/contexts/UserModeContext";
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

// 🛡️ THE CEO GATE: Ironclad identity check
const CEORoute = ({ children }: { children: React.ReactNode }) => {
  const { session } = useUserMode();
  // Ensure this matches your official login email
  const isCEO = session?.user?.email === "jbray131@gmail.com"; 

  if (!session) return <Navigate to="/auth" />;
  if (!isCEO) {
    console.error("Access Denied: Neural credentials do not match CEO signature.");
    return <Navigate to="/discovery" />;
  }
  
  return <>{children}</>;
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
          <Route path="/venue/:id" element={<Venue />} />
          <Route path="/talent/:id" element={<TalentProfile />} />

          {/* GUEST & IDENTITY SETTINGS */}
          <Route path="/profile" element={<Profile />} />
          <Route path="/wallet" element={<Wallet />} />

          {/* SOCIAL SECTOR */}
          <Route path="/messages" element={<Messages />} />

          {/* TALENT PROFESSIONAL SECTOR */}
          <Route path="/gigs" element={<Gigs />} />
          <Route path="/talent-manage" element={<TalentManage />} />

          {/* MANAGER/VENUE PROFESSIONAL SECTOR */}
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/dashboard/:id" element={<Dashboard />} />

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
