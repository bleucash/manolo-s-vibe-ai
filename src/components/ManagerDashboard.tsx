import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserMode } from "@/contexts/UserModeContext";
import { VenueSwitcher } from "@/components/VenueSwitcher";
import ManagerApprovalPanel from "@/components/ManagerApprovalPanel";
import VenuePriceEditor from "@/components/venue/VenuePriceEditor";
import StaffCommissionEditor from "@/components/dashboard/StaffCommissionEditor";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  Settings2,
  Bell,
  Users,
  DollarSign,
  ScanLine,
  Link2,
  TrendingUp,
  Ticket,
  Loader2,
  Wallet,
  Wrench,
  Check,
  Trophy,
} from "lucide-react";
import { toast } from "sonner";

interface TalentPerformance {
  name: string;
  revenue: number;
  ticketCount: number;
}

const ManagerDashboard = () => {
  const navigate = useNavigate();
  const { activeVenueId, userVenues } = useUserMode();

  const [isLive, setIsLive] = useState(true);
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

  const activeVenue = userVenues.find((v) => v.id === activeVenueId);

  useEffect(() => {
    if (!activeVenueId) {
      setIsLoadingMetrics(false);
      return;
    }

    const fetchDashboardData = async () => {
      try {
        // 1. Fetch Tickets with Promoter Names
        const { data: tickets, error } = await supabase
          .from("tickets")
          .select(
            `
            price_paid, 
            status, 
            scanned_at,
            promoter_id,
            profiles:promoter_id (full_name, username)
          `,
          )
          .eq("venue_id", activeVenueId);

        if (error) throw error;

        const allTickets = tickets || [];
        const scannedTickets = allTickets.filter((t) => t.status === "Scanned");
        const activeTickets = allTickets.filter((t) => t.status === "active" || t.status === "Scanned");

        // 2. Calculate Gross Metrics
        const revenue = activeTickets.reduce((sum, t) => sum + (t.price_paid || 0), 0);
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        const recentScans = scannedTickets.filter((t) => t.scanned_at && t.scanned_at > oneHourAgo);

        setMetrics({
          totalRevenue: revenue,
          ticketsSold: activeTickets.length,
          currentOccupancy: scannedTickets.length,
          flowRate: recentScans.length,
        });

        // 3. Aggregate Talent Performance (Leaderboard)
        const performanceMap = new Map<string, TalentPerformance>();

        activeTickets.forEach((ticket: any) => {
          if (ticket.promoter_id) {
            const name = ticket.profiles?.full_name || ticket.profiles?.username || "Unknown Talent";
            const existing = performanceMap.get(ticket.promoter_id) || { name, revenue: 0, ticketCount: 0 };

            performanceMap.set(ticket.promoter_id, {
              ...existing,
              revenue: existing.revenue + (ticket.price_paid || 0),
              ticketCount: existing.ticketCount + 1,
            });
          }
        });

        setTalentPerformance(Array.from(performanceMap.values()).sort((a, b) => b.revenue - a.revenue));
      } catch {
        // Silently handle errors
      } finally {
        setIsLoadingMetrics(false);
      }
    };

    fetchDashboardData();

    // Real-time subscription for live updates
    const channel = supabase
      .channel("dashboard-refresh")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tickets",
          filter: `venue_id=eq.${activeVenueId}`,
        },
        () => {
          setIsLive(true);
          fetchDashboardData();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeVenueId]);

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
  }, [activeVenueId]);

  const handleCopyStaffLink = async () => {
    if (!activeVenueId) return;
    const link = `${window.location.origin}/venue/${activeVenueId}/join`;
    await navigator.clipboard.writeText(link);
    setCopiedLink(true);
    toast.success("Staff invite link copied!");
    setTimeout(() => setCopiedLink(false), 2000);
  };

  if (isLoadingMetrics) {
    return (
      <div className="h-screen flex items-center justify-center bg-black">
        <Loader2 className="animate-spin text-neon-green w-10 h-10" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border/50">
        <div className="flex items-center justify-between p-4 max-w-2xl mx-auto">
          <div className="flex-1 max-w-[200px]">
            <VenueSwitcher />
          </div>

          <div className="flex items-center gap-2">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="icon" className="relative border-border/50">
                  <Settings2 className="w-5 h-5" />
                  {pendingCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-destructive text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                      {pendingCount}
                    </span>
                  )}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg min-h-[450px] max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Operations</DialogTitle>
                </DialogHeader>
                <Tabs defaultValue="requests" className="w-full mt-2">
                  <TabsList className="grid w-full grid-cols-3 bg-muted/50 text-xs">
                    <TabsTrigger value="requests">
                      <Users className="w-3 h-3 mr-1" />
                      Staff
                    </TabsTrigger>
                    <TabsTrigger value="payouts">
                      <Wallet className="w-3 h-3 mr-1" />
                      Payouts
                    </TabsTrigger>
                    <TabsTrigger value="tools">
                      <Wrench className="w-3 h-3 mr-1" />
                      Tools
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="requests">
                    <ManagerApprovalPanel />
                  </TabsContent>
                  <TabsContent value="tools" className="space-y-3">
                    <Button
                      onClick={() => navigate("/bouncer")}
                      className="w-full justify-start h-14 border-neon-green/30 text-neon-green"
                      variant="outline"
                    >
                      <ScanLine className="mr-3" /> Launch Scanner
                    </Button>
                    <Button onClick={handleCopyStaffLink} className="w-full justify-start h-14" variant="outline">
                      {copiedLink ? <Check className="mr-3 text-neon-green" /> : <Link2 className="mr-3" />}
                      Copy Staff Invite Link
                    </Button>
                  </TabsContent>
                </Tabs>
              </DialogContent>
            </Dialog>
            <Button variant="outline" size="icon" onClick={() => navigate("/notifications")}>
              <Bell className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-6">
        {/* Live Indicator */}
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${isLive ? "bg-neon-green animate-pulse shadow-[0_0_8px_#39FF14]" : "bg-muted"}`}
          />
          <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">
            {isLive ? "Live Intelligence" : "System Offline"}
          </span>
        </div>

        {/* Color-Coded Metrics Grid */}
        <div className="grid grid-cols-2 gap-4">
          {/* Revenue - Green */}
          <Card className="bg-black border-neon-green/20 shadow-[0_0_15px_rgba(57,255,20,0.05)] overflow-hidden relative">
            <div className="absolute top-0 left-0 w-1 h-full bg-neon-green" />
            <CardHeader className="pb-1">
              <CardTitle className="text-[10px] text-neon-green uppercase font-black tracking-tighter flex items-center gap-2">
                <DollarSign className="w-3 h-3" /> Gross Revenue
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-display text-white">${metrics.totalRevenue.toLocaleString()}</p>
            </CardContent>
          </Card>

          {/* Tickets - Purple */}
          <Card className="bg-black border-neon-purple/20 shadow-[0_0_15px_rgba(191,0,255,0.05)] overflow-hidden relative">
            <div className="absolute top-0 left-0 w-1 h-full bg-neon-purple" />
            <CardHeader className="pb-1">
              <CardTitle className="text-[10px] text-neon-purple uppercase font-black tracking-tighter flex items-center gap-2">
                <Ticket className="w-3 h-3" /> Tickets Sold
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-display text-white">{metrics.ticketsSold}</p>
            </CardContent>
          </Card>

          {/* Occupancy - Cyan */}
          <Card className="bg-black border-neon-cyan/20 shadow-[0_0_15px_rgba(0,255,255,0.05)] overflow-hidden relative">
            <div className="absolute top-0 left-0 w-1 h-full bg-neon-cyan" />
            <CardHeader className="pb-1">
              <CardTitle className="text-[10px] text-neon-cyan uppercase font-black tracking-tighter flex items-center gap-2">
                <Users className="w-3 h-3" /> Inside Now
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-display text-white">{metrics.currentOccupancy}</p>
            </CardContent>
          </Card>

          {/* Flow - Amber */}
          <Card className="bg-black border-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.05)] overflow-hidden relative">
            <div className="absolute top-0 left-0 w-1 h-full bg-amber-500" />
            <CardHeader className="pb-1">
              <CardTitle className="text-[10px] text-amber-500 uppercase font-black tracking-tighter flex items-center gap-2">
                <TrendingUp className="w-3 h-3" /> Flow (1hr)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-display text-white">+{metrics.flowRate}</p>
            </CardContent>
          </Card>
        </div>

        {/* Talent ROI Leaderboard */}
        <Card className="bg-black border-white/5 overflow-hidden">
          <CardHeader className="bg-zinc-900/50 border-b border-white/5 py-3">
            <CardTitle className="text-[10px] uppercase font-black tracking-[0.2em] text-zinc-400 flex items-center gap-2">
              <Trophy className="w-3 h-3 text-amber-500" /> Talent Performance
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {talentPerformance.length > 0 ? (
              <div className="divide-y divide-white/5">
                {talentPerformance.map((item, idx) => (
                  <div
                    key={item.name}
                    className="flex items-center justify-between p-4 hover:bg-white/[0.02] transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-8 h-8 rounded-full bg-zinc-900 flex items-center justify-center border border-white/5">
                        <span className="text-xs font-display text-zinc-500">{idx + 1}</span>
                      </div>
                      <div>
                        <p className="text-sm font-bold uppercase tracking-tight text-white">{item.name}</p>
                        <p className="text-[9px] text-zinc-500 font-bold uppercase">{item.ticketCount} Units Sold</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-display text-neon-green">${item.revenue.toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-10 text-center text-zinc-600 italic text-xs">
                No performance data recorded for this venue.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Venue Pricing Control */}
        {activeVenue && (
          <Card className="bg-black border-neon-blue/20 shadow-[0_0_15px_rgba(13,0,164,0.1)] overflow-hidden relative">
            <div className="absolute top-0 left-0 w-1 h-full bg-neon-blue" />
            <CardHeader className="bg-zinc-900/50 border-b border-white/5 py-3">
              <CardTitle className="text-[10px] uppercase font-black tracking-[0.2em] text-zinc-400 flex items-center gap-2">
                <DollarSign className="w-3 h-3 text-neon-blue" /> Venue Pricing Control
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <VenuePriceEditor venue={activeVenue} />
            </CardContent>
          </Card>
        )}

        {/* Staff Management */}
        {activeVenueId && <StaffCommissionEditor venueId={activeVenueId} />}
      </div>
    </div>
  );
};

export default ManagerDashboard;
