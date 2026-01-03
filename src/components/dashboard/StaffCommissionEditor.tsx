import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Loader2, Percent, Users } from "lucide-react";
import { toast } from "sonner";

interface StaffMember {
  id: string;
  user_id: string;
  commission_rate: number;
  profile: {
    display_name: string | null;
    username: string | null;
  } | null;
}

interface StaffCommissionEditorProps {
  venueId: string;
}

const StaffCommissionEditor = ({ venueId }: StaffCommissionEditorProps) => {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    const fetchActiveStaff = async () => {
      try {
        // Fetch active staff for this venue
        const { data: staffData, error: staffError } = await supabase
          .from("venue_staff")
          .select("id, user_id, commission_rate, status")
          .eq("venue_id", venueId)
          .eq("status", "active");

        if (staffError) {
          return;
        }

        if (!staffData || staffData.length === 0) {
          setStaff([]);
          setIsLoading(false);
          return;
        }

        // Fetch profiles for each staff member
        const userIds = staffData.map((s) => s.user_id);
        const { data: profiles, error: profileError } = await supabase
          .from("profiles")
          .select("id, display_name, username")
          .in("id", userIds);

        // Profile fetch errors are non-fatal

        // Map profiles to staff
        const profileMap = new Map(profiles?.map((p) => [p.id, p]) || []);
        const enrichedStaff: StaffMember[] = staffData.map((s) => ({
          id: s.id,
          user_id: s.user_id,
          commission_rate: (s as any).commission_rate || 0,
          profile: profileMap.get(s.user_id) || null,
        }));

        setStaff(enrichedStaff);
      } catch {
        // Silently handle errors
      } finally {
        setIsLoading(false);
      }
    };

    fetchActiveStaff();
  }, [venueId]);

  const handleUpdateCommission = async (staffId: string, userId: string, newRate: number) => {
    // Clamp rate between 0 and 100
    const rate = Math.max(0, Math.min(100, newRate));
    
    setUpdatingId(staffId);
    try {
      const { error } = await supabase
        .from("venue_staff")
        .update({ commission_rate: rate } as any)
        .eq("id", staffId)
        .eq("venue_id", venueId);

      if (error) {
        toast.error("Failed to update commission rate");
        return;
      }

      // Update local state
      setStaff((prev) =>
        prev.map((s) => (s.id === staffId ? { ...s, commission_rate: rate } : s))
      );
      toast.success("Commission rate updated");
    } catch {
      toast.error("Something went wrong");
    } finally {
      setUpdatingId(null);
    }
  };

  if (isLoading) {
    return (
      <Card className="glass border-border/50">
        <CardContent className="py-8 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (staff.length === 0) {
    return (
      <Card className="glass border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs text-muted-foreground font-medium uppercase tracking-wider flex items-center gap-2">
            <Percent className="w-4 h-4 text-neon-purple" />
            Commission Rates
          </CardTitle>
        </CardHeader>
        <CardContent className="py-6 text-center">
          <Users className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">No active talent staff</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-xs text-muted-foreground font-medium uppercase tracking-wider flex items-center gap-2">
          <Percent className="w-4 h-4 text-neon-purple" />
          Commission Rates
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {staff.map((member) => {
          const displayName =
            member.profile?.display_name ||
            member.profile?.username ||
            "Unknown Talent";

          return (
            <div
              key={member.id}
              className="flex items-center justify-between gap-4 p-3 rounded-lg bg-background/50 border border-border/30"
            >
              <span className="text-sm font-medium text-foreground truncate flex-1">
                {displayName}
              </span>
              <div className="relative w-20">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  defaultValue={member.commission_rate}
                  onBlur={(e) => {
                    const newRate = parseFloat(e.target.value) || 0;
                    if (newRate !== member.commission_rate) {
                      handleUpdateCommission(member.id, member.user_id, newRate);
                    }
                  }}
                  disabled={updatingId === member.id}
                  className="pr-8 text-right bg-background border-border/50 focus:border-neon-purple/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                  {updatingId === member.id ? (
                    <Loader2 className="w-4 h-4 animate-spin text-neon-purple" />
                  ) : (
                    <Percent className="w-4 h-4 text-neon-purple" />
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

export default StaffCommissionEditor;
