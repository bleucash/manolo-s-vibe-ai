import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserMode } from "@/contexts/UserModeContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Users, CheckCircle, XCircle, Clock, UserPlus, Building2, Send, UserCheck } from "lucide-react";
import { toast } from "sonner";

interface VenueStaffRequest {
  id: string;
  venue_id: string;
  user_id: string;
  status: string;
  created_at: string;
}

interface ProfileInfo {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
}

const ManagerApprovalPanel = () => {
  const { activeVenueId } = useUserMode();
  const [isLoading, setIsLoading] = useState(true);
  const [requests, setRequests] = useState<VenueStaffRequest[]>([]);
  const [profileDetails, setProfileDetails] = useState<Map<string, ProfileInfo>>(new Map());
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (activeVenueId) {
      fetchRequests();
    } else {
      setIsLoading(false);
      setRequests([]);
    }

    const channel = supabase
      .channel("venue_staff_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "venue_staff",
        },
        () => {
          if (activeVenueId) fetchRequests();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeVenueId]);

  const fetchRequests = async () => {
    if (!activeVenueId) return;

    try {
      const { data: staffRecords, error: staffError } = await supabase
        .from("venue_staff")
        .select("*")
        .eq("venue_id", activeVenueId)
        .order("created_at", { ascending: false });

      if (staffError) throw staffError;

      const records = (staffRecords || []) as VenueStaffRequest[];
      setRequests(records);

      const userIds = [...new Set(records.map((r) => r.user_id))];
      if (userIds.length > 0) {
        const { data: profiles, error: profileError } = await supabase
          .from("profiles")
          .select("id, display_name, username, avatar_url")
          .in("id", userIds);

        if (!profileError && profiles) {
          const profileMap = new Map<string, ProfileInfo>();
          profiles.forEach((p: ProfileInfo) => profileMap.set(p.id, p));
          setProfileDetails(profileMap);
        }
      }
    } catch (err) {
      console.error("Error fetching requests:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateStatus = async (requestId: string, newStatus: "active" | "rejected") => {
    setProcessingIds((prev) => new Set(prev).add(requestId));

    try {
      let error;
      if (newStatus === "rejected") {
        // If rejecting or canceling an invite, we delete the record to keep DB clean
        const { error: delError } = await supabase.from("venue_staff").delete().eq("id", requestId);
        error = delError;
      } else {
        const { error: updError } = await supabase
          .from("venue_staff")
          .update({ status: newStatus })
          .eq("id", requestId);
        error = updError;
      }

      if (error) throw error;

      toast.success(newStatus === "active" ? "Affiliation Approved" : "Request Removed");
      fetchRequests();
    } catch (err) {
      console.error("Update error:", err);
      toast.error("Operation failed");
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(requestId);
        return next;
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-neon-green" />
      </div>
    );
  }

  // CATEGORIES
  const incomingApps = requests.filter((r) => r.status === "pending");
  const outgoingInvites = requests.filter((r) => r.status === "pending_talent_action");
  const activePerformers = requests.filter((r) => r.status === "active");

  const renderUserRow = (req: VenueStaffRequest, type: "incoming" | "outgoing" | "active") => {
    const profile = profileDetails.get(req.user_id);
    const isProcessing = processingIds.has(req.id);

    return (
      <div key={req.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
        <div className="w-10 h-10 rounded-full overflow-hidden bg-zinc-800 shrink-0">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} className="w-full h-full object-cover" alt="" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-xs font-bold text-zinc-500">
              {profile?.display_name?.charAt(0) || "?"}
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white truncate">
            {profile?.display_name || profile?.username || "Unknown"}
          </p>
          <p className="text-[10px] text-zinc-500 uppercase tracking-widest">
            {type === "incoming" ? "Applied for Gig" : type === "outgoing" ? "Awaiting Talent" : "Active Connection"}
          </p>
        </div>

        <div className="flex gap-1">
          {type === "incoming" && (
            <>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-neon-green hover:bg-neon-green/10"
                onClick={() => handleUpdateStatus(req.id, "active")}
                disabled={isProcessing}
              >
                <CheckCircle className="w-5 h-5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-red-500 hover:bg-red-500/10"
                onClick={() => handleUpdateStatus(req.id, "rejected")}
                disabled={isProcessing}
              >
                <XCircle className="w-5 h-5" />
              </Button>
            </>
          )}
          {type === "outgoing" && (
            <Button
              size="sm"
              variant="ghost"
              className="text-[10px] text-zinc-500 hover:text-red-500 uppercase font-bold"
              onClick={() => handleUpdateStatus(req.id, "rejected")}
              disabled={isProcessing}
            >
              Cancel
            </Button>
          )}
          {type === "active" && (
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-zinc-600 hover:text-red-500"
              onClick={() => handleUpdateStatus(req.id, "rejected")}
              disabled={isProcessing}
            >
              <XCircle className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
      {/* 1. INCOMING */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          <UserPlus className="w-4 h-4 text-neon-purple" />
          <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Incoming Applications</h3>
          {incomingApps.length > 0 && (
            <Badge className="bg-neon-purple h-4 px-1.5 text-[9px]">{incomingApps.length}</Badge>
          )}
        </div>
        {incomingApps.length > 0 ? (
          incomingApps.map((r) => renderUserRow(r, "incoming"))
        ) : (
          <p className="text-[10px] text-zinc-600 italic px-1">No pending applications from talent.</p>
        )}
      </div>

      {/* 2. OUTGOING */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          <Send className="w-4 h-4 text-amber-500" />
          <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Sent Invitations</h3>
          {outgoingInvites.length > 0 && (
            <Badge className="bg-amber-500 h-4 px-1.5 text-[9px] text-black">{outgoingInvites.length}</Badge>
          )}
        </div>
        {outgoingInvites.length > 0 ? (
          outgoingInvites.map((r) => renderUserRow(r, "outgoing"))
        ) : (
          <p className="text-[10px] text-zinc-600 italic px-1">No pending invites sent by you.</p>
        )}
      </div>

      {/* 3. ACTIVE */}
      <div className="space-y-3 pt-2 border-t border-white/5">
        <div className="flex items-center gap-2 px-1">
          <UserCheck className="w-4 h-4 text-neon-green" />
          <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Venue Performers</h3>
        </div>
        {activePerformers.length > 0 ? (
          activePerformers.map((r) => renderUserRow(r, "active"))
        ) : (
          <p className="text-[10px] text-zinc-600 italic px-1">No active connections yet.</p>
        )}
      </div>
    </div>
  );
};

export default ManagerApprovalPanel;
