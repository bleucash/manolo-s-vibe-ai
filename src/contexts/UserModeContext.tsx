import React, { createContext, useContext, useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Session } from "@supabase/supabase-js";
import LoadingState from "@/components/ui/LoadingState"; // ✅ ADD THIS IMPORT

// ... (types and interfaces stay the same)

export const UserModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [mode, setModeState] = useState<UserMode>("guest");
  const [isManager, setIsManager] = useState(false);
  const [isTalent, setIsTalent] = useState(false);
  const [userVenues, setUserVenues] = useState<Venue[]>([]);
  const [activeVenueId, setActiveVenueIdState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isVerifying = useRef(false);

  // ... (setMode, setActiveVenueId, syncProfileAndVenues logic stay the same)

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data: { session: initSession } }) => {
      if (!mounted) return;
      if (initSession) {
        setSession(initSession);
        syncProfileAndVenues(initSession.user.id);
      } else {
        setIsLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!mounted) return;
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        setSession(newSession);
        if (newSession) syncProfileAndVenues(newSession.user.id);
      } else if (event === "SIGNED_OUT") {
        localStorage.clear();
        setSession(null);
        setIsManager(false);
        setIsTalent(false);
        setUserVenues([]);
        setActiveVenueIdState(null);
        setModeState("guest");
        setIsLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // ✅ THE NEURAL FIX:
  // If we are loading, block the children from rendering and show the Master Loader.
  // This prevents the App from flashing default "blue" primary states on refresh.
  if (isLoading) {
    return <LoadingState />;
  }

  return (
    <UserModeContext.Provider
      value={{ mode, setMode, isManager, isTalent, userVenues, activeVenueId, setActiveVenueId, isLoading, session }}
    >
      {children}
    </UserModeContext.Provider>
  );
};

export const useUserMode = () => {
  const context = useContext(UserModeContext);
  if (context === undefined) throw new Error("useUserMode must be used within UserModeProvider");
  return context;
};
