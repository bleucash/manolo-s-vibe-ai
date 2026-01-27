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
  const [mode, setModeState] = useState<UserMode>(() => (localStorage.getItem("userMode") as UserMode) || "guest");
  const [isManager, setIsManager] = useState(false);
  const [isTalent, setIsTalent] = useState(false);
  const [userVenues, setUserVenues] = useState<Venue[]>([]);
  const [activeVenueId, setActiveVenueIdState] = useState<string | null>(localStorage.getItem("activeVenueId"));
  const [isLoading, setIsLoading] = useState(true);
  const isSyncing = useRef(false);

  const setMode = (newMode: UserMode) => {
    setModeState(newMode);
    localStorage.setItem("userMode", newMode);
  };
  const setActiveVenueId = (id: string | null) => {
    setActiveVenueIdState(id);
    if (id) localStorage.setItem("activeVenueId", id);
    else localStorage.removeItem("activeVenueId");
  };

  const syncProfile = async (userId: string) => {
    if (isSyncing.current) return;
    isSyncing.current = true;
    try {
      const { data: profile } = await supabase.from("profiles").select("role_type").eq("id", userId).maybeSingle();
      if (profile) {
        const role = profile.role_type || "guest";
        const finalRole: UserMode =
          role === "manager" || role === "venue_manager" ? "manager" : role === "talent" ? "talent" : "guest";
        setModeState(finalRole);
        setIsManager(finalRole === "manager");
        setIsTalent(finalRole === "talent");
        if (finalRole === "manager") {
          const { data: venues } = await supabase.from("venues").select("id, name, image_url").eq("owner_id", userId);
          if (venues?.length) {
            setUserVenues(venues);
            if (!activeVenueId) setActiveVenueId(venues[0].id);
          }
        }
      }
    } finally {
      setIsLoading(false);
      isSyncing.current = false;
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      if (s) syncProfile(s.user.id);
      else setIsLoading(false);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s) syncProfile(s.user.id);
      else {
        setIsLoading(false);
        setModeState("guest");
      }
    });
    return () => subscription.unsubscribe();
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
  const c = useContext(UserModeContext);
  if (!c) throw new Error("useUserMode must be used within Provider");
  return c;
};
