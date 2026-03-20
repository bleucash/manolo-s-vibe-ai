import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserMode } from "@/contexts/UserModeContext";
import { InteractiveHeroReel } from "@/components/InteractiveHeroReel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Film, Briefcase, Settings, Zap } from "lucide-react";
import { toast } from "sonner";

const TalentManage = () => {
  const navigate = useNavigate();
  const { mode, session } = useUserMode();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (mode !== "talent") {
      toast.error("Talent mode required");
      navigate("/profile");
      return;
    }

    const fetchProfile = async () => {
      if (!session?.user?.id) return;
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .maybeSingle();

      if (error) {
        toast.error("Failed to load profile");
      } else {
        setProfile(data);
      }
      setLoading(false);
    };

    fetchProfile();
  }, [mode, session, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-neon-blue border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="min-h-screen bg-black">
      {/* Sticky Header */}
      <div className="sticky top-0 z-50 bg-black/80 backdrop-blur-xl border-b border-white/5 px-6 py-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full text-white/60 hover:text-white hover:bg-white/10"
            onClick={() => navigate("/profile")}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl font-display text-white uppercase tracking-tighter italic">
              Talent Studio
            </h1>
            <p className="text-[9px] text-white/40 uppercase tracking-widest font-black">
              Content Management
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4 pt-6 pb-8">
        <Tabs defaultValue="hero-reel" className="w-full">
          <TabsList className="grid grid-cols-3 bg-zinc-900/20 border border-white/5 rounded-2xl p-1 h-auto mb-6">
            <TabsTrigger
              value="hero-reel"
              className="rounded-xl py-3 font-black uppercase text-[9px] tracking-widest text-white/60 data-[state=active]:bg-neon-blue data-[state=active]:text-black"
            >
              <Film className="w-3.5 h-3.5 mr-1.5" />
              Hero Reel
            </TabsTrigger>
            <TabsTrigger
              value="portfolio"
              className="rounded-xl py-3 font-black uppercase text-[9px] tracking-widest text-white/60 data-[state=active]:bg-neon-blue data-[state=active]:text-black"
            >
              <Briefcase className="w-3.5 h-3.5 mr-1.5" />
              Portfolio
            </TabsTrigger>
            <TabsTrigger
              value="settings"
              className="rounded-xl py-3 font-black uppercase text-[9px] tracking-widest text-white/60 data-[state=active]:bg-neon-blue data-[state=active]:text-black"
            >
              <Settings className="w-3.5 h-3.5 mr-1.5" />
              Settings
            </TabsTrigger>
          </TabsList>

          {/* Hero Reel Tab */}
          <TabsContent value="hero-reel" className="space-y-4">
            <Card className="bg-zinc-900/20 border-white/5 rounded-3xl overflow-hidden">
              <CardHeader className="bg-zinc-900/40 border-b border-white/5">
                <CardTitle className="flex items-center gap-2 text-white text-sm">
                  <Film className="w-4 h-4 text-neon-blue" />
                  Hero Reel Upload
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <div className="aspect-video rounded-2xl border border-white/10 bg-black overflow-hidden">
                  <InteractiveHeroReel
                    entityId={profile.id}
                    entityType="talent"
                    currentReelUrl={profile.hero_reel_url}
                    fallbackImageUrl={profile.avatar_url}
                    isOwner={true}
                    className="w-full h-full"
                  />
                </div>

                <ul className="space-y-1.5 text-[9px] text-white/60 uppercase tracking-widest">
                  <li>• Video or image format supported</li>
                  <li>• Maximum file size: 50MB</li>
                  <li>• Recommended aspect ratio: 16:9 or 9:16</li>
                  <li>• Long-press to upload or change</li>
                </ul>
              </CardContent>
            </Card>

            <Card className="bg-zinc-900/20 border-white/5 rounded-3xl">
              <CardContent className="p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-500" />
                  <h3 className="text-sm font-bold text-white">Public Profile Preview</h3>
                </div>
                <p className="text-[11px] text-white/50">
                  This hero reel will display on your public talent profile and Discovery cards.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full border-white/10 text-white/70 hover:text-white hover:bg-white/5 rounded-xl text-[9px] uppercase tracking-widest font-black"
                  onClick={() => navigate(`/talent/${profile.id}`)}
                >
                  View Public Profile
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Portfolio Tab */}
          <TabsContent value="portfolio">
            <Card className="bg-zinc-900/20 border-white/5 rounded-3xl">
              <CardContent className="p-10 flex flex-col items-center justify-center text-center space-y-3">
                <Briefcase className="w-16 h-16 text-white/20" />
                <h3 className="text-lg font-bold text-white">Portfolio Coming Soon</h3>
                <p className="text-sm text-white/50">
                  Upload images and videos to showcase your work
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings">
            <Card className="bg-zinc-900/20 border-white/5 rounded-3xl">
              <CardContent className="p-10 flex flex-col items-center justify-center text-center space-y-3">
                <Settings className="w-16 h-16 text-white/20" />
                <h3 className="text-lg font-bold text-white">Settings Coming Soon</h3>
                <p className="text-sm text-white/50">
                  Manage your talent profile settings and preferences
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default TalentManage;
