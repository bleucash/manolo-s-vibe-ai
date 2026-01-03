import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Ticket, Loader2, Zap } from "lucide-react";
import { toast } from "sonner";
import { Venue } from "@/types/venues";

interface TicketPurchaseDialogProps {
  venue: Venue;
  currentUserId: string | null;
  referralId?: string | null;
}

export const TicketPurchaseDialog = ({ venue, currentUserId, referralId }: TicketPurchaseDialogProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handlePurchase = async () => {
    if (!currentUserId) {
      toast.error("Please log in to purchase tickets");
      return;
    }

    setLoading(true);
    // Placeholder for actual ticket purchase logic with referral attribution
    console.log("Purchase initiated:", {
      venueId: venue.id,
      venueName: venue.name,
      userId: currentUserId,
      referralId: referralId ?? null,
    });
    await new Promise((resolve) => setTimeout(resolve, 500));
    toast.success("Ticket purchased! Check your wallet.");
    setOpen(false);
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="lg"
          className="w-full h-14 text-lg font-bold uppercase tracking-widest rounded-xl bg-primary text-primary-foreground shadow-2xl hover:bg-primary/90"
        >
          <Ticket className="mr-2" />
          Secure Entry
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground font-display uppercase tracking-tighter">
            {venue.name}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="bg-muted rounded-xl p-4 border border-border">
            <p className="text-muted-foreground text-sm mb-2">General Admission</p>
            <p className="text-foreground text-2xl font-bold">$20.00</p>
          </div>
          
          {referralId && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 border border-primary/30">
              <Zap className="w-4 h-4 text-primary" />
              <span className="text-primary text-xs font-medium">
                Promoter commission will be applied
              </span>
            </div>
          )}
          
          <Button
            onClick={handlePurchase}
            disabled={loading}
            className="w-full h-12 bg-primary text-primary-foreground font-bold uppercase tracking-widest hover:bg-primary/90"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm Purchase"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
