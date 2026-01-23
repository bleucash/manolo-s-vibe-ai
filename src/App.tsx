import React, { Component, ErrorInfo, ReactNode } from "react";
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

const queryClient = new QueryClient();

const AppContent = () => {
  const { isLoading, session } = useUserMode();

  // ✅ ONLY show the full-screen loader on the VERY FIRST boot.
  // Once we have a session or have confirmed there isn't one, we never show this again.
  if (isLoading && !session) {
    return <LoadingState />;
  }

  return (
    <TooltipProvider>
      <Toaster />
      <Sonner position="top-center" expand={false} richColors />

      {/* ✅ STABLE SHELL: BottomNav is now a sibling to the content, not a child. */}
      <div className="relative min-h-screen bg-black">
        <div className="pb-0">
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/discovery" element={<Discovery />} />
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

        {/* ✅ Navigation stays mounted during route transitions */}
        <BottomNav />
      </div>
    </TooltipProvider>
  );
};

// ... ErrorBoundary stays same ...
export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <UserModeProvider>
          <AppContent />
        </UserModeProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
