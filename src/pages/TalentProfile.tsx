import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserMode } from "@/contexts/UserModeContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { ArrowLeft, MapPin, Sparkles, CheckCircle2, Clock } from "lucide-react"; // Removed Loader2
import { FollowButton } from "@/components/FollowButton";
import { toast } from "sonner";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { z } from "zod";
import LoadingState from "@/components/ui/LoadingState"; // Unified Loader

// Validation schema for venue staff invitations
const venueStaffInviteSchema = z.object({
  venue_id: z.string().uuid("Invalid venue ID"),
  user_id: z.string().uuid("Invalid user ID"),
  status: z.enum(["pending", "pending_talent_action"]),
});

const TalentProfile = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { mode, activeVenueId, userVenues, session } = useUserMode();

  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [schedule, setSchedule] = useState<any[]>([]);
  const [inviting, setInviting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<string | null>(null);

  const currentUserId = session?.user?.id || null;
  const activeVenue = userVenues.find((v) => v.id === activeVenueId);

  useEffect(() => {
    fetchData();
  }, [id, activeVenueId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      // 1. Fetch Profile
      const { data: profileData } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle();
      if (profileData) setProfile(profileData);

      // 2. Fetch Active Residencies
      const { data: staffData } = await supabase
        .from("venue_staff")
        .select("venue_id, venues(id, name, location)")
        .eq("user_id", id)
        .eq("status", "active");

      if (staffData) {
        setSchedule(
          staffData.map((s: any) => ({
            id: s.venue_id,
            venue_id: s.venues?.id,
            venue_name: s.venues?.name,
            venue_location: s.venues?.location,
          })),
        );
      }

      // 3. Check Connection Status with the Active Manager's Venue
      if (activeVenueId && id) {
        const { data: existing } = await supabase
          .from("venue_staff")
          .select("status")
          .eq("venue_id", activeVenueId)
          .eq("user_id", id)
          .maybeSingle();

        if (existing) setConnectionStatus(existing.status);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async () => {
    if (!activeVenueId || !id) return;
    
    const inviteData = {
      venue_id: activeVenueId,
      user_id: id,
      status: "pending_talent_action" as const,
    };
    
    const validation = venueStaffInviteSchema.safeParse(inviteData);
    if (!validation.success) {
      toast.error("Invalid invitation data");
      return;
    }
    
    setInviting(true);
    try {
      const { data: existing } = await supabase
        .from("venue_staff")
        .select("status")
        .eq("venue_id", activeVenueId)
        .eq("user_id", id)
        .maybeSingle();
      
      if (existing) {
        toast.error(`Connection already exists: ${existing.status}`);
        setConnectionStatus(existing.status);
        return;
      }
      
      const { error } = await supabase.from("venue_staff").insert(inviteData);
      if (error) throw error;
      toast.success("Invitation sent!");
      setConnectionStatus("pending_talent_action");
    } catch (err: any) {
      toast.error(err.code === "23505" ? "Talent already invited." : "Failed to send invitation");
    } finally {
      setInviting(false);
    }
  };

  // --- UNIFIED LOADING EXPERIENCE ---
  if (loading) {
    return <LoadingState />;
  }

  if (!profile) {
    return (
      <div className="h-screen flex items-center justify-center bg-black text-zinc-500 uppercase text-[10px] tracking-widest font-bold">
        Talent Synchronization Failed
      </div>
    );
  }

  const isSelfView = currentUserId === id;

  return (
    <div className="min-h-screen bg-background pb-32 animate