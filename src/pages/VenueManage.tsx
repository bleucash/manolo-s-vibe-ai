import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserMode } from "@/contexts/UserModeContext";
import { InteractiveHeroReel } from "@/components/InteractiveHeroReel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Film, Calendar, Settings, Zap, ArrowLeft, ShieldCheck, LogOut, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/**
 * `return null` renders nothing, which shows whatever is behind the app,
 * i.e. a white flash, rather than anything intentional. Every load path in
 * this page paints black instead. Mirrors TalentGuard's loading branch.
 */
const PageLoading = () => (
  <div className="flex flex-col items-center justify-center h-screen bg-black">
    <Loader2 className="w-8 h-8 text-neon-blue animate-spin" />
  </div>
);

const VenueManage = () => {
  const navigate = useNavigate();
  const { mode, activeVenueId, setMode, isTalent, isManager, session, isLoading: contextLoading } = useUserMode();

  const [venue, setVenue] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("hero-reel");
  const [pendingClaimVenue, setPendingClaimVenue] = useState<string | null>(null);
  const [checkingClaim, setCheckingClaim] = useState(true);

  useEffect(() => {
    // Wait for the shared auth context to hydrate first, the TalentGuard
    // pattern. activeVenueId starts as a bare null and is never persisted to
    // localStorage by syncProfileAndVenues, so on a cold load it is null
    // because nothing has resolved yet, not because this manager owns no
    // venue. Running before that resolves fires the pending-claim query for
    // nothing and, worse, lets mode still read "guest" and bounce the user
    // off the page they just landed on.
    if (contextLoading) return;

    // Redirect if not in manager mode
    if (mode !== "manager") {
      toast.error("Manager mode required");
      navigate("/profile");
      return;
    }

    // A manager with no active venue is a legitimate state (claim submitted but
    // not yet approved, or nothing claimed yet). Render a stable screen for it
    // rather than redirecting: Profile.tsx sends every manager-mode user here,
    // so redirecting back produced an infinite loop with a toast every cycle.
    if (!activeVenueId) {
      const checkPendingClaim = async () => {
        // The mode check above already returned for anything but manager mode,
        // and mode only becomes "manager" once syncProfileAndVenues has read a
        // session. Guarding anyway: `.eq("user_id", undefined)` would query
        // for the literal string "undefined" and return no claim, rendering
        // "nothing claimed yet" to a manager who has a claim pending.
        const userId = session?.user?.id;
        if (!userId) {
          setCheckingClaim(false);
          return;
        }

        try {
          const { data } = await supabase
            .from("venue_claims")
            .select("venues(name)")
            .eq("user_id", userId)
            .eq("status", "pending")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          setPendingClaimVenue((data?.venues as any)?.name ?? null);
        } finally {
          setCheckingClaim(false);
        }
      };

      checkPendingClaim();
      return;
    }

    fetchVenue();
  }, [mode, activeVenueId, navigate, session, contextLoading]);

  const fetchVenue = async () => {
    if (!activeVenueId) return;

    try {
      const { data: venueData } = await supabase.from("venues").select("*").eq("id", activeVenueId).single();

      if (venueData) {
        setVenue(venueData);
      }
    } catch (error) {
      console.error("Error fetching venue:", error);
      toast.error("Failed to load venue");
    } finally {
      setLoading(false);
    }
  };

  // Same call Profile.tsx makes. Managers are redirected away from /profile,
  // so without this there is no way for a manager account to sign out at all.
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
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
        toast.error("Verified Role Required", {
          description: "Complete onboarding to unlock business tools."
        });
      }
    } else {
      setMode("guest");
      toast.success("Guest Mode Active");
      navigate("/profile");
    }
  };

  // Must come before the !activeVenueId branch below. Without it, "context has
  // not resolved yet" and "this manager owns nothing" are the same condition,
  // and the empty state flashes on every cold load before the real venue
  // arrives. Matches this component's existing loading convention of
  // rendering nothing rather than a spinner.
  if (contextLoading) return <PageLoading />;

  // Manager, but no venue resolved yet. Stable states, no redirect, no toast.
  if (!activeVenueId) {
    if (checkingClaim) return <PageLoading />;

    if (pendingClaimVenue) {
      return (
        <div className="flex flex-col items-center justify-center h-screen bg-black px-12 text-center animate-in fade-in duration-700">
          <div className="w-20 h-20 bg-neon-blue/10 rounded-[2rem] flex items-center justify-center mb-8 shadow-[0_0_50px_rgba(0,183,255,0.1)]">
            <ShieldCheck className="w-10 h-10 text-neon-blue" />
          </div>

          <h2 className="font-display text-3xl text-white uppercase italic tracking-tighter leading-none">
            Neural Link: Pending
          </h2>

          <div className="mt-6 space-y-4 max-w-sm">
            <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.2em] leading-relaxed">
              Your claim on {pendingClaimVenue} is under review.
            </p>
            <p className="text-zinc-600 text-[9px] font-bold uppercase tracking-widest leading-relaxed border-t border-white/5 pt-4">
              Venue Studio unlocks once an Admin verifies your IG Handshake.
            </p>
          </div>

          <Button
            onClick={() => navigate("/discovery")}
            className="mt-12 h-16 w-full max-w-xs bg-white text-black font-black uppercase text-[10px] tracking-widest rounded-2xl hover:bg-neon-blue transition-all"
          >
            Exit to Discovery
          </Button>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center h-screen bg-black px-12 text-center animate-in fade-in duration-700">
        <div className="w-20 h-20 bg-white/5 rounded-[2rem] flex items-center justify-center mb-8">
          <Settings className="w-10 h-10 text-zinc-600" />
        </div>

        <h2 className="font-display text-3xl text-white uppercase italic tracking-tighter leading-none">
          No Sector Claimed
        </h2>

        <div className="mt-6 space-y-4 max-w-sm">
          <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.2em] leading-relaxed">
            Venue Studio activates once you claim a venue.
          </p>
          <p className="text-zinc-600 text-[9px] font-bold uppercase tracking-widest leading-relaxed border-t border-white/5 pt-4">
            Find your venue in Discovery and start the IG Handshake.
          </p>
        </div>

        <Button
          onClick={() => navigate("/discovery")}
          className="mt-12 h-16 w-full max-w-xs bg-white text-black font-black uppercase text-[10px] tracking-widest rounded-2xl hover:bg-neon-blue transition-all"
        >
          Browse Discovery
        </Button>
      </div>
    );
  }

  if (loading) return <PageLoading />;

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
        <div className="flex items-center justify-between">
          {/* Mode Switcher */}
          <div className="flex flex-col gap-1">
            <span className="text-[8px] font-black text-white/40 uppercase tracking-[0.3em] ml-1">
              Neural Link
            </span>
            <button
              onClick={toggleUserMode}
              className={cn(
                "h-10 w-36 rounded-full border backdrop-blur-xl transition-all duration-500 flex items-center px-1 relative overflow-hidden",
                mode !== "guest"
                  ? "bg-neon-green/10 border-neon-green/30 shadow-[0_0_20px_rgba(57,255,20,0.15)]"
                  : "bg-white/5 border-white/10"
              )}
            >
              <div
                className={cn(
                  "w-8 h-8 rounded-full shadow-2xl transform transition-all duration-500 ease-spring z-10 flex items-center justify-center",
                  mode !== "guest" ? "translate-x-[96px] bg-neon-green" : "translate-x-0 bg-white"
                )}
              >
                <Zap className="w-4 h-4 text-black" />
              </div>
              <span
                className={cn(
                  "absolute w-full text-center text-[9px] font-black uppercase tracking-widest transition-colors",
                  mode !== "guest" ? "text-neon-green pr-8" : "text-white pl-8"
                )}
              >
                {mode}
              </span>
            </button>
          </div>

          {/* Title */}
          <div className="text-center">
            <h1 className="text-xl font-display text-white uppercase tracking-tighter italic">Venue Studio</h1>
            <p className="text-[9px] text-white/40 uppercase tracking-widest font-black">{venue.name} Management</p>
          </div>

          {/* Keeps the w-36 that balances the mode switcher, so the centered
              title does not shift. Lives in the sticky header, which is on
              screen from every tab of the studio. */}
          <div className="w-36 flex justify-end">
            <Button
              variant="ghost"
              onClick={handleSignOut}
              className="h-10 px-4 rounded-full border border-white/10 bg-white/5 text-[9px] font-black uppercase tracking-widest text-zinc-400 hover:text-red-500 hover:bg-red-500/5 hover:border-red-500/30 transition-all"
            >
              <LogOut className="w-3 h-3 mr-2" /> Sign Out
            </Button>
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
              <Calendar className="w-3 h-3 mr-2" />
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
                  Venue Hero Reel Upload
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
                  This hero reel will display on your public venue profile and Discovery cards.
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
                  <Calendar className="w-3 h-3 text-neon-blue" />
                  Event Management
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="text-center py-12">
                  <Calendar className="w-16 h-16 mx-auto mb-4 text-white/20" />
                  <h3 className="text-white font-display uppercase tracking-wider text-sm mb-2">Events Coming Soon</h3>
                  <p className="text-white/40 text-xs">Upload event flyers and manage your venue's calendar.</p>
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
                  <p className="text-white/40 text-xs">Manage your venue details, hours, and preferences.</p>
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
