import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserMode } from "@/contexts/UserModeContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, UserPlus, Send, UserCheck } from "lucide-react";
import { toast } from "sonner";
import LoadingState from "@/components/ui/LoadingState";

interface ProfileInfo {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
}

const ManagerApprovalPanel = () => {
  const { activeVenueId } = useUserMode();
  const [isLoading, setIsLoading] = useState(true);
  const [requests, setRequests] = useState<any[]>([]);
  const [profileDetails, setProfileDetails] = useState<Map<string, ProfileInfo>>(new Map());
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (activeVenueId) fetchRequests();

    const channel = supabase
      .channel("venue_staff_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "venue_staff" }, () => {
        if (activeVenueId) fetchRequests();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeVenueId]);

  const fetchRequests = async () => {
    if (!activeVenueId) return;
    try {
      const { data: records } = await supabase
        .from("venue_staff")
        .select("*")
        .eq("venue_id", activeVenueId)
        .order("created_at", { ascending: false });

      if (records) {
        setRequests(records);
        const userIds = [...new Set(records.map((r: any) => r.user_id))];
        if (userIds.length > 0) {
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id, display_name, username, avatar_url")
            .in("id", userIds);
          if (profiles) {
            const profileMap = new Map();
            profiles.forEach((p) => profileMap.set(p.id, p));
            setProfileDetails(profileMap);
          }
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateStatus = async (requestId: string, newStatus: "active" | "rejected") => {
    setProcessingIds((prev) => new Set(prev).add(requestId));
    try {
      if (newStatus === "rejected") {
        await supabase.from("venue_staff").delete().eq("id", requestId);
      } else {
        await supabase.from("venue_staff").update({ status: newStatus }).eq("id", requestId);
      }
      toast.success(newStatus === "active" ? "Neural Link Confirmed" : "Request Dismissed");
      fetchRequests();
    } catch {
      toast.error("Sync Failed");
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(requestId);
        return next;
      });
    }
  };

  if (isLoading) return <LoadingState />;

  const incomingApps = requests.filter((r) => r.status === "pending");
  const outgoingInvites = requests.filter((r) => r.status === "pending_talent_action");
  const activePerformers = requests.filter((r) => r.status === "active");

  const renderUserRow = (req: any, type: "incoming" | "outgoing" | "active") => {
    const profile = profileDetails.get(req.user_id);
    const isProcessing = processingIds.has(req.id);

    return (
      <div
        key={req.id}
        className="flex items-center gap-4 p-4 rounded-2xl bg-zinc-900/40 border border-white/5 group hover:border-white/10 transition-all"
      >
        <div className="w-10 h-10 rounded-full overflow-hidden bg-black border border-white/10 shrink-0">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} className="w-full h-full object-cover" alt="" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[10px] font-black text-zinc-600 uppercase">
              {profile?.display_name?.charAt(0) || "U"}
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white uppercase italic tracking-tight truncate">
            {profile?.display_name || profile?.username || "Neural ID Unknown"}
          </p>
          <p className="text-[8px] text-zinc-500 uppercase font-black tracking-widest mt-0.5">
            {type === "incoming"
              ? "Requesting Entry"
              : type === "outgoing"
                ? "Awaiting Response"
                : "Verified Connection"}
          </p>
        </div>

        <div className="flex gap-1">
          {type === "incoming" ? (
            <>
              <Button
                size="icon"
                variant="ghost"
                className="h-9 w-9 text-neon-green hover:bg-neon-green/10"
                onClick={() => handleUpdateStatus(req.id, "active")}
                disabled={isProcessing}
              >
                <CheckCircle2 className="w-5 h-5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-9 w-9 text-red-500 hover:bg-red-500/10"
                onClick={() => handleUpdateStatus(req.id, "rejected")}
                disabled={isProcessing}
              >
                <XCircle className="w-5 h-5" />
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              className="text-[9px] font-black text-zinc-600 hover:text-white uppercase tracking-widest"
              onClick={() => handleUpdateStatus(req.id, "rejected")}
              disabled={isProcessing}
            >
              {type === "active" ? "Sever" : "Cancel"}
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8 max-h-[60vh] overflow-y-auto no-scrollbar pr-2">
      <div className="space-y-4">
        <div className="flex items-center gap-2 px-1">
          <UserPlus className="w-3 h-3 text-neon-purple" />
          <h3 className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.3em]">Incoming Streams</h3>
          {incomingApps.length > 0 && (
            <Badge className="bg-neon-purple text-white text-[8px] h-4 rounded-full">{incomingApps.length}</Badge>
          )}
        </div>
        {incomingApps.length > 0 ? (
          incomingApps.map((r) => renderUserRow(r, "incoming"))
        ) : (
          <p className="text-[9px] text-zinc-700 italic px-1 uppercase tracking-widest">Zero active applications</p>
        )}
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-2 px-1">
          <Send className="w-3 h-3 text-amber-500" />
          <h3 className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.3em]">Neural Invites</h3>
        </div>
        {outgoingInvites.length > 0 ? (
          outgoingInvites.map((r) => renderUserRow(r, "outgoing"))
        ) : (
          <p className="text-[9px] text-zinc-700 italic px-1 uppercase tracking-widest">No pending handshakes</p>
        )}
      </div>

      <div className="space-y-4 border-t border-white/5 pt-6">
        <div className="flex items-center gap-2 px-1">
          <UserCheck className="w-3 h-3 text-neon-green" />
          <h3 className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.3em]">Verified Staff</h3>
        </div>
        {activePerformers.length > 0 ? (
          activePerformers.map((r) => renderUserRow(r, "active"))
        ) : (
          <p className="text-[9px] text-zinc-700 italic px-1 uppercase tracking-widest">Ledger empty</p>
        )}
      </div>
    </div>
  );
};

export default ManagerApprovalPanel;
