import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Wallet, Send, History as HistoryIcon, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

interface PayoutsPanelProps {
  venueId: string;
}
interface TalentPayout {
  promoterId: string;
  displayName: string;
  totalCommission: number;
  ticketCount: number;
}

const PayoutsPanel = ({ venueId }: PayoutsPanelProps) => {
  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");
  const [payouts, setPayouts] = useState<TalentPayout[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (venueId) fetchData();
  }, [venueId, activeTab]);

  const fetchData = async () => {
    setLoading(true);
    if (activeTab === "pending") {
      // Fetch Pending Logic
      const { data } = await supabase
        .from("tickets")
        .select(`promoter_id, price_paid, profiles:promoter_id (display_name, username)`)
        .eq("venue_id", venueId)
        .eq("status", "Scanned")
        .not("promoter_id", "is", null);

      const aggregated = new Map<string, TalentPayout>();
      data?.forEach((ticket) => {
        const promoterId = ticket.promoter_id as string;
        const profile = ticket.profiles as any;
        const displayName = profile?.display_name || profile?.username || "Unknown Talent";
        const commission = (ticket.price_paid || 0) * 0.15;

        if (aggregated.has(promoterId)) {
          const e = aggregated.get(promoterId)!;
          e.totalCommission += commission;
          e.ticketCount += 1;
        } else {
          aggregated.set(promoterId, { promoterId, displayName, totalCommission: commission, ticketCount: 1 });
        }
      });
      setPayouts(Array.from(aggregated.values()));
    } else {
      // Fetch History Logic
      const { data } = await supabase
        .from("payout_history")
        .select(`*, profiles:promoter_id(display_name, username)`)
        .eq("venue_id", venueId)
        .order("processed_at", { ascending: false });
      setHistory(data || []);
    }
    setLoading(false);
  };

  const handleProcessPayout = async (talent: TalentPayout) => {
    try {
      const { error } = await supabase.from("payout_history").insert({
        venue_id: venueId,
        promoter_id: talent.promoterId,
        amount: talent.totalCommission,
        ticket_count: talent.ticketCount,
      });

      if (error) throw error;

      toast.success(`Settlement processed for ${talent.displayName}`, {
        description: `Neural Ledger updated: $${talent.totalCommission.toFixed(2)}`,
        icon: <CheckCircle2 className="text-neon-green" />,
      });

      fetchData(); // Refresh list
    } catch (err) {
      toast.error("Database sync failed");
    }
  };

  if (loading) return null;

  return (
    <div className="animate-in fade-in duration-500 space-y-4">
      {/* Mini Toggle */}
      <div className="flex bg-zinc-900/50 p-1 rounded-lg border border-white/5">
        <button
          onClick={() => setActiveTab("pending")}
          className={`flex-1 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-md transition-all ${activeTab === "pending" ? "bg-white/10 text-neon-green" : "text-zinc-500"}`}
        >
          Pending
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`flex-1 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-md transition-all ${activeTab === "history" ? "bg-white/10 text-white" : "text-zinc-500"}`}
        >
          History
        </button>
      </div>

      {activeTab === "pending" ? (
        <div className="space-y-3">
          {payouts.length === 0 ? (
            <div className="py-12 text-center opacity-50">
              <p className="text-[10px] font-black uppercase tracking-widest">Clear Ledger</p>
            </div>
          ) : (
            payouts.map((t) => (
              <Card key={t.promoterId} className="bg-zinc-900/50 border-white/5 p-4 flex items-center justify-between">
                <div>
                  <p className="font-black text-sm text-white uppercase italic">{t.displayName}</p>
                  <p className="text-[9px] text-zinc-500 uppercase font-black">{t.ticketCount} Units</p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-display text-lg text-neon-green">${t.totalCommission.toFixed(2)}</span>
                  <Button
                    size="sm"
                    onClick={() => handleProcessPayout(t)}
                    className="bg-neon-green text-black font-black uppercase text-[10px] h-8 rounded-lg"
                  >
                    Settle
                  </Button>
                </div>
              </Card>
            ))
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {history.map((h) => (
            <div key={h.id} className="flex items-center justify-between p-3 border-b border-white/5 opacity-80">
              <div>
                <p className="text-[10px] font-bold text-white uppercase">{h.profiles?.display_name || "Talent"}</p>
                <p className="text-[8px] text-zinc-500 uppercase">{new Date(h.processed_at).toLocaleDateString()}</p>
              </div>
              <p className="text-sm font-display text-zinc-300">${h.amount.toFixed(2)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PayoutsPanel;
