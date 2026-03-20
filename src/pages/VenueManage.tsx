import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserMode } from "@/contexts/UserModeContext";
import { InteractiveHeroReel } from "@/components/InteractiveHeroReel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Film, CalendarDays, Settings, Zap } from "lucide-react";
import { toast } from "sonner";

const VenueManage = () => {
  const navigate = useNavigate();
  const { mode, activeVenueId } = useUserMode();

  const [venue, setVenue] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("hero-reel");

  useEffect(() => {
    if (mode !== "manager" || !activeVenueId) {
      toast.error("Manager mode required");
      navigate("/profile");
      return;
    }

    fetchVenue();
  }, [mode, activeVenueId]);

  const fetchVenue = async () => {
    if (!activeVenueId) return;

    try {
      const { data } = await supabase.from("venues").select("*").eq("id", activeVenueId).single();
      if (data) setVenue(data);
    } catch (error) {
      console.error("Error fetching venue:", error);
      toast.error("Failed to load venue");
    } finally {
      setLoading(false);
    }
  };

  if (loading) return null;

  if (!venue) {
    return (
      <div className="h-screen flex items-center justify-center bg-black text-white font-display uppercase tracking-[0.5em] text-[10px]">
        Venue Not Found
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black pb-32 animate-in fade-in duration-700">
      {/* HEADER */}
      <div className="sticky top-0 z-50 bg-black/80 backdrop-blur-xl border-b border-white/5 px-6 py-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/profile")}
            className="rounded-full text-white border border-white/10"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl font-display text-white uppercase tracking-tighter italic">Venue Studio</h1>
            <p className="text-[9px] text-white/40 uppercase tracking-widest font-black">{venue.name} Management</p>
          </div>
        </div>
      </div>

      {/* CONTENT */}
      <div className="px-6 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-zinc-900/20 border border-white/5 rounded-2xl p-1 mb-8">
            <TabsTrigger
              value="hero-reel"
              className="rounded-xl data-[state=active]:bg-neon-blue data-[state=active]:text-black text-white/60 font-black uppercase text-[9px] tracking-widest"
            >
              <Film className="w-3 h-3 mr-2" />
              Hero Reel
            </TabsTrigger>
            <TabsTrigger
              value="events"
              className="rounded-xl data-[state=active]:bg-neon-blue data-[state=active]:text-black text-white/60 font-black uppercase text-[9px] tracking-widest"
            >
              <CalendarDays className="w-3 h-3 mr-2" />
              Events
            </TabsTrigger>
            <TabsTrigger
              value="settings"
              className="rounded-xl data-[state=active]:bg-neon-blue data-[state=active]:text-black text-white/60 font-black uppercase text-[9px] tracking-widest"
            >
              <Settings className="w-3 h-3 mr-2" />
              Settings
            </TabsTrigger>
          </TabsList>

          {/* HERO REEL TAB */}
          <TabsContent value="hero-reel" className="space-y-6">
            <Card className="bg-zinc-900/20 border-white/5 rounded-3xl overflow-hidden">
              <CardHeader className="bg-zinc-900/40 border-b border-white/5 py-4">
                <CardTitle className="text-[10px] uppercase font-black tracking-widest text-white flex items-center gap-2">
                  <Film className="w-3 h-3 text-neon-blue" />
                  Hero Reel Upload
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="aspect-video rounded-2xl overflow-hidden border border-white/10 bg-black">
                  <InteractiveHeroReel
                    entityId={venue.id}
                    entityType="venue"
                    currentReelUrl={venue.hero_reel_url}
                    fallbackImageUrl={venue.image_url || "/placeholder.svg"}
                    isOwner={true}
                  />
                </div>
                <div className="mt-4 space-y-2">
                  <p className="text-[9px] text-white/60 uppercase tracking-widest font-black">Upload Requirements</p>
                  <ul className="text-xs text-white/40 space-y-1">
                    <li>• Video or image format supported</li>
                    <li>• Maximum file size: 50MB</li>
                    <li>• Recommended aspect ratio: 16:9 or 9:16</li>
                    <li>• Long-press to upload or change</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            {/* PREVIEW CARD */}
            <Card className="bg-zinc-900/20 border-white/5 rounded-3xl overflow-hidden">
              <CardHeader className="bg-zinc-900/40 border-b border-white/5 py-4">
                <CardTitle className="text-[10px] uppercase font-black tracking-widest text-white flex items-center gap-2">
                  <Zap className="w-3 h-3 text-amber-500" />
                  Public Profile Preview
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <p className="text-xs text-white/60 mb-4">
                  This hero reel will display on your public venue page and Discovery cards.
                </p>
                <Button
                  onClick={() => navigate(`/venue/${venue.id}`)}
                  className="w-full bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-full font-black uppercase text-[10px] tracking-widest"
                >
                  View Public Profile
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* EVENTS TAB */}
          <TabsContent value="events" className="space-y-6">
            <Card className="bg-zinc-900/20 border-white/5 rounded-3xl overflow-hidden">
              <CardHeader className="bg-zinc-900/40 border-b border-white/5 py-4">
                <CardTitle className="text-[10px] uppercase font-black tracking-widest text-white flex items-center gap-2">
                  <CalendarDays className="w-3 h-3 text-neon-blue" />
                  Event Management
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="text-center py-12">
                  <CalendarDays className="w-16 h-16 mx-auto mb-4 text-white/20" />
                  <h3 className="text-white font-display uppercase tracking-wider text-sm mb-2">
                    Events Coming Soon
                  </h3>
                  <p className="text-white/40 text-xs">Create and manage events for your venue.</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* SETTINGS TAB */}
          <TabsContent value="settings" className="space-y-6">
            <Card className="bg-zinc-900/20 border-white/5 rounded-3xl overflow-hidden">
              <CardHeader className="bg-zinc-900/40 border-b border-white/5 py-4">
                <CardTitle className="text-[10px] uppercase font-black tracking-widest text-white flex items-center gap-2">
                  <Settings className="w-3 h-3 text-white/60" />
                  Venue Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="text-center py-12">
                  <Settings className="w-16 h-16 mx-auto mb-4 text-white/20" />
                  <h3 className="text-white font-display uppercase tracking-wider text-sm mb-2">
                    Settings Coming Soon
                  </h3>
                  <p className="text-white/40 text-xs">Manage your venue profile settings and preferences.</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default VenueManage;
