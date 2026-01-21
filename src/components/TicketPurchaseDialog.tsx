import React, { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Ticket, Plus, Minus, Loader2, ShieldCheck } from "lucide-react";

// Synchronized with Venue.tsx props
interface TicketPurchaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  venueId: string;
  venueName: string;
  price: number;
  referralId?: string | null; // The Talent ID for the 10% commission
}

export const TicketPurchaseDialog = ({
  open,
  onOpenChange,
  venueId,
  venueName,
  price,
  referralId,
}: TicketPurchaseDialogProps) => {
  const [quantity, setQuantity] = useState(1);
  const [purchasing, setPurchasing] = useState(false);
  const incrementQuantity = () => setQuantity((q) => Math.min(q + 1, 10));
  const decrementQuantity = () => setQuantity((q) => Math.max(q - 1, 1));

  const handleConfirmPurchase = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      toast.error("Please log in to purchase");
      return;
    }

    setPurchasing(true);

    try {
      // API call to your Stripe Edge Function
      const response = await fetch("https://zfghkkhsdqsrjkbpkujn.supabase.co/functions/v1/create-checkout-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          venue_id: venueId,
          price_type: "entry",
          quantity: quantity,
          // 🚀 B2B ATTACHMENT: Passing the Talent ID to Stripe metadata
          referral_id: referralId || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();

      if (data?.url) {
        // Redirect to Stripe Checkout with referral data persisted in session
        window.location.href = data.url;
      } else {
        throw new Error("No checkout URL returned");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Payment failed. Please try again.");
      setPurchasing(false);
    }
  };

  const totalPrice = (quantity * price).toFixed(2);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass border-border/50 max-w-sm bg-zinc-950 text-white rounded-[2rem]">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl uppercase tracking-wide text-center">Confirm Entry</DialogTitle>
        </DialogHeader>

        <div className="py-6 space-y-6">
          <div className="text-center">
            <p className="text-muted-foreground text-[10px] uppercase tracking-widest mb-1 font-bold">Venue</p>
            <p className="text-foreground font-semibold text-lg uppercase tracking-tighter">{venueName}</p>
          </div>

          <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
            <div className="flex justify-between items-center mb-6">
              <span className="text-zinc-400 text-xs uppercase font-bold tracking-widest">General Admission</span>
              <span className="text-[hsl(150,100%,50%)] font-black">${price.toFixed(2)}</span>
            </div>

            <div className="flex items-center justify-center gap-8">
              <Button
                variant="outline"
                size="icon"
                onClick={decrementQuantity}
                disabled={quantity <= 1}
                className="h-12 w-12 rounded-full border-white/10 bg-black text-white"
              >
                <Minus className="h-4 w-4" />
              </Button>
              <span className="text-4xl font-display text-white w-12 text-center">{quantity}</span>
              <Button
                variant="outline"
                size="icon"
                onClick={incrementQuantity}
                disabled={quantity >= 10}
                className="h-12 w-12 rounded-full border-white/10 bg-black text-white"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* ⚡ REFERRAL INDICATOR */}
          {referralId && (
            <div className="flex items-center justify-center gap-2 py-2 px-4 bg-[hsl(150,100%,50%)]/10 rounded-full border border-[hsl(150,100%,50%)]/20">
              <ShieldCheck className="w-3 h-3 text-[hsl(150,100%,50%)]" />
              <span className="text-[9px] font-black uppercase tracking-[0.2em] text-[hsl(150,100%,50%)]">
                Talent Referral Applied
              </span>
            </div>
          )}

          <div className="flex justify-between items-center pt-4 border-t border-white/5">
            <span className="text-zinc-500 uppercase text-xs tracking-widest font-bold">Total Due</span>
            <span className="text-3xl font-display text-[hsl(150,100%,50%)]">${totalPrice}</span>
          </div>
        </div>

        <DialogFooter className="sm:justify-center">
          <Button
            onClick={handleConfirmPurchase}
            disabled={purchasing}
            className="w-full h-14 bg-[hsl(150,100%,50%)] text-black font-black uppercase tracking-[0.2em] rounded-2xl shadow-[0_10px_30px_rgba(57,255,20,0.3)]"
          >
            {purchasing ? <Loader2 className="animate-spin" /> : "Purchase with Stripe"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
