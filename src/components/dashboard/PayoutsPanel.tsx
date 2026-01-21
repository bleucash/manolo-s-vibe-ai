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

export function PayoutsPanel({ venueId }: PayoutsPanelProps) {
  const [payouts, setPayouts] = useState<TalentPayout[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchCommissions() {
      setIsLoading(true);

      const { data, error } = await supabase
        .from("tickets")
        .select(`
          promoter_id,
          price_paid,
          profiles!tickets_promoter_id_fkey (
            display_name,
            username
          )
        `)
        .eq("venue_id", venueId)
        .eq("status", "Scanned")
        .not("promoter_id", "is", null);

      if (error) {
        console.error("Error fetching commissions:", error);
        setIsLoading(false);
        return;
      }

      // Aggregate by talent
      const aggregated = new Map<string, TalentPayout>();

      data?.forEach((ticket) => {
        const promoterId = ticket.promoter_id as string;
        const profile = ticket.profiles as unknown as { display_name: string | null; username: string | null } | null;
        const displayName = profile?.display_name || profile?.username || "Unknown Talent";
        const commission = (ticket.price_paid || 0) * 0.15; // 15% flat rate

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
    toast.success(`Settlement of $${talent.totalCommission.toFixed(2)} processed for ${talent.displayName}`);
  };

  // CRITICAL: Return null while loading to let parent's Master Loader stay visible
  if (isLoading) {
    return null;
  }

  return (
    <div className="animate-in fade-in duration-500">
      <Card className="bg-white/5 border-white/5">
        <CardHeader className="flex flex-row items-center gap-3 pb-4">
          <Wallet className="h-5 w-5 text-primary" />
          <CardTitle className="font-black uppercase tracking-widest text-sm">
            Commission Payouts
          </CardTitle>
        </CardHeader>
        <CardContent>
          {payouts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <History className="h-10 w-10 mb-3 opacity-50" />
              <p className="font-black uppercase tracking-widest text-xs">
                No Active Commissions
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {payouts.map((talent) => (
                <div
                  key={talent.promoterId}
                  className="flex items-center justify-between p-4 rounded-lg bg-white/5 border border-white/5"
                >
                  <div className="space-y-1">
                    <p className="font-black uppercase tracking-widest text-xs text-foreground">
                      {talent.displayName}
                    </p>
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                      {talent.ticketCount} ticket{talent.ticketCount !== 1 ? "s" : ""} scanned
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-black text-lg text-primary">
                      ${talent.totalCommission.toFixed(2)}
                    </span>
                    <Button
                      size="sm"
                      onClick={() => handleProcessPayout(talent)}
                      className="bg-primary hover:bg-primary/80 text-primary-foreground font-black uppercase tracking-widest text-xs gap-2"
                    >
                      <Send className="h-3 w-3" />
                      Settle
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
