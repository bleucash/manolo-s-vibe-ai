import { useEffect, useState } from "react";
import { HeroReel } from "@/components/HeroReel";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserMode } from "@/contexts/UserModeContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LogOut, Grid3X3, User, Activity, Zap, Shield, Settings } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import LoadingState from "@/components/ui/LoadingState";
import { cn } from "@/lib/utils";

const Profile = () => {
  const navigate = useNavigate();
  const { mode, setMode, isManager, isTalent, activeVenueId, isLoading: contextLoading } = useUserMode();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("about");

  // Sync active tab with current mode on mount or mode change
  useEffect(() => {
    if (mode === "manager") setActiveTab("venue");
    else if (mode === "talent") setActiveTab("portfolio");
    else setActiveTab("about");
  }, [mode]);

  useEffect(() => {
    fetchProfileData();
  }, []);

  const fetchProfileData = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      const { data: profileData } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      if (profileData) setProfile(profileData);
    } catch (error) {
      console.error("Profile Fetch Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleUserMode = () => {
    if (mode === "guest") {
      if (isTalent) {
        setMode("talent");
        toast.success("Talent Mode Initialized");
      } else if (isManager) {
        setMode("manager");
        toast.success("Manager Control Active");
      } else {
        toast.error("Verified Role Required", { description: "Complete onboarding to unlock." });
      }
    } else {
      setMode("guest");
      toast.success("Guest Mode Active");
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  // ✅ LOCALIZED LOADING: Prevents the "Blackout" flicker
  if (loading || contextLoading) {
    return <LoadingState />;
  }

  return (
    <div className="min-h-screen bg-black pb-32 animate-in fade-in duration-700">
      {/* SYSTEM BANNER */}
      <div className="relative w-full h-56">
        <HeroReel
          fallbackImageUrl="https://images.unsplash.com/photo-1614850523296-d8c1af93d400?q=80&w=2070"
          alt="Test banner"
          className="w-full h-full"
        />

        {/* NEURAL MODE SWITCH */}
        <div className="absolute top-8 left-6 z-20">
          <div className="flex flex-col gap-2">
            <span className="text-[8px] font-black text-white/40 uppercase tracking-[0.3em] ml-1">System State</span>
            <button
              onClick={toggleUserMode}
              className={cn(
                "h-10 w-36 rounded-full border backdrop-blur-xl transition-all duration-500 flex items-center px-1 relative overflow-hidden",
                mode !== "guest"
                  ? "bg-neon-green/10 border-neon-green/30 shadow-[0_0_20px_rgba(57,255,20,0.15)]"
                  : "bg-white/5 border-white/10",
              )}
            >
              <div
                className={cn(
                  "w-8 h-8 rounded-full shadow-2xl transform transition-all duration-500 ease-spring z-10 flex items-center justify-center",
                  mode !== "guest" ? "translate-x-[96px] bg-neon-green" : "translate-x-0 bg-white",
                )}
              >
                <Zap className={cn("w-4 h-4", mode !== "guest" ? "text-black" : "text-black")} />
              </div>
              <span
                className={cn(
                  "absolute w-full text-center text-[9px] font-black uppercase tracking-widest transition-colors",
                  mode !== "guest" ? "text-neon-green pr-8" : "text-white pl-8",
                )}
              >
                {mode}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* USER IDENTITY HEADER */}
      <div className="px-8 -mt-16 relative z-10 space-y-6">
        <div className="relative inline-block">
          <Avatar className="w-32 h-32 border-[6px] border-black shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
            <AvatarImage src={profile?.avatar_url} />
            <AvatarFallback className="bg-zinc-900 text-zinc-600 text-2xl font-display italic">
              {profile?.username?.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="absolute bottom-2 right-2 w-6 h-6 bg-neon-blue rounded-full border-4 border-black flex items-center justify-center shadow-lg">
            <Shield className="w-2.5 h-2.5 text-black" />
          </div>
        </div>

        <div>
          <h1 className="text-5xl font-display text-white uppercase tracking-tighter italic leading-none mb-2">
            {profile?.display_name || profile?.username}
          </h1>
          <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.4em]">
            Neural ID: {profile?.id.slice(0, 8)}
          </p>
        </div>
      </div>

      {/* NAVIGATION INTERFACE */}
      <div className="mt-12">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full bg-transparent border-b border-white/5 h-14 px-8 justify-start gap-10">
            {mode === "manager" && (
              <TabsTrigger
                value="venue"
                className="data-[state=active]:text-neon-green data-[state=active]:border-b-2 data-[state=active]:border-neon-green px-0 pb-4 text-zinc-600 uppercase text-[10px] font-black tracking-widest transition-all"
              >
                <Activity className="w-3.5 h-3.5 mr-2" /> Sector
              </TabsTrigger>
            )}
            {mode === "talent" && (
              <TabsTrigger
                value="portfolio"
                className="data-[state=active]:text-neon-purple data-[state=active]:border-b-2 data-[state=active]:border-neon-purple px-0 pb-4 text-zinc-600 uppercase text-[10px] font-black tracking-widest transition-all"
              >
                <Grid3X3 className="w-3.5 h-3.5 mr-2" /> Gigs
              </TabsTrigger>
            )}
            <TabsTrigger
              value="about"
              className="data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-white px-0 pb-4 text-zinc-600 uppercase text-[10px] font-black tracking-widest transition-all"
            >
              <Settings className="w-3.5 h-3.5 mr-2" /> System
            </TabsTrigger>
          </TabsList>

          {/* MANAGER CONTENT */}
          <TabsContent value="venue" className="p-8 animate-in slide-in-from-bottom-2 duration-500">
            <Card className="bg-zinc-900/20 border-white/5 p-8 rounded-[2.5rem] relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-1.5 h-full bg-neon-green opacity-50" />
              <h3 className="text-white font-display text-2xl uppercase italic tracking-tight mb-2">Venue Control</h3>
              <p className="text-sm text-zinc-500 font-medium leading-relaxed mb-8">
                Manage your live environment, pricing, and neural metrics.
              </p>
              <Button
                className="w-full h-16 bg-white text-black font-black uppercase tracking-widest text-[10px] rounded-2xl hover:bg-neon-green transition-all shadow-xl"
                onClick={() => navigate(`/venue/${activeVenueId}`)}
              >
                Access Public Sector
              </Button>
            </Card>
          </TabsContent>

          {/* TALENT CONTENT */}
          <TabsContent value="portfolio" className="p-8 animate-in slide-in-from-bottom-2 duration-500">
            <div className="py-20 text-center border border-dashed border-zinc-800 rounded-[2.5rem] bg-zinc-900/10">
              <Zap className="w-8 h-8 text-zinc-800 mx-auto mb-4" />
              <p className="text-zinc-700 italic text-[10px] uppercase font-black tracking-[0.5em]">
                Neural Sync in Progress
              </p>
            </div>
          </TabsContent>

          {/* SETTINGS CONTENT */}
          <TabsContent value="about" className="p-8 space-y-8 animate-in slide-in-from-bottom-2 duration-500">
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-1 h-1 bg-zinc-700 rounded-full" />
                <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Neural Link Management</p>
              </div>
              <Button
                variant="outline"
                className="w-full h-16 border-white/5 bg-zinc-900/30 text-zinc-400 hover:border-red-500/50 hover:text-red-500 transition-all uppercase font-black text-[10px] tracking-widest rounded-2xl"
                onClick={handleLogout}
              >
                <LogOut className="w-4 h-4 mr-3" /> Terminate Session
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Profile;
