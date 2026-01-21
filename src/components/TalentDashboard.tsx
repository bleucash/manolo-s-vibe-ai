import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DollarSign, Link2, Building2, TrendingUp, Mail } from "lucide-react"; // Loader2 removed
import { toast } from "sonner";

interface TalentDashboardProps {
  userId: string;
  avatarUrl?: string;
  displayName?: string;
}

const TalentDashboard = ({ userId }: TalentDashboardProps) => {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({ totalSold: 0, scannedCount: 0, grossSales: 0 });
  const [activeAffiliations, setActiveAffiliations] = useState<any[]>([]);
  const [incomingInvites, setIncomingInvites] = useState<any[]>([]);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);

  // Static 10% commission calculation
  const availableBalance = metrics.grossSales * 0.1;

  useEffect(() => {
    if (userId) {
      fetchData();
    }
  }, [userId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      // 1. Fetch Sales Metrics
      const { data: tickets } = await supabase.from("tickets").select("status, price_paid").eq("promoter_id", userId);

      if (tickets) {
        setMetrics({
          totalSold: tickets.length,
          scannedCount: tickets.filter((t) => t.status === "Scanned").length,
          grossSales: tickets.reduce((sum, t) => sum + (t.price_paid || 0), 0),
        });
      }

      // 2. Fetch Connections (Filtering 'active' vs 'pending_talent_action')
      const { data: connections, error } = await supabase
        .from("venue_staff")
        .select(`*, venues (name, location)`)
        .eq("user_id", userId);

      if (!error && connections) {
        setActiveAffiliations(connections.filter((c) => c.status === "active"));
        setIncomingInvites(connections.filter((c) => c.status === "pending_talent_action"));
      }
    } catch {
      // Silently handle errors
    } finally {
      setLoading(false);
    }
  };

  const handleResponse = async (id: string, accept: boolean) => {
    setProcessingIds((prev) => new Set(prev).add(id));
    setIncomingInvites((prev) => prev.filter((inv) => inv.id !== id));

    try {
      if (accept) {
        const { error } = await supabase
          .from("venue_staff")
          .update({ status: "active" })
          .eq("id", id)
          .eq("user_id", userId);

        if (error) throw error;
        toast.success("Affiliation activated!");
      } else {
        const { error } = await supabase
          .from("venue_staff")
          .update({ status: "ignored" })
          .eq("id", id)
          .eq("user_id", userId);

        if (error) throw error;
        toast.success("Invitation dismissed");
      }
      await fetchData();
    } catch (err: any) {
      toast.error(`Sync Failed: ${err.message || "Database rejected the update"}`);
      fetchData();
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleCopyLink = async () => {
    const referralLink = `${window.location.origin}?ref=${userId}`;
    await navigator.clipboard.writeText(referralLink);
    setCopied(true);
    toast.success("Referral link copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  // ✅ UNIFIED LOADING STRATEGY
  // Returning null allows the master page-level loader to remain visible.
  if (loading) {
    return null;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      {/* Metrics Section */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="bg-black border-white/5 shadow-xl">
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-2 text-zinc-500">
              <TrendingUp className="w-4 h-4 text-neon-blue" />
              <span className="text-[10px] font-black uppercase tracking-widest">Entries</span>
            </div>
            <p className="text-3xl font-display text-white italic">{metrics.scannedCount}</p>
            <p className="text-[10px] text-zinc-600 mt-1 uppercase font-black tracking-widest">
              {metrics.totalSold} Sold
            </p>
          </CardContent>
        </Card>

        <Card className="bg-black border-neon-green/20 shadow-[0_0_15px_rgba(57,255,20,0.05)]">
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-2 text-zinc-500">
              <DollarSign className="w-4 h-4 text-neon-green" />
              <span className="text-[10px] font-black uppercase tracking-widest">Commission</span>
            </div>
            <p className="text-3xl font-display text-neon-green italic">${availableBalance.toFixed(2)}</p>
            <p className="text-[10px] text-zinc-600 mt-1 uppercase font-black tracking-widest">10% Yield</p>
          </CardContent>
        </Card>
      </div>

      {/* Referral Link */}
      <div className="flex items-center gap-3 p-4 bg-zinc-900/50 border border-white/5 rounded-2xl backdrop-blur-md">
        <Link2 className="w-4 h-4 text-neon-blue shrink-0" />
        <p className="flex-1 text-[11px] font-mono text-zinc-500 truncate">
          {window.location.origin}/?ref={userId.slice(0, 8)}...
        </p>
        <Button
          onClick={handleCopyLink}
          size="sm"
          className={`h-9 px-4 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all ${copied ? "bg-neon-green text-black shadow-[0_0_10px_rgba(57,255,20,0.4)]" : "bg-white/10 text-white"}`}
        >
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>

      {/* Incoming Invitations Section */}
      {incomingInvites.length > 0 && (
        <div className="pt-4 space-y-3">
          <h3 className="text-[10px] font-black text-amber-500 uppercase tracking-[0.3em] px-1">
            Incoming Venue Requests
          </h3>
          {incomingInvites.map((inv) => (
            <div
              key={inv.id}
              className="p-5 rounded-2xl bg-amber-500/5 border border-amber-500/20 flex flex-col gap-4 shadow-lg shadow-amber-500/5"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center">
                  <Mail className="w-6 h-6 text-amber-500" />
                </div>
                <div>
                  <p className="text-sm font-black text-white uppercase tracking-tight italic">{inv.venues?.name}</p>
                  <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">
                    {inv.venues?.location}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  className="flex-1 bg-neon-green text-black font-black uppercase text-[11px] h-11 rounded-xl shadow-lg transition-transform active:scale-95"
                  onClick={() => handleResponse(inv.id, true)}
                  disabled={processingIds.has(inv.id)}
                >
                  Accept Link
                </Button>
                <Button
                  variant="ghost"
                  className="flex-1 border border-white/10 text-zinc-500 font-black uppercase text-[11px] h-11 rounded-xl transition-all"
                  onClick={() => handleResponse(inv.id, false)}
                  disabled={processingIds.has(inv.id)}
                >
                  Ignore
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Active Connections Section */}
      <div className="pt-4 space-y-3">
        <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em] px-1">Synchronized Venues</h3>
        {activeAffiliations.length > 0 ? (
          activeAffiliations.map((aff) => (
            <div
              key={aff.id}
              className="p-5 rounded-2xl bg-zinc-900/50 border border-white/5 flex items-center justify-between group hover:border-neon-blue/30 transition-all shadow-md"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-white/5 flex items-center justify-center group-hover:bg-neon-blue/5 transition-colors">
                  <Building2 className="w-6 h-6 text-zinc-600 group-hover:text-neon-blue transition-colors" />
                </div>
                <div>
                  <p className="text-sm font-black text-white uppercase tracking-tight italic">{aff.venues?.name}</p>
                  <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">{aff.venues?.location}</p>
                </div>
              </div>
              <Badge className="bg-neon-blue/10 text-neon-blue border-neon-blue/20 text-[9px] font-black px-3 py-1 uppercase tracking-widest">
                Linked
              </Badge>
            </div>
          ))
        ) : (
          <div className="p-12 text-center border border-dashed border-zinc-800 rounded-3xl bg-zinc-900/20">
            <p className="text-[10px] text-zinc-700 font-black uppercase tracking-[0.4em]">
              No Live Neural Connections
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TalentDashboard;
