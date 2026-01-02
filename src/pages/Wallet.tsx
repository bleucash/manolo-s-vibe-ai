import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Ticket, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface TicketData {
  id: string;
  event_name: string;
  event_date: string | null;
  status: string;
  qr_code: string;
  price_paid: number;
  created_at: string;
}

const Wallet = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState<TicketData[]>([]);
  const [isCreatingTicket, setIsCreatingTicket] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) {
        navigate("/auth");
        return;
      }
      const userId = session.user.id;
      setCurrentUserId(userId);

      const { data, error } = await supabase
        .from("tickets")
        .select("id, event_name, event_date, status, qr_code, price_paid, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (!error && data) {
        setTickets(data as TicketData[]);
      }

      setLoading(false);
    };

    fetchData();
  }, [navigate]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleSimulateTicketPurchase = async () => {
    if (!currentUserId) return;
    setIsCreatingTicket(true);

    const insertPayload = {
      user_id: currentUserId,
      event_name: "VIP Guest Entry",
      event_date: new Date().toISOString(),
      status: "active",
      qr_code: crypto.randomUUID(),
      price_paid: 20.0,
    };

    const { data, error } = await supabase.from("tickets").insert(insertPayload).select().single();

    if (error) {
      toast.error("Ticket purchase failed");
    } else {
      setTickets((prev) => [data as TicketData, ...prev]);
      toast.success("Ticket added to wallet");
    }
    setIsCreatingTicket(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <Skeleton className="h-10 w-48 mb-6" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b border-border safe-top">
        <div className="flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <Ticket className="h-5 w-5 text-neon-pink" />
            <h1 className="text-xl font-bold">My Wallet</h1>
          </div>
          {import.meta.env.DEV && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleSimulateTicketPurchase}
              disabled={isCreatingTicket}
              className="border-neon-pink/50 text-xs text-neon-pink"
            >
              {isCreatingTicket ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3 mr-1" />}
              Buy Test Ticket
            </Button>
          )}
        </div>
      </div>

      {/* Ticket List */}
      <div className="p-4 space-y-4">
        {tickets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Ticket className="h-16 w-16 text-muted-foreground/20 mb-4" />
            <p className="text-muted-foreground">Your wallet is empty.</p>
            <Button onClick={() => navigate("/discovery")} className="mt-4 variant-ghost">
              Browse Events
            </Button>
          </div>
        ) : (
          tickets.map((ticket) => (
            <Card key={ticket.id} className="border-border/50 bg-card overflow-hidden">
              <div className="bg-primary/5 p-4 border-b border-dashed border-border flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-foreground">{ticket.event_name}</h3>
                  <p className="text-xs text-muted-foreground">
                    {ticket.event_date ? formatDate(ticket.event_date) : "Valid Tonight"}
                  </p>
                </div>
                <Badge
                  className={
                    ticket.status === "active" ? "bg-neon-green/20 text-neon-green" : "bg-muted text-muted-foreground"
                  }
                >
                  {ticket.status === "active" ? "Ready to Scan" : "Used"}
                </Badge>
              </div>
              <CardContent className="flex flex-col items-center py-6">
                <div className="bg-white p-3 rounded-xl mb-4">
                  <QRCodeSVG value={ticket.qr_code} size={140} />
                </div>
                <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-tighter">
                  ID: {ticket.id.split("-")[0]}
                </p>
              </CardContent>
              <div className="bg-muted/30 p-3 flex justify-between text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
                <span>Price: ${ticket.price_paid}</span>
                <span>SECURED BY NIGHTLIFE INTEL</span>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default Wallet;
