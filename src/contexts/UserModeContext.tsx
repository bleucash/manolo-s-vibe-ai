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

  const setActiveVenueId = (id: string | null) => {
    setActiveVenueIdState(id);
    if (id) localStorage.setItem("activeVenueId", id);
    else localStorage.removeItem("activeVenueId");
  };

  const syncProfileAndVenues = async (userId: string) => {
    if (isVerifying.current) return;
    isVerifying.current = true;
    setIsLoading(true);

    try {
      const { data: profile } = await supabase.from("profiles").select("role_type").eq("id", userId).maybeSingle();

      if (profile) {
        const role = profile.role_type || "guest";
        const isMgr = role === "venue_manager";
        const isTal = role === "talent";

        setIsManager(isMgr);
        setIsTalent(isTal);

        let correctMode: UserMode = "guest";
        if (isMgr) correctMode = "manager";
        else if (isTal) correctMode = "talent";

        localStorage.setItem("userMode", correctMode);
        setModeState(correctMode);

        if (isMgr) {
          const { data: venues } = await supabase.from("venues").select("id, name, image_url").eq("owner_id", userId);

          if (venues && venues.length > 0) {
            setUserVenues(venues);
            const storedVenueId = localStorage.getItem("activeVenueId");
            const isValid = venues.find((v) => v.id === storedVenueId);
            const finalId = isValid ? storedVenueId : venues[0].id;
            setActiveVenueIdState(finalId);
            localStorage.setItem("activeVenueId", finalId as string);
          }
        }
      } else {
        setModeState("guest");
        localStorage.setItem("userMode", "guest");
      }
    } catch {
      setModeState("guest");
      localStorage.setItem("userMode", "guest");
    } finally {
      setIsLoading(false);
      isVerifying.current = false;
    }
  };

  useEffect(() => {
    let mounted = true;

    // 1. Initial Handshake
    supabase.auth.getSession().then(({ data: { session: initSession } }) => {
      if (!mounted) return;
      if (initSession) {
        setSession(initSession);
        syncProfileAndVenues(initSession.user.id);
      } else {
        setIsLoading(false);
      }
    });

    // 2. Auth State Listener
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
