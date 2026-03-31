import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserMode } from "@/contexts/UserModeContext";
import { DashboardGuard } from "@/components/DashboardGuard";
import { 
  ShieldCheck, 
  Users, 
  Ticket, 
  TrendingUp, 
  Settings, 
  ChevronRight,
  Zap,
  Calendar
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const Dashboard = () => {
  const navigate = useNavigate();
  const { id: venueId } = useParams(); // Assumes URL is /dashboard/:id
  const { session, activeVenueId } = useUserMode();
  
  // Use the ID from the URL or the one active in the user's session
  const targetVenueId = venueId || activeVenueId;

  const [stats, setStats] = useState({
    totalTickets: 0,
    activeStaff: 0,
    revenue: 0
  });

  useEffect(() => {
    if (targetVenueId) {
      fetchDashboardData();
    }
  }, [targetVenueId]);

  const fetchDashboardData = async () => {
    // Logic to fetch venue stats would go here
    // For now, we are focusing on the Security Gate
    console.log("Fetching secure data for venue:", targetVenueId);
  };

  return (
    <DashboardGuard venueId={targetVenueId || ""}>
      <div className="min-h-screen bg-black pb-32 animate-in fade-in duration-1000">
        {/* DASHBOARD HEADER */}
        <div className="px-8 pt-12 pb-8 border-b border-white/5 bg-zinc-900/20">
          <div className="flex justify-between items-start mb-8">
            <div>
              <h1 className="font-display text-4xl text-white uppercase italic tracking-tighter leading-none">
                Operation Control
              </h1>
              <p className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.3em] mt-2">
                Sector: {targetVenueId?.slice(0, 8)}... [VERIFIED]
              </p>
            </div>
            <Button variant="outline" size="icon" className="rounded-full border-white/10 bg-white/5">
              <Settings className="w-4 h-4 text-white" />
            </Button>
          </div>

          {/* QUICK STATS GRID */}
          <div className="grid grid-cols-3 gap-4">
            <Card className="bg-zinc-900/40 border-white/5 p-4 rounded-2xl">
              <p className="text-[8px] font-black text-zinc-500 uppercase tracking-widest mb-1">Revenue</p>
              <p className="text-xl font-display text-neon-green italic leading-none">$0.00</p>
            </Card>
            <Card className="bg-zinc-900/40 border-white/5 p-4 rounded-2xl">
              <p className="text-[8px] font-black text-zinc-500 uppercase tracking-widest mb-1">Tickets</p>
              <p className="text-xl font-display text-white italic leading-none">0</p>
            </Card>
            <Card className="bg-zinc-900/40 border-white/5 p-4 rounded-2xl">
              <p className="text-[8px] font-black text-zinc-500 uppercase tracking-widest mb-1">Staff</p>
              <p className="text-xl font-display text-neon-blue italic leading-none">0</p>
            </Card>
          </div>
        </div>

        {/* OPERATION SECTORS */}
        <div className="px-8 mt-12 space-y-4">
          <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.4em] mb-6">Active Sectors</h3>
          
          <Button 
            className="w-full h-24 bg-zinc-900/40 border border-white/5 rounded-3xl flex items-center justify-between px-8 group hover:bg-zinc-800 transition-all"
            onClick={() => navigate(`/dashboard/tickets/${targetVenueId}`)}
          >
            <div className="flex items-center gap-6">
              <div className="w-12 h-12 bg-neon-green/10 rounded-2xl flex items-center justify-center">
                <Ticket className="w-6 h-6 text-neon-green" />
              </div>
              <div className="text-left">
                <p className="text-white font-display text-xl uppercase italic leading-none">Secure Entry</p>
                <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest mt-1">Scanner & Guestlist</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-zinc-800 group-hover:text-white transition-colors" />
          </Button>

          <Button 
            className="w-full h-24 bg-zinc-900/40 border border-white/5 rounded-3xl flex items-center justify-between px-8 group hover:bg-zinc-800 transition-all"
            onClick={() => navigate(`/dashboard/staff/${targetVenueId}`)}
          >
            <div className="flex items-center gap-6">
              <div className="w-12 h-12 bg-neon-blue/10 rounded-2xl flex items-center justify-center">
                <Users className="w-6 h-6 text-neon-blue" />
              </div>
              <div className="text-left">
                <p className="text-white font-display text-xl uppercase italic leading-none">Staffing Roster</p>
                <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest mt-1">Manage Checked-in Talent</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-zinc-800 group-hover:text-white transition-colors" />
          </Button>

          <Button 
            className="w-full h-24 bg-zinc-900/40 border border-white/5 rounded-3xl flex items-center justify-between px-8 group hover:bg-zinc-800 transition-all"
          >
            <div className="flex items-center gap-6">
              <div className="w-12 h-12 bg-neon-purple/10 rounded-2xl flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-neon-purple" />
              </div>
              <div className="text-left">
                <p className="text-white font-display text-xl uppercase italic leading-none">Market Intelligence</p>
                <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest mt-1">Analytics & Payouts</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-zinc-800 group-hover:text-white transition-colors" />
          </Button>
        </div>

        {/* FOOTER ALERT */}
        <div className="mt-16 px-12 text-center opacity-30">
          <ShieldCheck className="w-6 h-6 text-zinc-500 mx-auto mb-4" />
          <p className="text-[8px] font-black text-zinc-500 uppercase tracking-widest leading-relaxed">
            All operations in this sector are recorded for security. <br />
            Level 3 encryption active.
          </p>
        </div>
      </div>
    </DashboardGuard>
  );
};

export default Dashboard;
