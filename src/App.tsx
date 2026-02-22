import React, { Component, ReactNode } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { UserModeProvider, useUserMode } from "./contexts/UserModeContext";
import BottomNav from "./components/BottomNav";
import { ProtectedRoute } from "./components/ProtectedRoute";
import LoadingState from "./components/ui/LoadingState"; // ✅ Verified Import

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
import Events from "./pages/Events";
import Messages from "./pages/Messages";
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
          <h2 className="text-2xl font-display uppercase text-red-500 mb-4 tracking-tighter italic">
            Neural Engine Failure
          </h2>
          <button
            onClick={() => window.location.assign("/")}
            className="bg-white text-black px-8 py-3 rounded-full font-bold uppercase text-[10px] tracking-widest transition-transform active:scale-95"
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
  const { isLoading, session } = useUserMode();
  const hasCachedMode = !!localStorage.getItem("userMode");

  // ✅ Persists the BottomNav by only showing full-page loader on initial zero-state boot
  if (isLoading && !session && !hasCachedMode) {
    return <LoadingState fullPage />;
  }

  return (
    <TooltipProvider>
      <Toaster />
      <Sonner position="top-center" expand={false} richColors />

      <div className="relative min-h-screen bg-black">
        <div className="pb-32">
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/discovery" element={<Discovery />} />
            <Route path="/events" element={<Events />} />
            <Route path="/venue/:id" element={<Venue />} />

            <Route
              path="/messages"
              element={
                <ProtectedRoute>
                  <Messages />
                </ProtectedRoute>
              }
            />

            <Route
              path="/venue/:id/manage"
              element={
                <ProtectedRoute allowedModes={["manager"]}>
                  <Venue />
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
        </div>

        <BottomNav />
      </div>
    </TooltipProvider>
  );
};

// ✅ Cleaned up the export structure to resolve line 148 errors
export default function App() {
  return (
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
}
