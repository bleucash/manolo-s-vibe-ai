import React, { Component, ErrorInfo, ReactNode } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { UserModeProvider, useUserMode } from "./contexts/UserModeContext";
import BottomNav from "./components/BottomNav";
import { ProtectedRoute } from "./components/ProtectedRoute";

// Page Imports
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Discovery from "./pages/Discovery";
import TalentDirectory from "./pages/TalentDirectory";
import TalentProfile from "./pages/TalentProfile";
import Profile from "./pages/Profile";
import Wallet from "./pages/Wallet";
import Gigs from "./pages/Gigs";
import Dashboard from "./pages/Dashboard";
import Bouncer from "./pages/Bouncer";
import Venue from "./pages/Venue";
import ManageVenue from "./pages/ManageVenue"; // Added for Manager Flow
import Notifications from "./pages/Notifications";
import NotFound from "./pages/NotFound";

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(_: Error) {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen flex flex-col items-center justify-center bg-black text-white p-6 text-center">
          <h2 className="text-2xl font-display uppercase text-red-500 mb-4 tracking-tighter">Neural Engine Failure</h2>
          <button
            onClick={() => window.location.assign("/")}
            className="bg-white text-black px-8 py-3 rounded-full font-bold uppercase text-[10px] tracking-widest"
          >
            Reboot System
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const queryClient = new QueryClient();

const AppContent = () => {
  const { isLoading } = useUserMode();

  if (isLoading) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-black">
        <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-4" />
        <div className="animate-pulse text-primary font-display uppercase tracking-widest text-[10px]">
          Synchronizing Neural Engine...
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <Toaster />
      <Sonner position="top-center" expand={false} richColors />
      <div className="min-h-screen bg-background pb-20">
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/discovery" element={<Discovery />} />
          <Route path="/venue/:id" element={<Venue />} />

          {/* Manager Control Center */}
          <Route
            path="/venue/:id/manage"
            element={
              <ProtectedRoute allowedModes={["manager"]}>
                <ManageVenue />
              </ProtectedRoute>
            }
          />

          <Route path="/talent-directory" element={<TalentDirectory />} />
          <Route path="/talent/:id" element={<TalentProfile />} />
          <Route path="/users/:id" element={<TalentProfile />} />

          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/wallet"
            element={
              <ProtectedRoute>
                <Wallet />
              </ProtectedRoute>
            }
          />
          <Route
            path="/notifications"
            element={
              <ProtectedRoute>
                <Notifications />
              </ProtectedRoute>
            }
          />

          <Route
            path="/gigs"
            element={
              <ProtectedRoute allowedModes={["talent"]}>
                <Gigs />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute allowedModes={["manager"]}>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/bouncer"
            element={
              <ProtectedRoute allowedModes={["manager"]}>
                <Bouncer />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<NotFound />} />
        </Routes>
        <BottomNav />
      </div>
    </TooltipProvider>
  );
};

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <UserModeProvider>
          <AppContent />
        </UserModeProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
