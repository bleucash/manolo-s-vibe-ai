import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ChevronLeft, Check, X, Users, Clock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

interface StaffRequest {
  id: string;
  user_id: string;
  venue_id: string;
  status: string;
  staff_role: string | null;
  commission_rate: number | null;
  profiles: {
    display_name: string | null;
    avatar_url: string | null;
    sub_role: string | null;
  } | null;
}

const ManageVenue = () => {
  const { id: venueId } = useParams();
  const navigate = useNavigate();
  
  const [requests, setRequests] = useState<StaffRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    if (venueId) fetchStaffRequests();
  }, [venueId]);

  const fetchStaffRequests = async () => {
    if (!venueId) return;
    
    try {
      const { data, error } = await supabase
        .from("venue_staff")
        .select(`
          id,
          user_id,
          venue_id,
          status,
          staff_role,
          commission_rate,
          profiles:user_id (
            display_name,
            avatar_url,
            sub_role
          )
        `)
        .eq("venue_id", venueId);

      if (error) throw error;
      
      // Supabase returns profiles as array for joined queries, extract first item
      const normalized = (data || []).map((item: any) => ({
        ...item,
        profiles: Array.isArray(item.profiles) ? item.profiles[0] : item.profiles
      }));
      
      setRequests(normalized as StaffRequest[]);
    } catch (error) {
      console.error("Error fetching staff:", error);
      toast.error("Failed to load talent roster");
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (staffId: string, newStatus: "active" | "rejected") => {
    setProcessingId(staffId);
    
    try {
      const { error } = await supabase
        .from("venue_staff")
        .update({ status: newStatus })
        .eq("id", staffId);

      if (error) throw error;

      toast.success(newStatus === "active" ? "Talent approved!" : "Application rejected");
      
      // Update local state
      setRequests(prev => 
        prev.map(req => 
          req.id === staffId ? { ...req, status: newStatus } : req
        )
      );
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Failed to update status");
    } finally {
      setProcessingId(null);
    }
  };

  const activeCount = requests.filter(r => r.status === "active").length;
  const pendingCount = requests.filter(r => r.status === "pending").length;

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground pb-24">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border px-4 py-4 flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(-1)}
          className="rounded-full"
        >
          <ChevronLeft className="w-6 h-6" />
        </Button>
        <h1 className="font-display text-xl uppercase tracking-tighter">
          Venue Control
        </h1>
      </div>

      {/* KPI Cards */}
      <div className="p-4 grid grid-cols-2 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-border rounded-xl p-4 text-center"
        >
          <Users className="w-6 h-6 mx-auto mb-2 text-primary" />
          <p className="text-3xl font-display text-primary">{activeCount}</p>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
            Active Talent
          </p>
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card border border-border rounded-xl p-4 text-center"
        >
          <Clock className="w-6 h-6 mx-auto mb-2 text-yellow-500" />
          <p className="text-3xl font-display text-yellow-500">{pendingCount}</p>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
            Pending
          </p>
        </motion.div>
      </div>

      {/* Talent List */}
      <div className="px-4 space-y-3">
        <h2 className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-3">
          Talent Roster
        </h2>

        {requests.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Users className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p className="text-sm">No talent applications yet</p>
          </div>
        ) : (
          requests.map((request, index) => (
            <motion.div
              key={request.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className="bg-card border border-border rounded-xl p-4 flex items-center gap-4"
            >
              <Avatar className="w-12 h-12 border-2 border-border">
                <AvatarImage src={request.profiles?.avatar_url || undefined} />
                <AvatarFallback className="bg-muted text-muted-foreground font-bold">
                  {request.profiles?.display_name?.charAt(0)?.toUpperCase() || "?"}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground truncate">
                  {request.profiles?.display_name || "Unknown Talent"}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {request.profiles?.sub_role || "Performer"}
                </p>
              </div>

              {request.status === "pending" ? (
                <div className="flex gap-2">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => updateStatus(request.id, "active")}
                    disabled={processingId === request.id}
                    className="w-10 h-10 rounded-full bg-primary/10 hover:bg-primary/20 text-primary"
                  >
                    {processingId === request.id ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Check className="w-5 h-5" />
                    )}
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => updateStatus(request.id, "rejected")}
                    disabled={processingId === request.id}
                    className="w-10 h-10 rounded-full bg-destructive/10 hover:bg-destructive/20 text-destructive"
                  >
                    <X className="w-5 h-5" />
                  </Button>
                </div>
              ) : (
                <Badge
                  className={
                    request.status === "active"
                      ? "bg-primary/20 text-primary border-primary/30"
                      : "bg-destructive/20 text-destructive border-destructive/30"
                  }
                >
                  {request.status}
                </Badge>
              )}
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
};

export default ManageVenue;
