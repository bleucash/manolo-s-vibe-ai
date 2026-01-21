import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserMode } from "@/contexts/UserModeContext";
import { VenueSwitcher } from "@/components/VenueSwitcher";
import ManagerApprovalPanel from "@/components/ManagerApprovalPanel";
import VenuePriceEditor from "@/components/venue/VenuePriceEditor";
import StaffCommissionEditor from "@/components/dashboard/StaffCommissionEditor";
import PayoutsPanel from "@/components/dashboard/PayoutsPanel"; // ✅ Ensure this exists
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
  }, [activeVenueId]);

  if (isLoadingMetrics) return null;

  return (
    <div className="min-h-screen bg-background pb-24 animate-in fade-in duration-500">
      {/* Header with Operations Dialog */}
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
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-neon-purple text-white text-[10px] font-black rounded-full flex items-center justify-center animate-pulse">
                      {pendingCount}
                    </span>
                  )}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg min-h-[450px] bg-black border-white/10">
                <DialogHeader>
                  <DialogTitle className="text-white uppercase font-black tracking-[0.2em] text-sm">
                    Operation Hub
                  </DialogTitle>
                </DialogHeader>
                <Tabs defaultValue="requests" className="w-full mt-4">
                  <TabsList className="grid w-full grid-cols-3 bg-zinc-900/50">
                    <TabsTrigger value="requests" className="text-[10px] font-black uppercase">
                      Staff
                    </TabsTrigger>
                    <TabsTrigger value="payouts" className="text-[10px] font-black uppercase">
                      Payouts
                    </TabsTrigger>
                    <TabsTrigger value="tools" className="text-[10px] font-black uppercase">
                      Tools
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="requests" className="mt-4">
                    <ManagerApprovalPanel />
                  </TabsContent>

                  <TabsContent value="payouts" className="mt-4">
                    {/* ✅ New Payouts Section */}
                    {activeVenueId && <PayoutsPanel venueId={activeVenueId} />}
                  </TabsContent>

                  <TabsContent value="tools" className="mt-4 space-y-3">
                    <Button
                      onClick={() => navigate("/bouncer")}
                      className="w-full justify-start h-14 border-neon-green/30 text-neon-green"
                      variant="outline"
                    >
                      <ScanLine className="mr-3" /> Launch Optical Scanner
                    </Button>
                    <Button
                      onClick={handleCopyStaffLink}
                      className="w-full justify-start h-14 border-white/5"
                      variant="outline"
                    >
                      {copiedLink ? <Check className="mr-3 text-neon-green" /> : <Link2 className="mr-3" />}
                      Copy Invite Link
                    </Button>
                  </TabsContent>
                </Tabs>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-6">
        {/* Live Intelligence Indicator */}
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${isLive ? "bg-neon-green animate-pulse shadow-[0_0_8px_#39FF14]" : "bg-muted"}`}
          />
          <span className="text-[10px] text-zinc-500 uppercase font-black tracking-[0.2em]">
            Neural Intelligence Active
          </span>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="bg-black border-neon-green/20 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-neon-green" />
            <CardHeader className="pb-1">
              <CardTitle className="text-[10px] text-neon-green uppercase font-black">Gross Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-display text-white italic">${metrics.totalRevenue.toLocaleString()}</p>
            </CardContent>
          </Card>
          {/* ... (Repeat for other metrics) ... */}
        </div>

        {/* Talent ROI */}
        <Card className="bg-black border-white/5">
          <CardHeader className="bg-zinc-900/50 py-3 border-b border-white/5">
            <CardTitle className="text-[10px] uppercase font-black tracking-widest text-zinc-400 flex items-center gap-2">
              <Trophy className="w-3 h-3 text-amber-500" /> Top Performers
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {talentPerformance.map((item, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-4 border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors"
              >
                <p className="text-sm font-bold text-white uppercase italic">{item.name}</p>
                <p className="text-xl font-display text-neon-green italic">${item.revenue.toLocaleString()}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Dynamic Controls */}
        {activeVenue && <VenuePriceEditor venue={activeVenue} />}
        {activeVenueId && <StaffCommissionEditor venueId={activeVenueId} />}
      </div>
    </div>
  );
};

export default ManagerDashboard;
