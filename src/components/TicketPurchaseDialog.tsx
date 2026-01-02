import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Ticket, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Venue } from "@/types/venues";

interface TicketPurchaseDialogProps {
  venue: Venue;
  currentUserId: string | null;
}

export const TicketPurchaseDialog = ({ venue, currentUserId }: TicketPurchaseDialogProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handlePurchase = async () => {
    if (!currentUserId) {
      toast.error("Please log in to purchase tickets");
      return;
    }

    setLoading(true);
    // Placeholder for actual ticket purchase logic
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
          className="w-full h-14 text-lg font-bold uppercase tracking-widest rounded-xl bg-neon-green text-black shadow-2xl"
        >
          <Ticket className="mr-2" />
          Get Tickets
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-zinc-900 border-white/10">
        <DialogHeader>
          <DialogTitle className="text-white font-display uppercase tracking-tighter">
            {venue.name}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="bg-zinc-800 rounded-xl p-4 border border-white/5">
            <p className="text-zinc-400 text-sm mb-2">General Admission</p>
            <p className="text-white text-2xl font-bold">$20.00</p>
          </div>
          <Button
            onClick={handlePurchase}
            disabled={loading}
            className="w-full h-12 bg-neon-green text-black font-bold uppercase tracking-widest"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm Purchase"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
