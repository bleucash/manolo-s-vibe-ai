import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserMode } from "@/contexts/UserModeContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LogOut, Grid3X3, User, Loader2, Activity } from "lucide-react";
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
    } catch {
      // Silently handle errors
    } finally {
      setLoading(false);
    }
  };

  // ✅ UI Logic Update: Swapped "Artist" for "Talent" for platform consistency
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

  if (loading || contextLoading)
    return (
      <div className="h-screen bg-black flex items-center justify-center">
        <Loader2 className="animate-spin text-neon-green" />
      </div>
    );

  return (
    <div className="min-h-screen bg-background pb-24">
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
              {/* ✅ Corrected Label: Artist -> Talent */}
              {mode === "guest" ? "Guest" : mode === "talent" ? "Talent" : "Manager"}
            </span>
          </button>
        </div>
      </div>

      {/* Profile Header */}
      <div className="px-6 -mt-12 relative z-10 space-y-4">
        <Avatar className="w-24 h-24 border-4 border-background shadow-2xl">
          <AvatarImage src={profile?.avatar_url} />
          <AvatarFallback>{profile?.username?.charAt(0)}</AvatarFallback>
        </Avatar>

        <div>
          <h1 className="text-3xl font-display text-white uppercase tracking-tighter">{profile?.username}</h1>
          <div className="flex gap-2 mt-1">
            <Badge
              className={
                mode === "manager"
                  ? "bg-neon-green text-black"
                  : mode === "talent"
                    ? "bg-neon-purple text-white" // Updated to match talent color theme
                    : "bg-zinc-800 text-zinc-400"
              }
            >
              {mode.toUpperCase()}
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
                className="data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-neon-green px-0 pb-3 text-zinc-500 uppercase text-[10px] font-bold tracking-widest"
              >
                <Activity className="w-4 h-4 mr-2" /> My Venue
              </TabsTrigger>
            )}
            {mode === "talent" && (
              <TabsTrigger
                value="portfolio"
                className="data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-neon-purple px-0 pb-3 text-zinc-500 uppercase text-[10px] font-bold tracking-widest"
              >
                <Grid3X3 className="w-4 h-4 mr-2" /> Gigs
              </TabsTrigger>
            )}
            <TabsTrigger
              value="about"
              className="data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-white/40 px-0 pb-3 text-zinc-500 uppercase text-[10px] font-bold tracking-widest"
            >
              <User className="w-4 h-4 mr-2" /> Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="venue" className="p-6">
            <Card className="bg-zinc-900 border-white/5 p-6 space-y-4">
              <h3 className="text-white font-display text-lg uppercase">Venue Control</h3>
              <p className="text-sm text-zinc-500 font-body">Manage your public vibe and live schedule.</p>
              <Button
                className="w-full h-12 bg-neon-green text-black font-bold uppercase tracking-widest"
                onClick={() => navigate(`/venue/${activeVenueId}`)}
              >
                View Public Profile
              </Button>
            </Card>
          </TabsContent>

          <TabsContent value="portfolio" className="p-6">
            <div className="text-center py-10 border border-dashed border-white/10 rounded-xl">
              <p className="text-zinc-600 italic text-sm uppercase font-bold tracking-widest">
                Performance Data Syncing...
              </p>
            </div>
          </TabsContent>

          <TabsContent value="about" className="p-6 space-y-6">
            <Button
              variant="outline"
              className="w-full border-red-500/20 text-red-500 hover:bg-red-500/10"
              onClick={handleLogout}
            >
              <LogOut className="w-4 h-4 mr-2" /> Log Out
            </Button>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Profile;
