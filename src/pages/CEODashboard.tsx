import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ShieldAlert,
  ShieldCheck,
  Users,
  Building2,
  CheckCircle,
  XCircle,
  Instagram,
  ExternalLink,
  Zap,
  Loader2,
  Search
} from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const CEODashboard = () => {
  const [venueClaims, setVenueClaims] = useState<any[]>([]);
  const [pendingTalent, setPendingTalent] = useState<any[]>([]);
  const [pendingBusiness, setPendingBusiness] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOversightData();
  }, []);

  const fetchOversightData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Venue Claims
      const { data: vClaims } = await supabase
        .from("venue_claims")
        .select("*, venues(name, location), profiles(display_name, username)")
        .eq("status", "pending");

      // 2. Fetch pending talent applications (build order item 4).
      const { data: tPending } = await supabase
        .from("talent_applications")
        .select("*, profiles(display_name, username, avatar_url, sub_role)")
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      // 3. Fetch pending business verification applications (Tier 2, part d).
      // Readable here via the is_admin() escape hatch on the table's SELECT
      // policy; a non-admin only ever sees their own rows.
      const { data: bPending } = await supabase
        .from("venue_business_applications")
        .select("*, venues(name, location), profiles(display_name, username)")
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (vClaims) setVenueClaims(vClaims);
      if (tPending) setPendingTalent(tPending);
      if (bPending) setPendingBusiness(bPending);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleVenueApproval = async (claimId: string, venueId: string, userId: string, approve: boolean) => {
    try {
      const { data, error } = await supabase.functions.invoke("admin-actions", {
        body: approve
          ? { action: "approve_venue_claim", payload: { claim_id: claimId, venue_id: venueId, user_id: userId } }
          : { action: "reject_venue_claim", payload: { claim_id: claimId } },
      });
      if (error || (data as any)?.error) {
        toast.error("Handshake Error");
        return;
      }
      if (approve) toast.success("Sector Link Verified");
      else toast.error("Claim Denied");
      fetchOversightData();
    } catch (err) {
      toast.error("Handshake Error");
    }
  };

  const handleTalentApproval = async (userId: string, approve: boolean) => {
    try {
      const { data, error } = await supabase.functions.invoke("admin-actions", {
        body: approve
          ? { action: "approve_talent", payload: { user_id: userId } }
          : { action: "reject_talent", payload: { user_id: userId } },
      });
      if (error || (data as any)?.error) {
        toast.error("Verification Error");
        return;
      }
      if (approve) toast.success("Talent Verified");
      else toast.error("Talent Credentials Rejected");
      fetchOversightData();
    } catch (err) {
      toast.error("Verification Error");
    }
  };

  // Same shape as handleTalentApproval; approve_business/reject_business take
  // { venue_id } rather than { user_id } because Tier 2 is per-venue.
  const handleBusinessApproval = async (venueId: string, approve: boolean) => {
    try {
      const { data, error } = await supabase.functions.invoke("admin-actions", {
        body: approve
          ? { action: "approve_business", payload: { venue_id: venueId } }
          : { action: "reject_business", payload: { venue_id: venueId } },
      });
      if (error || (data as any)?.error) {
        toast.error("Verification Error");
        return;
      }
      if (approve) toast.success("Business Verified");
      else toast.error("Business Verification Rejected");
      fetchOversightData();
    } catch (err) {
      toast.error("Verification Error");
    }
  };

  if (loading) return <div className="h-screen bg-black flex items-center justify-center"><Loader2 className="animate-spin text-neon-pink" /></div>;

  return (
    <div className="min-h-screen bg-black pb-40">
      {/* HUD STRIP */}
      <div className="h-20 border-b border-white/5 bg-zinc-900/20 px-12 flex items-center justify-between sticky top-0 z-50 backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <ShieldAlert className="w-6 h-6 text-neon-pink" />
          <h1 className="font-display text-2xl uppercase italic tracking-tighter text-white">CEO Oversight Dashboard</h1>
        </div>
        <div className="flex gap-4">
          <Button variant="outline" onClick={fetchOversightData} className="border-white/10 text-[10px] font-black uppercase">Refresh Neural Link</Button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-12">
        <Tabs defaultValue="venues" className="space-y-12">
          <TabsList className="bg-zinc-900 border border-white/5 p-1 h-14 rounded-2xl">
            <TabsTrigger value="venues" className="px-8 rounded-xl data-[state=active]:bg-neon-blue data-[state=active]:text-black text-[10px] font-black uppercase tracking-widest transition-all">
              <Building2 className="w-4 h-4 mr-2" /> Venue Claims ({venueClaims.length})
            </TabsTrigger>
            <TabsTrigger value="talent" className="px-8 rounded-xl data-[state=active]:bg-neon-purple data-[state=active]:text-black text-[10px] font-black uppercase tracking-widest transition-all">
              <Users className="w-4 h-4 mr-2" /> Talent Verification ({pendingTalent.length})
            </TabsTrigger>
            <TabsTrigger value="business" className="px-8 rounded-xl data-[state=active]:bg-amber-500 data-[state=active]:text-black text-[10px] font-black uppercase tracking-widest transition-all">
              <ShieldCheck className="w-4 h-4 mr-2" /> Business Verification ({pendingBusiness.length})
            </TabsTrigger>
          </TabsList>

          {/* VENUE CLAIMS CONTENT */}
          <TabsContent value="venues" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {venueClaims.map((claim) => (
                <Card key={claim.id} className="bg-zinc-900/40 border-white/5 p-8 rounded-[2.5rem] flex flex-col justify-between">
                  <div>
                    <Badge className="bg-neon-blue/10 text-neon-blue border-neon-blue/20 mb-4 px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest">Pending Asset Claim</Badge>
                    <h3 className="text-3xl font-display italic text-white uppercase leading-none mb-2">{claim.venues?.name}</h3>
                    <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mb-6">{claim.venues?.location}</p>
                    
                    <div className="space-y-3 pt-6 border-t border-white/5">
                      <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest">Claimant Identity:</p>
                      <p className="text-white font-bold">{claim.profiles?.display_name || claim.profiles?.username}</p>
                    </div>
                  </div>

                  <div className="mt-12 flex gap-3">
                    {claim.instagram_handle && (
                      <Button asChild variant="outline" className="flex-1 h-12 rounded-xl border-white/10 bg-white/5 text-[9px] font-black uppercase">
                        <a href={`https://instagram.com/${claim.instagram_handle}`} target="_blank" rel="noreferrer"><Instagram className="w-3 h-3 mr-2 text-neon-pink" /> Verify IG</a>
                      </Button>
                    )}
                    <Button onClick={() => handleVenueApproval(claim.id, claim.venue_id, claim.user_id, true)} className="flex-1 h-12 rounded-xl bg-white text-black text-[9px] font-black uppercase"><CheckCircle className="w-3 h-3 mr-2" /> Approve</Button>
                    <Button onClick={() => handleVenueApproval(claim.id, claim.venue_id, claim.user_id, false)} variant="ghost" className="h-12 w-12 rounded-xl text-zinc-700 hover:text-red-500 transition-colors"><XCircle className="w-5 h-5" /></Button>
                  </div>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* TALENT CONTENT */}
          <TabsContent value="talent" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            {pendingTalent.length === 0 ? (
              <div className="text-center py-16 text-zinc-600 text-[10px] font-black uppercase tracking-[0.3em]">
                No pending talent applications.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {pendingTalent.map((app) => (
                  <Card key={app.id} className="bg-zinc-900/40 border-white/5 p-6 rounded-[2rem] text-center">
                    <div className="w-20 h-20 rounded-full mx-auto mb-4 border-2 border-neon-purple p-1">
                      <img
                        src={app.profiles?.avatar_url || "/placeholder.svg"}
                        className="w-full h-full rounded-full object-cover"
                      />
                    </div>
                    <h4 className="text-xl font-display italic text-white uppercase">
                      {app.profiles?.display_name || app.profiles?.username || "Unnamed Applicant"}
                    </h4>
                    <p className="text-[8px] text-zinc-500 font-black uppercase tracking-[0.3em] mb-6">
                      {app.profiles?.sub_role || "TALENT"}
                    </p>

                    {/* The applicant was told to DM this exact code to the brand
                        IG account. Check the inbox for it, sent from the handle
                        below, before approving. No automated gate: this is the
                        reviewer's evidence, the decision is still manual. */}
                    <div className="mb-3 rounded-lg border border-neon-green/20 bg-black/40 py-3">
                      <p className="text-[8px] text-zinc-600 font-black uppercase tracking-[0.3em]">
                        Expect DM Code
                      </p>
                      <p className="font-display text-2xl text-neon-green tracking-[0.25em] pl-[0.25em]">
                        {app.verification_code || "—"}
                      </p>
                      <p className="text-[8px] text-zinc-600 font-black uppercase tracking-[0.2em]">
                        from @{app.instagram_handle || "unknown"}
                      </p>
                    </div>

                    {app.instagram_handle && (
                      <Button
                        asChild
                        variant="outline"
                        className="w-full h-10 mb-3 rounded-lg border-white/10 bg-white/5 text-[9px] font-black uppercase"
                      >
                        <a
                          href={`https://instagram.com/${app.instagram_handle}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <Instagram className="w-3 h-3 mr-2 text-neon-pink" /> Verify IG
                        </a>
                      </Button>
                    )}

                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleTalentApproval(app.user_id, true)}
                        className="flex-1 bg-white text-black text-[9px] font-black uppercase rounded-lg h-10"
                      >
                        Verify
                      </Button>
                      <Button
                        onClick={() => handleTalentApproval(app.user_id, false)}
                        variant="ghost"
                        className="text-zinc-700 hover:text-red-500"
                      >
                        Reject
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* BUSINESS VERIFICATION CONTENT */}
          <TabsContent value="business" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            {pendingBusiness.length === 0 ? (
              <div className="text-center py-16 text-zinc-600 text-[10px] font-black uppercase tracking-[0.3em]">
                No pending business verifications.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {pendingBusiness.map((app) => (
                  <Card key={app.id} className="bg-zinc-900/40 border-white/5 p-8 rounded-[2.5rem] flex flex-col justify-between">
                    <div>
                      <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20 mb-4 px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest">
                        Pending Tier 2
                      </Badge>
                      <h3 className="text-3xl font-display italic text-white uppercase leading-none mb-2">
                        {app.venues?.name || "Unknown Venue"}
                      </h3>
                      <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mb-6">
                        {app.venues?.location}
                      </p>

                      <div className="space-y-3 pt-6 border-t border-white/5">
                        <div>
                          <p className="text-[8px] text-zinc-600 font-black uppercase tracking-widest">Registered Name</p>
                          <p className="text-white font-bold">{app.legal_name}</p>
                        </div>
                        <div>
                          <p className="text-[8px] text-zinc-600 font-black uppercase tracking-widest">Business Email</p>
                          <p className="text-white font-bold break-all">{app.business_email}</p>
                        </div>
                        <div>
                          <p className="text-[8px] text-zinc-600 font-black uppercase tracking-widest">Business Phone</p>
                          <p className="text-white font-bold">{app.business_phone}</p>
                        </div>
                        <div>
                          <p className="text-[8px] text-zinc-600 font-black uppercase tracking-widest">Position</p>
                          <p className="text-white font-bold">{app.position_title}</p>
                        </div>
                        <div>
                          <p className="text-[8px] text-zinc-600 font-black uppercase tracking-widest">Filed By</p>
                          <p className="text-white font-bold">
                            {app.profiles?.display_name || app.profiles?.username || "Unknown"}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-12 flex gap-3">
                      <Button
                        onClick={() => handleBusinessApproval(app.venue_id, true)}
                        className="flex-1 h-12 rounded-xl bg-white text-black text-[9px] font-black uppercase"
                      >
                        <CheckCircle className="w-3 h-3 mr-2" /> Verify
                      </Button>
                      <Button
                        onClick={() => handleBusinessApproval(app.venue_id, false)}
                        variant="ghost"
                        className="h-12 w-12 rounded-xl text-zinc-700 hover:text-red-500 transition-colors"
                      >
                        <XCircle className="w-5 h-5" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default CEODashboard;
