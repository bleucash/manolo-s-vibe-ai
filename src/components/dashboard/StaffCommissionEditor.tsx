import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Percent, Users, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import LoadingState from "@/components/ui/LoadingState";

const StaffCommissionEditor = ({ venueId }: { venueId: string }) => {
  const [staff, setStaff] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    const fetchActiveStaff = async () => {
      try {
        const { data: staffData } = await supabase
          .from("venue_staff")
          .select("id, user_id, commission_rate")
          .eq("venue_id", venueId)
          .eq("status", "active");
        if (staffData?.length) {
          const userIds = staffData.map((s) => s.user_id);
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id, display_name, username")
            .in("id", userIds);
          const profileMap = new Map(profiles?.map((p) => [p.id, p]));
          setStaff(staffData.map((s) => ({ ...s, profile: profileMap.get(s.user_id) })));
        }
      } finally {
        setIsLoading(false);
      }
    };
    fetchActiveStaff();
  }, [venueId]);

  const handleUpdateCommission = async (staffId: string, newRate: number) => {
    const rate = Math.max(0, Math.min(100, newRate));
    setUpdatingId(staffId);
    try {
      const { error } = await supabase.from("venue_staff").update({ commission_rate: rate }).eq("id", staffId);
      if (error) throw error;
      setStaff((prev) => prev.map((s) => (s.id === staffId ? { ...s, commission_rate: rate } : s)));
      toast.success("Incentive Calibrated");
    } catch {
      toast.error("Calibration Error");
    } finally {
      setUpdatingId(null);
    }
  };

  if (isLoading) return <LoadingState />;

  return (
    <Card className="bg-zinc-900/20 border-white/5 rounded-3xl overflow-hidden shadow-2xl">
      <CardHeader className="bg-zinc-900/40 border-b border-white/5 py-4">
        <CardTitle className="text-[10px] text-zinc-500 uppercase font-black tracking-[0.3em] flex items-center gap-2 italic">
          <ShieldCheck className="w-3 h-3 text-neon-purple" /> Incentive Calibration
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 space-y-3">
        {staff.length === 0 ? (
          <div className="py-8 text-center text-zinc-700 text-[9px] font-black uppercase tracking-widest">
            No active units linked
          </div>
        ) : (
          staff.map((member) => (
            <div
              key={member.id}
              className="flex items-center justify-between p-4 rounded-2xl bg-black/40 border border-white/5 group hover:border-neon-purple/30 transition-all"
            >
              <span className="text-sm font-bold text-white uppercase italic tracking-tight truncate flex-1">
                {member.profile?.display_name || member.profile?.username || "Unknown Unit"}
              </span>
              <div className="relative w-24">
                <Input
                  type="number"
                  defaultValue={member.commission_rate || 0}
                  onBlur={(e) => handleUpdateCommission(member.id, parseFloat(e.target.value) || 0)}
                  disabled={updatingId === member.id}
                  className="bg-black border-white/10 text-right pr-10 text-white font-display text-lg italic focus:border-neon-purple/50 focus:ring-0 rounded-xl"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                  <Percent className="w-4 h-4 text-neon-purple opacity-50" />
                </div>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
};

export default StaffCommissionEditor;
