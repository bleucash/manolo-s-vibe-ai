import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import LoadingState from "@/components/ui/LoadingState";

const PayoutsPanel = ({ venueId }: { venueId: string }) => {
  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");
  const [payouts, setPayouts] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (venueId) fetchData();
  }, [venueId, activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === "pending") {
        // ✅ Call the new RPC we deployed (No more manual aggregation)
        const { data, error } = await supabase.rpc("get_unpaid_commissions", {
          venue_id_input: venueId,
        });

        if (error) throw error;
        setPayouts(data || []);
      } else {
        const { data } = await supabase
          .from("payout_history")
          .select(`*, profiles:promoter_id(display_name, username)`)
          .eq("venue_id", venueId)
          .order("processed_at", { ascending: false });
        setHistory(data || []);
      }
    } catch (err) {
      console.error("Payout fetch error:", err);
      toast.error("Ledger Sync Failure");
    } finally {
      setLoading(false);
    }
  };

  const handleProcessPayout = async (talent: any) => {
    try {
      // ✅ Use the IDs and amounts directly from the RPC response
      const { error } = await supabase.from("payout_history").insert({
        venue_id: venueId,
        promoter_id: talent.promoter_id,
        amount: talent.total_unpaid,
        ticket_count: talent.ticket_count,
      });

      if (error) throw error;

      toast.success(`Settlement complete for ${talent.full_name || talent.username}`, {
        icon: <CheckCircle2 className="text-neon-green" />,
      });

      fetchData(); // Refresh the list
    } catch (err) {
      console.error("Payout processing error:", err);
      toast.error("Settlement Failed");
    }
  };

  if (loading) return <LoadingState />;

  return (
    <div className="space-y-6">
      <div className="flex bg-zinc-900/60 p-1 rounded-xl border border-white/5">
        <button
          onClick={() => setActiveTab("pending")}
          className={`flex-1 py-2 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${activeTab === "pending" ? "bg-white text-black" : "text-zinc-500"}`}
        >
          Pending
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`flex-1 py-2 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${activeTab === "history" ? "bg-white text-black" : "text-zinc-500"}`}
        >
          History
        </button>
      </div>

      <div className="space-y-4 max-h-[50vh] overflow-y-auto no-scrollbar pr-1">
        {activeTab === "pending" ? (
          payouts.length === 0 ? (
            <p className="text-center py-12 text-[9px] font-black text-zinc-700 uppercase tracking-widest">
              All accounts settled
            </p>
          ) : (
            payouts.map((t) => (
              <Card
                key={t.promoter_id}
                className="bg-zinc-900/40 border-white/5 p-5 flex items-center justify-between rounded-2xl group"
              >
                <div>
                  <p className="font-bold text-white uppercase italic tracking-tight">
                    {t.full_name || t.username || "Neural ID Unknown"}
                  </p>
                  <p className="text-[8px] text-zinc-600 uppercase font-black mt-1">{t.ticket_count} Units Verified</p>
                </div>
                <div className="flex items-center gap-6">
                  <span className="font-display text-xl text-white italic tracking-tighter">
                    ${Number(t.total_unpaid).toFixed(2)}
                  </span>
                  <Button
                    onClick={() => handleProcessPayout(t)}
                    className="bg-neon-green text-black font-black uppercase text-[9px] h-9 px-4 rounded-xl shadow-lg hover:scale-105 active:scale-95 transition-all"
                  >
                    Settle
                  </Button>
                </div>
              </Card>
            ))
          )
        ) : (
          history.map((h) => (
            <div key={h.id} className="flex items-center justify-between p-4 border-b border-white/5 opacity-60">
              <div>
                <p className="text-[10px] font-black text-white uppercase">{h.profiles?.display_name || "Neural ID"}</p>
                <p className="text-[8px] text-zinc-500 uppercase mt-1">
                  {new Date(h.processed_at).toLocaleDateString()}
                </p>
              </div>
              <p className="text-sm font-display text-zinc-300 italic tracking-tighter">${h.amount.toFixed(2)}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default PayoutsPanel;
