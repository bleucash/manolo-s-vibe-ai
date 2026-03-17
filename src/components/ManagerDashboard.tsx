import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserMode } from "@/contexts/UserModeContext";
import { VenueSwitcher } from "@/components/VenueSwitcher";
import ManagerApprovalPanel from "@/components/ManagerApprovalPanel";
import VenuePriceEditor from "@/components/venue/VenuePriceEditor";
import StaffCommissionEditor from "@/components/dashboard/StaffCommissionEditor";
import PayoutsPanel from "@/components/dashboard/PayoutsPanel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Settings2, Bell, ScanLine, Link2, Check, Trophy, Zap } from "lucide-react";
import { toast } from "sonner";

interface TalentPerformance {
  name: string;
  revenue: number;
  ticketCount: number;
}

// ✅ FIXED: Added userId to props to resolve TS2322
interface ManagerDashboardProps {
  userId: string;
}

const ManagerDashboard = ({ userId }: ManagerDashboardProps) => {
  const navigate = useNavigate();
  const { activeVenueId, userVenues } = useUserMode();

  const [metrics, setMetrics] = useState({
    totalRevenue: 0,
    ticketsSold: 0,
    currentOccupancy: 0,
    flowRate: 0,
  });
  const [talentPerformance, setTalentPerformance] = useState<TalentPerformance[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(true);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isVenueActive, setIsVenueActive] = useState(false);
  const [togglingActive, setTogglingActive] = useState(false);

  const activeVenue = userVenues.find((v) => v.id === activeVenueId);

  // 1. Fetch Core Metrics & Talent Leaderboard
  useEffect(() => {
    if (!activeVenueId) {
      setIsLoadingMetrics(false);
      return;
    }

    const fetchDashboardData = async () => {
      try {
        const { data: tickets, error } = await supabase
          .from("tickets")
          .select(
            `
            price_paid, 
            status, 
            scanned_at,
            promoter_id,
            profiles:promoter_id (display_name, username)
          `,
          )
          .eq("venue_id", activeVenueId);

        if (error) throw error;

        const allTickets = tickets || [];
        const scannedTickets = allTickets.filter((t) => t.status === "Scanned");
        const activeTickets = allTickets.filter((t) => t.status === "active" || t.status === "Scanned");

        const revenue = activeTickets.reduce((sum, t) => sum + (t.price_paid || 0), 0);
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        const recentScans = scannedTickets.filter((t) => t.scanned_at && t.scanned_at > oneHourAgo);

        setMetrics({
          totalRevenue: revenue,
          ticketsSold: activeTickets.length,
          currentOccupancy: scannedTickets.length,
          flowRate: recentScans.length,
        });

        const performanceMap = new Map<string, TalentPerformance>();
        activeTickets.forEach((ticket: any) => {
          if (ticket.promoter_id) {
            const name = ticket.profiles?.display_name || ticket.profiles?.username || "Unknown Talent";
            const existing = performanceMap.get(ticket.promoter_id) || { name, revenue: 0, ticketCount: 0 };
            performanceMap.set(ticket.promoter_id, {
              ...existing,
              revenue: existing.revenue + (ticket.price_paid || 0),
              ticketCount: existing.ticketCount + 1,
            });
          }
        });

        setTalentPerformance(Array.from(performanceMap.values()).sort((a, b) => b.revenue - a.revenue));
      } catch (err) {
        // Error handled via Neural Log
      } finally {
        setIsLoadingMetrics(false);
      }
    };

    fetchDashboardData();
    fetchVenueActiveStatus();

    const ticketSub = supabase
      .channel("dashboard-refresh")
      .on("postgres_changes", { event: "*", schema: "public", table: "tickets" }, () => fetchDashboardData())
      .subscribe();

    return () => {
      supabase.removeChannel(ticketSub);
    };
  }, [activeVenueId]);

  // 2. Fetch Pending Staff Count
  useEffect(() => {
    if (!activeVenueId) return;
    const fetchPendingCount = async () => {
      const { count } = await supabase
        .from("venue_staff")
        .select("*", { count: "exact", head: true })
        .eq("venue_id", activeVenueId)
        .eq("status", "pending");
      if (count !== null) setPendingCount(count);
    };
    fetchPendingCount();

    const staffSub = supabase
      .channel("staff-refresh")
      .on("postgres_changes", { event: "*", schema: "public", table: "venue_staff" }, () => fetchPendingCount())
      .subscribe();

    return () => {
      supabase.removeChannel(staffSub);
    };
  }, [activeVenueId]);

  const handleCopyStaffLink = async () => {
    if (!activeVenueId) return;
    const link = `${window.location.origin}/venue/${activeVenueId}/join`;
    try {
      await navigator.clipboard.writeText(link);
      setCopiedLink(true);
      toast.success("Invite Link Copied");
      setTimeout(() => setCopiedLink(false), 2000);
    } catch (err) {
      toast.error("Clipboard access denied");
    }
  };

  // Fetch venue active status
  const fetchVenueActiveStatus = async () => {
    if (!activeVenueId) return;
    try {
      const { data, error } = await supabase.from("venues").select("is_active").eq("id", activeVenueId).single();

      if (error) throw error;
      setIsVenueActive(data?.is_active || false);
    } catch (err) {
      console.error("Error fetching venue active status:", err);
    }
  };

  // Toggle venue active status
  const handleToggleActive = async () => {
    if (!activeVenueId || togglingActive) return;

    setTogglingActive(true);
    const newActiveState = !isVenueActive;

    try {
      const { error } = await supabase
        .from("venues")
        .update({
          is_active: newActiveState,
          active_at: newActiveState ? new Date().toISOString() : null,
        })
        .eq("id", activeVenueId);

      if (error) throw error;

      setIsVenueActive(newActiveState);
      toast.success(newActiveState ? "Venue is now Active" : "Venue deactivated");
    } catch (err) {
      console.error("Error toggling active status:", err);
      toast.error("Failed to update active status");
    } finally {
      setTogglingActive(false);
    }
  };

  if (isLoadingMetrics) return null;

  return (
    <div className="animate-in fade-in duration-500">
      {/* OPERATION BAR */}
      <div className="flex items-center justify-between mb-8 gap-4">
        <div className="flex-1 max-w-[240px]">
          <VenueSwitcher />
        </div>

        {/* GO ACTIVE TOGGLE */}
        <Button
          onClick={handleToggleActive}
          disabled={togglingActive || !activeVenueId}
          className={`h-10 px-6 font-black uppercase tracking-widest text-[10px] transition-all ${
            isVenueActive
              ? "bg-neon-green/10 border-neon-green/30 text-neon-green hover:bg-neon-green/20 shadow-[0_0_20px_rgba(57,255,20,0.15)]"
              : "bg-zinc-900/50 border-white/5 text-zinc-400 hover:bg-zinc-800"
          }`}
          variant="outline"
        >
          <div
            className={`w-2 h-2 rounded-full mr-2 ${isVenueActive ? "bg-neon-green animate-pulse" : "bg-zinc-600"}`}
          />
          {togglingActive ? "Updating..." : isVenueActive ? "Active" : "Go Active"}
        </Button>

        <div className="flex items-center gap-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="relative border-white/5 bg-zinc-900/50 hover:bg-zinc-800"
              >
                <Settings2 className="w-5 h-5 text-zinc-400" />
                {pendingCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-neon-purple text-white text-[10px] font-black rounded-full flex items-center justify-center animate-pulse shadow-[0_0_8px_#BF00FF]">
                    {pendingCount}
                  </span>
                )}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg bg-black border-white/10 p-0 overflow-hidden">
              <div className="p-6 border-b border-white/5">
                <DialogTitle className="text-white uppercase font-black tracking-widest text-xs italic">
                  Command Hub
                </DialogTitle>
              </div>
              <div className="p-6">
                <Tabs defaultValue="requests" className="w-full">
                  <TabsList className="grid w-full grid-cols-3 bg-zinc-900/50 h-10 p-1">
                    <TabsTrigger value="requests" className="text-[9px] font-black uppercase tracking-widest">
                      Staff
                    </TabsTrigger>
                    <TabsTrigger value="payouts" className="text-[9px] font-black uppercase tracking-widest">
                      Payouts
                    </TabsTrigger>
                    <TabsTrigger value="tools" className="text-[9px] font-black uppercase tracking-widest">
                      Tools
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="requests" className="mt-6">
                    <ManagerApprovalPanel />
                  </TabsContent>
                  <TabsContent value="payouts" className="mt-6">
                    {activeVenueId && <PayoutsPanel venueId={activeVenueId} />}
                  </TabsContent>
                  <TabsContent value="tools" className="mt-6 space-y-3">
                    <Button
                      onClick={() => navigate("/bouncer")}
                      className="w-full justify-start h-14 border-neon-green/20 text-neon-green font-black uppercase tracking-widest text-[9px]"
                      variant="outline"
                    >
                      <ScanLine className="mr-3 w-5 h-5" /> Launch Optical Scanner
                    </Button>
                    <Button
                      onClick={handleCopyStaffLink}
                      className="w-full justify-start h-14 border-white/5 font-black uppercase tracking-widest text-[9px]"
                      variant="outline"
                    >
                      {copiedLink ? (
                        <Check className="mr-3 text-neon-green w-5 h-5" />
                      ) : (
                        <Link2 className="mr-3 w-5 h-5" />
                      )}
                      Copy Staff Invite Link
                    </Button>
                  </TabsContent>
                </Tabs>
              </div>
            </DialogContent>
          </Dialog>

          <Button
            variant="outline"
            size="icon"
            className="border-white/5 bg-zinc-900/50"
            onClick={() => navigate("/notifications")}
          >
            <Bell className="w-5 h-5 text-zinc-400" />
          </Button>
        </div>
      </div>

      {/* CORE METRICS */}
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Zap className="w-3 h-3 text-neon-green fill-neon-green animate-pulse" />
          <span className="text-[9px] text-zinc-500 uppercase font-black tracking-[0.3em]">Neural Intel Streaming</span>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Card className="bg-zinc-900/20 border-white/5 relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-1 h-full bg-neon-green opacity-50" />
            <CardHeader className="pb-1">
              <CardTitle className="text-[9px] text-zinc-500 uppercase font-black tracking-widest">
                Live Revenue
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-display text-white italic tracking-tighter">
                ${metrics.totalRevenue.toLocaleString()}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-zinc-900/20 border-white/5 relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-1 h-full bg-neon-purple opacity-50" />
            <CardHeader className="pb-1">
              <CardTitle className="text-[9px] text-zinc-500 uppercase font-black tracking-widest">
                Active Units
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-display text-white italic tracking-tighter">{metrics.ticketsSold}</p>
            </CardContent>
          </Card>
        </div>

        {/* PERFORMANCE INDEX */}
        <Card className="bg-black border-white/5 overflow-hidden rounded-3xl shadow-2xl">
          <CardHeader className="bg-zinc-900/40 py-4 border-b border-white/5">
            <CardTitle className="text-[10px] uppercase font-black tracking-widest text-white flex items-center gap-2 italic">
              <Trophy className="w-3 h-3 text-amber-500" /> Performance Index
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {talentPerformance.length === 0 ? (
              <div className="p-8 text-center text-zinc-600 text-[10px] font-black uppercase tracking-widest">
                No active performance data
              </div>
            ) : (
              talentPerformance.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-5 border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors group"
                >
                  <div>
                    <p className="text-sm font-bold text-white uppercase italic tracking-tight group-hover:text-neon-green transition-colors">
                      {item.name}
                    </p>
                    <p className="text-[9px] text-zinc-600 font-black uppercase tracking-widest mt-1">
                      {item.ticketCount} Units Sold
                    </p>
                  </div>
                  <p className="text-xl font-display text-white italic">${item.revenue.toLocaleString()}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* OPERATION EDITORS */}
        <div className="space-y-4 pt-4">
          {activeVenue && <VenuePriceEditor venue={activeVenue} />}
          {activeVenueId && <StaffCommissionEditor venueId={activeVenueId} />}
        </div>
      </div>
    </div>
  );
};

export default ManagerDashboard;
