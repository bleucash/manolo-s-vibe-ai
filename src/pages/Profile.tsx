import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserMode } from "@/contexts/UserModeContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LogOut, Grid3X3, User, Activity } from "lucide-react"; // Removed Loader2
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";

const Profile = () => {
  const navigate = useNavigate();
  const { mode, setMode, isManager, isTalent, activeVenueId, isLoading: contextLoading } = useUserMode();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("about");

  useEffect(() => {
    // Sync active tab with current mode
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
      if (profileData) {
        setProfile(profileData);
      }
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
        toast.success("Talent Mode Active", { duration: 1200 });
      } else if (isManager) {
        setMode("manager");
        toast.success("Manager Mode Active", { duration: 1200 });
      } else {
        toast.error("Verified role required.");
      }
    } else {
      setMode("guest");
      toast.success("Guest Mode Active", { duration: 1200 });
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  // ✅ UNIFIED LOADING STRATEGY
  // Return null to let the ProtectedRoute's LoadingState (Neural Engine)
  // persist until both profile data and user context are ready.
  if (loading || contextLoading) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background pb-24 animate-in fade-in duration-700">
      {/* Banner */}
      <div className="relative w-full h-48 bg-zinc-900 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />

        {/* Mode Toggle */}
        <div className="absolute top-4 left-4 z-20">
          <button
            onClick={toggleUserMode}
            className={`h-9 w-32 rounded-full border backdrop-blur-md transition-all flex items-center px-1 ${
              mode !== "guest"
                ? "bg-neon-green/20 border-neon-green/40 shadow-[0_0_15px_rgba(57,255,20,0.2)]"
                : "bg-black/50 border-white/10"
            }`}
          >
            <div
              className={`w-6 h-6 rounded-full bg-white shadow-lg transform transition-transform duration-300 ${
                mode !== "guest" ? "translate-x-[92px]" : "translate-x-0"
              }`}
            />
            <span className="absolute w-full text-center text-[10px] font-black uppercase tracking-widest text-white">
              {mode === "guest" ? "Guest" : mode === "talent" ? "Talent" : "Manager"}
            </span>
          </button>
        </div>
      </div>

      {/* Profile Header */}
      <div className="px-6 -mt-12 relative z-10 space-y-4">
        <Avatar className="w-24 h-24 border-4 border-background shadow-2xl">
          <AvatarImage src={profile?.avatar_url} />
          <AvatarFallback className="bg-zinc-800 text-zinc-500 font-bold">
            {profile?.username?.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>

        <div>
          <h1 className="text-3xl font-display text-white uppercase tracking-tighter leading-none">
            {profile?.username}
          </h1>
          <div className="flex gap-2 mt-2">
            <Badge
              className={`uppercase text-[9px] font-black tracking-widest px-2 py-0.5 border-none ${
                mode === "manager"
                  ? "bg-neon-green text-black"
                  : mode === "talent"
                    ? "bg-neon-purple text-white shadow-[0_0_10px_rgba(191,0,255,0.3)]"
                    : "bg-zinc-800 text-zinc-400"
              }`}
            >
              {mode} mode active
            </Badge>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full bg-transparent border-b border-white/5 h-12 px-6 justify-start gap-8">
            {mode === "manager" && (
              <TabsTrigger
                value="venue"
                className="data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-neon-green px-0 pb-3 text-zinc-500 uppercase text-[10px] font-bold tracking-widest transition-all"
              >
                <Activity className="w-4 h-4 mr-2" /> My Venue
              </TabsTrigger>
            )}
            {mode === "talent" && (
              <TabsTrigger
                value="portfolio"
                className="data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-neon-purple px-0 pb-3 text-zinc-500 uppercase text-[10px] font-bold tracking-widest transition-all"
              >
                <Grid3X3 className="w-4 h-4 mr-2" /> Gigs
              </TabsTrigger>
            )}
            <TabsTrigger
              value="about"
              className="data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-white/40 px-0 pb-3 text-zinc-500 uppercase text-[10px] font-bold tracking-widest transition-all"
            >
              <User className="w-4 h-4 mr-2" /> Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="venue" className="p-6">
            <Card className="bg-zinc-900/50 border-white/5 p-6 space-y-4 backdrop-blur-sm">
              <h3 className="text-white font-display text-lg uppercase leading-none">Venue Control</h3>
              <p className="text-sm text-zinc-500 font-body">Manage your public vibe and live schedule.</p>
              <Button
                className="w-full h-12 bg-neon-green text-black font-black uppercase tracking-widest hover:bg-neon-green/90 transition-all shadow-lg shadow-neon-green/10"
                onClick={() => navigate(`/venue/${activeVenueId}`)}
              >
                View Public Profile
              </Button>
            </Card>
          </TabsContent>

          <TabsContent value="portfolio" className="p-6">
            <div className="text-center py-12 border border-dashed border-white/10 rounded-2xl bg-zinc-900/20">
              <p className="text-zinc-600 italic text-[10px] uppercase font-black tracking-[0.3em]">
                Performance Data Syncing...
              </p>
            </div>
          </TabsContent>

          <TabsContent value="about" className="p-6 space-y-6">
            <div className="space-y-4">
              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest px-1">Account Actions</p>
              <Button
                variant="outline"
                className="w-full h-12 border-red-500/20 text-red-500 hover:bg-red-500/10 transition-colors uppercase font-bold text-[10px] tracking-widest"
                onClick={handleLogout}
              >
                <LogOut className="w-4 h-4 mr-2" /> Log Out Neural Link
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Profile;
