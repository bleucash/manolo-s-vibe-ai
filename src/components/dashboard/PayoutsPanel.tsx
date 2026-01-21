import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Wallet, Send, History } from "lucide-react";
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

// 1. Changed to a standard const for the export default pattern
const PayoutsPanel = ({ venueId }: PayoutsPanelProps) => {
  const [payouts, setPayouts] = useState<TalentPayout[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchCommissions() {
      setIsLoading(true);

      // Using the promoter relationship to aggregate data
      const { data, error } = await supabase
        .from("tickets")
        .select(
          `
          promoter_id,
          price_paid,
          profiles:promoter_id (
            display_name,
            username
          )
        `,
        )
        .eq("venue_id", venueId)
        .eq("status", "Scanned")
        .not("promoter_id", "is", null);

      if (error) {
        console.error("Error fetching commissions:", error);
        setIsLoading(false);
        return;
      }

      const aggregated = new Map<string, TalentPayout>();

      data?.forEach((ticket) => {
        const promoterId = ticket.promoter_id as string;
        const profile = ticket.profiles as any;
        const displayName = profile?.display_name || profile?.username || "Unknown Talent";
        const commission = (ticket.price_paid || 0) * 0.15; // 15% rate

        if (aggregated.has(promoterId)) {
          const existing = aggregated.get(promoterId)!;
          existing.totalCommission += commission;
          existing.ticketCount += 1;
        } else {
          aggregated.set(promoterId, {
            promoterId,
            displayName,
            totalCommission: commission,
            ticketCount: 1,
          });
        }
      });

      setPayouts(Array.from(aggregated.values()));
      setIsLoading(false);
    }

    if (venueId) {
      fetchCommissions();
    }
  }, [venueId]);

  const handleProcessPayout = (talent: TalentPayout) => {
    toast.success(`Settlement processed for ${talent.displayName}`, {
      description: `Neural Link cleared for $${talent.totalCommission.toFixed(2)}`,
    });
  };

  // ✅ UNIFIED LOADING STRATEGY
  if (isLoading) {
    return null;
  }

  return (
    <div className="animate-in fade-in duration-500 space-y-4">
      <div className="flex items-center gap-2 px-1 mb-2">
        <Wallet className="h-4 w-4 text-neon-green" />
        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Neural Ledger Settlements</h4>
      </div>

      {payouts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 rounded-2xl border border-dashed border-white/5 bg-zinc-900/20">
          <History className="h-8 w-8 mb-3 text-zinc-800" />
          <p className="font-black uppercase tracking-widest text-[10px] text-zinc-600">No Active Commissions</p>
        </div>
      ) : (
        <div className="space-y-3">
          {payouts.map((talent) => (
            <Card
              key={talent.promoterId}
              className="bg-zinc-900/50 border-white/5 p-4 flex items-center justify-between group hover:bg-zinc-900 transition-colors"
            >
              <div className="space-y-1">
                <p className="font-black uppercase tracking-tight text-sm text-white italic">{talent.displayName}</p>
                <p className="text-[9px] uppercase font-black tracking-widest text-zinc-500">
                  {talent.ticketCount} Units Verified
                </p>
              </div>
              <div className="flex items-center gap-4">
                <span className="font-display text-xl text-neon-green italic">
                  ${talent.totalCommission.toFixed(2)}
                </span>
                <Button
                  size="sm"
                  onClick={() => handleProcessPayout(talent)}
                  className="bg-neon-green text-black hover:bg-white font-black uppercase tracking-widest text-[10px] h-9 px-4 rounded-xl"
                >
                  Settle <Send className="h-3 w-3 ml-2" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

// ✅ THE MISSING PIECE: Default Export
export default PayoutsPanel;
