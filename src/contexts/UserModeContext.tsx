import React, { createContext, useContext, useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Session } from "@supabase/supabase-js";

type UserMode = "guest" | "talent" | "manager";

interface Venue {
  id: string;
  name: string;
  image_url: string | null;
}

interface UserModeContextType {
  mode: UserMode;
  setMode: (mode: UserMode) => void;
  isManager: boolean;
  isTalent: boolean;
  userVenues: Venue[];
  activeVenueId: string | null;
  setActiveVenueId: (id: string | null) => void;
  isLoading: boolean;
  session: Session | null;
}

const UserModeContext = createContext<UserModeContextType | undefined>(undefined);

export const UserModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [mode, setModeState] = useState<UserMode>("guest");
  const [isManager, setIsManager] = useState(false);
  const [isTalent, setIsTalent] = useState(false);
  const [userVenues, setUserVenues] = useState<Venue[]>([]);
  const [activeVenueId, setActiveVenueIdState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isVerifying = useRef(false);

  const setMode = (newMode: UserMode) => {
    setModeState(newMode);
    localStorage.setItem("userMode", newMode);
  };

  const syncProfileAndVenues = async (userId: string) => {
    if (isVerifying.current) return;
    isVerifying.current = true;
    setIsLoading(true);

    try {
      const { data: profile } = await supabase.from("profiles").select("role_type").eq("id", userId).maybeSingle();
      if (profile) {
        const role = profile.role_type || "guest";
        const isMgr = role === "manager" || role === "venue_manager";
        const isTal = role === "talent";

        setIsManager(isMgr);
        setIsTalent(isTal);
        setModeState(isMgr ? "manager" : isTal ? "talent" : "guest");

        if (isMgr) {
          const { data: venues } = await supabase.from("venues").select("id, name, image_url").eq("owner_id", userId);
          if (venues?.length) {
            setUserVenues(venues);
            const storedId = localStorage.getItem("activeVenueId");
            setActiveVenueIdState(venues.find((v) => v.id === storedId)?.id || venues[0].id);
          }
        }
      }
    } finally {
      setIsLoading(false);
      isVerifying.current = false;
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (s) {
        setSession(s);
        syncProfileAndVenues(s.user.id);
      } else {
        setIsLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === "SIGNED_IN") {
        setSession(s);
        if (s) syncProfileAndVenues(s.user.id);
      } else if (event === "SIGNED_OUT") {
        setSession(null);
        setModeState("guest");
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <UserModeContext.Provider
      value={{
        mode,
        setMode,
        isManager,
        isTalent,
        userVenues,
        activeVenueId,
        setActiveVenueId: setActiveVenueIdState,
        isLoading,
        session,
      }}
    >
      {children}
    </UserModeContext.Provider>
  );
};

export const useUserMode = () => {
  const context = useContext(UserModeContext);
  if (context === undefined) throw new Error("useUserMode context failure");
  return context;
};
