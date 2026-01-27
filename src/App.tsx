import React, { Component, ReactNode } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { UserModeProvider, useUserMode } from "./contexts/UserModeContext";
import BottomNav from "./components/BottomNav";
import { ProtectedRoute } from "./components/ProtectedRoute";
import LoadingState from "./components/ui/LoadingState";

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
import Messages from "./pages/Messages";
import Notifications from "./pages/Notifications";
import NotFound from "./pages/NotFound";

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; errorLog: string }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, errorLog: "" };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, errorLog: error.message };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen flex flex-col items-center justify-center bg-black text-white p-6 text-center">
          <h2 className="text-2xl font-display uppercase text-red-500 mb-2 tracking-tighter italic">
            Neural Engine Failure
          </h2>
          <p className="text-[8px] text-zinc-600 uppercase tracking-widest mb-8 max-w-xs overflow-hidden">
            Trace: {this.state.errorLog || "Unknown Core Collision"}
          </p>
          <button
            onClick={() => {
              localStorage.clear();
              window.location.assign("/");
            }}
            className="bg-white text-black px-10 h-14 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-[0_0_30px_rgba(255,255,255,0.1)]"
          >
            Reboot & Purge Cache
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const queryClient = new QueryClient();

const AppContent = () => {
  const { isLoading, session, mode } = useUserMode();

  // 🛡️ THE STABILIZER: Prevents the Bouncer from mounting
  // during the "Guest-to-Manager" transition gap.
  if (isLoading || (session && !mode)) {
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
            <Route path="/venue/:id" element={<Venue />} />
            <Route path="/talent-directory" element={<TalentDirectory />} />
            <Route path="/talent/:id" element={<TalentProfile />} />
            <Route path="/users/:id" element={<TalentProfile />} />

            <Route
              path="/messages"
              element={
                <ProtectedRoute>
                  <Messages />
                </ProtectedRoute>
              }
            />
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

            {/* 🛡️ BOUNCER SHIELD: Double-guarded route */}
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

        {/* Hide nav during hard loading to prevent ref collisions */}
        {!isLoading && <BottomNav />}
      </div>
    </TooltipProvider>
  );
};

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
