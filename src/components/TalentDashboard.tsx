import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  DollarSign,
  Link2,
  Check,
  Building2,
  MapPin,
  TrendingUp,
  Banknote,
  Copy,
  Mail,
  CheckCircle,
  XCircle,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

interface TalentDashboardProps {
  userId: string;
  avatarUrl?: string;
  displayName?: string;
}

const MIN_PAYOUT_AMOUNT = 20;

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
        // Only show items where the Talent still needs to take action
        setIncomingInvites(connections.filter((c) => c.status === "pending_talent_action"));
      }
    } catch {
      // Silently handle errors
    } finally {
      setLoading(false);
    }
  };

  const handleResponse = async (id: string, accept: boolean) => {
    // Lock the button
    setProcessingIds((prev) => new Set(prev).add(id));

    // OPTIMISTIC UI: Remove it from the list immediately in the browser
    setIncomingInvites((prev) => prev.filter((inv) => inv.id !== id));

    try {
      if (accept) {
        // Update to 'active'
        const { error } = await supabase
          .from("venue_staff")
          .update({ status: "active" })
          .eq("id", id)
          .eq("user_id", userId); // Security check

        if (error) throw error;
        toast.success("Affiliation activated!");
      } else {
        // Update to 'ignored' (using update instead of delete to avoid RLS issues)
        const { error } = await supabase
          .from("venue_staff")
          .update({ status: "ignored" })
          .eq("id", id)
          .eq("user_id", userId);

        if (error) throw error;
        toast.success("Invitation dismissed");
      }

      // FORCED SYNC: Fetch the latest data from DB to confirm the change
      await fetchData();
    } catch (err: any) {
      toast.error(`Sync Failed: ${err.message || "Database rejected the update"}`);
      // Revert the UI if the database actually failed
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

  if (loading) {
    return (
      <div className="h-48 flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-neon-pink" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Metrics Section */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="bg-black border-white/5 shadow-xl">
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-2 text-zinc-500">
              <TrendingUp className="w-4 h-4 text-neon-blue" />
              <span className="text-[10px] font-bold uppercase tracking-widest">Entries</span>
            </div>
            <p className="text-3xl font-display text-white">{metrics.scannedCount}</p>
            <p className="text-[10px] text-zinc-600 mt-1 uppercase font-bold">{metrics.totalSold} Sold</p>
          </CardContent>
        </Card>

        <Card className="bg-black border-neon-green/20">
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-2 text-zinc-500">
              <DollarSign className="w-4 h-4 text-neon-green" />
              <span className="text-[10px] font-bold uppercase tracking-widest">Commission</span>
            </div>
            <p className="text-3xl font-display text-neon-green">${availableBalance.toFixed(2)}</p>
            <p className="text-[10px] text-zinc-600 mt-1 uppercase font-bold">10% Yield</p>
          </CardContent>
        </Card>
      </div>

      {/* Referral Link */}
      <div className="flex items-center gap-3 p-4 bg-zinc-900/50 border border-white/5 rounded-2xl">
        <Link2 className="w-4 h-4 text-neon-blue shrink-0" />
        <p className="flex-1 text-[11px] font-mono text-zinc-400 truncate">
          {window.location.origin}/?ref={userId.slice(0, 8)}...
        </p>
        <Button
          onClick={handleCopyLink}
          size="sm"
          className={`h-9 px-4 rounded-xl ${copied ? "bg-neon-green text-black" : "bg-white/10 text-white"}`}
        >
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>

      {/* Incoming Invitations Section */}
      {incomingInvites.length > 0 && (
        <div className="pt-4 space-y-3">
          <h3 className="text-[10px] font-black text-amber-500 uppercase tracking-widest px-1">
            New Venue Invitations
          </h3>
          {incomingInvites.map((inv) => (
            <div key={inv.id} className="p-5 rounded-2xl bg-amber-500/5 border border-amber-500/20 flex flex-col gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center">
                  <Mail className="w-6 h-6 text-amber-500" />
                </div>
                <div>
                  <p className="text-sm font-black text-white uppercase tracking-tight">{inv.venues?.name}</p>
                  <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">
                    {inv.venues?.location}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  className="flex-1 bg-neon-green text-black font-black uppercase text-[11px] h-11 rounded-xl shadow-lg"
                  onClick={() => handleResponse(inv.id, true)}
                  disabled={processingIds.has(inv.id)}
                >
                  Accept & Connect
                </Button>
                <Button
                  variant="ghost"
                  className="flex-1 border border-white/10 text-zinc-500 font-bold uppercase text-[11px] h-11 rounded-xl"
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
        <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest px-1">
          Active Venue Connections
        </h3>
        {activeAffiliations.length > 0 ? (
          activeAffiliations.map((aff) => (
            <div
              key={aff.id}
              className="p-5 rounded-2xl bg-zinc-900/50 border border-white/5 flex items-center justify-between group hover:border-neon-blue/30 transition-all"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-white/5 flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-zinc-600 group-hover:text-neon-blue transition-colors" />
                </div>
                <div>
                  <p className="text-sm font-black text-white uppercase tracking-tight">{aff.venues?.name}</p>
                  <p className="text-[10px] text-zinc-500 font-bold uppercase">{aff.venues?.location}</p>
                </div>
              </div>
              <Badge className="bg-neon-blue/10 text-neon-blue border-neon-blue/20 text-[9px] font-black px-3">
                ACTIVE
              </Badge>
            </div>
          ))
        ) : (
          <div className="p-10 text-center border border-dashed border-zinc-800 rounded-2xl">
            <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest">No active connections yet</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TalentDashboard;
