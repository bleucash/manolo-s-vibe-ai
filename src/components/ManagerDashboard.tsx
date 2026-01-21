import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserMode } from "@/contexts/UserModeContext";
import { VenueSwitcher } from "@/components/VenueSwitcher";
import ManagerApprovalPanel from "@/components/ManagerApprovalPanel";
import VenuePriceEditor from "@/components/venue/VenuePriceEditor";
import StaffCommissionEditor from "@/components/dashboard/StaffCommissionEditor";
import PayoutsPanel from "@/components/dashboard/PayoutsPanel"; // Ensure Default Export is used
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
        console.error("Dashboard Sync Error:", err);
      } finally {
        setIsLoadingMetrics(false);
      }
    };

    fetchDashboardData();

    // Real-time Ticket Refresh
    const ticketSub = supabase
      .channel("dashboard-refresh")
      .on("postgres_changes", { event: "*", schema: "public", table: "tickets" }, () => fetchDashboardData())
      .subscribe();

    return () => {
      supabase.removeChannel(ticketSub);
    };
  }, [activeVenueId]);

  // 2. Fetch Pending Staff Count (For the Notification Badge)
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

  // 3. Logic: Copy Staff Invite Link
  const handleCopyStaffLink = async () => {
    if (!activeVenueId) return;
    const link = `${window.location.origin}/venue/${activeVenueId}/join`;
    try {
      await navigator.clipboard.writeText(link);
      setCopiedLink(true);
      toast.success("Invite Link Copied", { description: "Ready for talent onboarding." });
      setTimeout(() => setCopiedLink(false), 2000);
    } catch (err) {
      toast.error("Clipboard access denied");
    }
  };

  if (isLoadingMetrics) return null;

  return (
    <div className="min-h-screen bg-background pb-24 animate-in fade-in duration-500">
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-white/5">
        <div className="flex items-center justify-between p-4 max-w-2xl mx-auto">
          <div className="flex-1 max-w-[200px]">
            <VenueSwitcher />
          </div>

          <div className="flex items-center gap-2">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="icon" className="relative border-white/10 bg-black">
                  <Settings2 className="w-5 h-5 text-zinc-400" />
                  {pendingCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-neon-purple text-white text-[10px] font-black rounded-full flex items-center justify-center animate-pulse shadow-[0_0_8px_rgba(191,0,255,0.5)]">
                      {pendingCount}
                    </span>
                  )}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg min-h-[450px] bg-black border-white/10 p-0 overflow-hidden">
                <div className="p-6 border-b border-white/5">
                  <DialogTitle className="text-white uppercase font-black tracking-[0.2em] text-sm italic">
                    Operation Hub
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
                        className="w-full justify-start h-14 border-neon-green/30 text-neon-green font-black uppercase tracking-widest text-[10px]"
                        variant="outline"
                      >
                        <ScanLine className="mr-3 w-5 h-5" /> Launch Optical Scanner
                      </Button>
                      <Button
                        onClick={handleCopyStaffLink}
                        className="w-full justify-start h-14 border-white/5 font-black uppercase tracking-widest text-[10px]"
                        variant="outline"
                      >
                        {copiedLink ? (
                          <Check className="mr-3 text-neon-green w-5 h-5" />
                        ) : (
                          <Link2 className="mr-3 w-5 h-5" />
                        )}
                        Copy Invite Link
                      </Button>
                    </TabsContent>
                  </Tabs>
                </div>
              </DialogContent>
            </Dialog>
            <Button
              variant="outline"
              size="icon"
              className="border-white/10"
              onClick={() => navigate("/notifications")}
            >
              <Bell className="w-5 h-5 text-zinc-400" />
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-6">
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${isLive ? "bg-neon-green animate-pulse shadow-[0_0_8px_#39FF14]" : "bg-muted"}`}
          />
          <span className="text-[9px] text-zinc-500 uppercase font-black tracking-[0.3em]">
            Neural Intelligence Active
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Card className="bg-black border-neon-green/20 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-neon-green" />
            <CardHeader className="pb-1">
              <CardTitle className="text-[10px] text-neon-green uppercase font-black tracking-widest">
                Gross Revenue
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-display text-white italic tracking-tighter">
                ${metrics.totalRevenue.toLocaleString()}
              </p>
            </CardContent>
          </Card>
          <Card className="bg-black border-neon-purple/20 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-neon-purple" />
            <CardHeader className="pb-1">
              <CardTitle className="text-[10px] text-neon-purple uppercase font-black tracking-widest">
                Tickets Sold
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-display text-white italic tracking-tighter">{metrics.ticketsSold}</p>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-black border-white/5 overflow-hidden">
          <CardHeader className="bg-zinc-900/50 py-3 border-b border-white/5">
            <CardTitle className="text-[10px] uppercase font-black tracking-widest text-zinc-500 flex items-center gap-2 italic">
              <Trophy className="w-3 h-3 text-amber-500" /> Performance Index
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {talentPerformance.map((item, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-4 border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors"
              >
                <div>
                  <p className="text-sm font-bold text-white uppercase italic tracking-tight">{item.name}</p>
                  <p className="text-[9px] text-zinc-600 font-black uppercase tracking-widest">
                    {item.ticketCount} Units
                  </p>
                </div>
                <p className="text-xl font-display text-neon-green italic">${item.revenue.toLocaleString()}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        {activeVenue && <VenuePriceEditor venue={activeVenue} />}
        {activeVenueId && <StaffCommissionEditor venueId={activeVenueId} />}
      </div>
    </div>
  );
};

export default ManagerDashboard;
