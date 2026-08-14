import { useEffect, useState } from "react";
import { HeroReel } from "@/components/HeroReel";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserMode } from "@/contexts/UserModeContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LogOut, Grid3X3, User, Activity, Zap, Shield, Settings, Sparkles, Clock, Building2 } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import LoadingState from "@/components/ui/LoadingState";
import { BecomeTalentModal } from "@/components/BecomeTalentModal";
import { ClaimVenueModal } from "@/components/ClaimVenueModal";
import { cn } from "@/lib/utils";

const Profile = () => {
  const navigate = useNavigate();
  const { 
    mode, 
    setMode, 
    isManager, 
    isTalent, 
    activeVenueId, 
    isLoading: contextLoading 
  } = useUserMode();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("about");
  const [talentModalOpen, setTalentModalOpen] = useState(false);
  const [hasPendingApplication, setHasPendingApplication] = useState(false);
  const [venueModalOpen, setVenueModalOpen] = useState(false);
  const [hasPendingClaim, setHasPendingClaim] = useState(false);

  // Redirect non-guest users to their appropriate studio
  useEffect(() => {
    if (contextLoading) return;

    if (mode === "talent") {
      navigate("/talent-manage", { replace: true });
    } else if (mode === "manager") {
      navigate("/venue/manage", { replace: true });
    }
  }, [mode, contextLoading, navigate]);

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

      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (profileData) setProfile(profileData);

      // Drives whether the card offers "Become Talent" or shows the
      // application as already under review. Self-scoped by RLS.
      const { data: application } = await supabase
        .from("talent_applications")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "pending")
        .maybeSingle();

      setHasPendingApplication(!!application);

      // Same idea for the manager entry point below. Self-scoped by RLS, so
      // this only ever sees this user's own claims.
      const { data: claim } = await supabase
        .from("venue_claims")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "pending")
        .limit(1);

      setHasPendingClaim(!!claim && claim.length > 0);
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
        navigate("/talent-manage");
      } else if (isManager) {
        setMode("manager");
        toast.success("Manager Control Active");
        navigate("/venue/manage");
      } else {
        // Previously promised an onboarding flow that did not exist. Now
        // points at the real entry point in the card below.
        toast.error("Verified Role Required", {
          description: hasPendingApplication
            ? "Your talent application is still under review."
            : "Apply as talent in System Settings to unlock business tools."
        });
      }
    } else {
      setMode("guest");
      toast.success("Guest Mode Active");
      navigate("/profile");
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  // ✅ UNIFIED LOADING STRATEGY
  if (loading || contextLoading) {
    return <LoadingState />;
  }

  return (
    <div className="min-h-screen bg-black pb-32 animate-in fade-in duration-700">
      {/* SYSTEM BANNER - Guest View */}
      <div className="relative w-full h-56">
        <HeroReel
          fallbackImageUrl="https://images.unsplash.com/photo-1614850523296-d8c1af93d400?q=80&w=2070"
          alt="System Banner"
          className="w-full h-full"
        />

        {/* NEURAL MODE SWITCH */}
        <div className="absolute top-8 left-6 z-20">
          <div className="flex flex-col gap-2">
            <span className="text-[8px] font-black text-white/40 uppercase tracking-[0.3em] ml-1">
              System State
            </span>
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
                <Zap className="w-4 h-4 text-black" />
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
            <TabsTrigger
              value="about"
              className="data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-white px-0 pb-4 text-zinc-600 uppercase text-[10px] font-black tracking-widest transition-all"
            >
              <Settings className="w-3.5 h-3.5 mr-2" /> System Settings
            </TabsTrigger>
          </TabsList>

          {/* SETTINGS CONTENT */}
          <TabsContent value="about" className="p-8 space-y-8 animate-in slide-in-from-bottom-2 duration-500">
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-1 h-1 bg-zinc-700 rounded-full" />
                <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                  Neural Link Management
                </p>
              </div>
              
              <Card className="bg-zinc-900/20 border-white/5 p-6 rounded-[2rem]">
                <p className="text-xs text-zinc-500 mb-6 leading-relaxed">
                  You are currently in Guest Mode. This allows you to follow talent,
                  message venues, and purchase secure entry tickets.
                  Switch modes using the toggle above to access business tools.
                </p>

                {hasPendingApplication ? (
                  <div className="w-full h-16 mb-3 border border-neon-purple/20 bg-neon-purple/5 rounded-2xl flex items-center justify-center gap-3">
                    <Clock className="w-4 h-4 text-neon-purple" />
                    <span className="text-[10px] font-black text-neon-purple uppercase tracking-widest">
                      Talent Application Under Review
                    </span>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    className="w-full h-16 mb-3 border-neon-purple/20 bg-neon-purple/5 text-neon-purple hover:bg-neon-purple/10 transition-all uppercase font-black text-[10px] tracking-widest rounded-2xl"
                    onClick={() => setTalentModalOpen(true)}
                  >
                    <Sparkles className="w-4 h-4 mr-3" /> Are You Talent?
                  </Button>
                )}

                {/* Sibling entry point to the talent one above. Phrased as a
                    question for the same reason: this is a claim we check, not
                    an offer anyone can take. */}
                {hasPendingClaim ? (
                  <div className="w-full h-16 mb-3 border border-neon-blue/20 bg-neon-blue/5 rounded-2xl flex items-center justify-center gap-3">
                    <Clock className="w-4 h-4 text-neon-blue" />
                    <span className="text-[10px] font-black text-neon-blue uppercase tracking-widest">
                      Venue Claim Under Review
                    </span>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    className="w-full h-16 mb-3 border-neon-blue/20 bg-neon-blue/5 text-neon-blue hover:bg-neon-blue/10 transition-all uppercase font-black text-[10px] tracking-widest rounded-2xl"
                    onClick={() => setVenueModalOpen(true)}
                  >
                    <Building2 className="w-4 h-4 mr-3" /> Do You Manage a Venue?
                  </Button>
                )}

                <Button
                  variant="outline"
                  className="w-full h-16 border-white/5 bg-zinc-900/30 text-zinc-400 hover:border-red-500/50 hover:text-red-500 transition-all uppercase font-black text-[10px] tracking-widest rounded-2xl"
                  onClick={handleLogout}
                >
                  <LogOut className="w-4 h-4 mr-3" /> Terminate Session
                </Button>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <BecomeTalentModal
        isOpen={talentModalOpen}
        onClose={() => setTalentModalOpen(false)}
        onSubmitted={() => setHasPendingApplication(true)}
      />

      <ClaimVenueModal
        isOpen={venueModalOpen}
        onClose={() => setVenueModalOpen(false)}
        onSubmitted={() => setHasPendingClaim(true)}
      />
    </div>
  );
};

export default Profile;
