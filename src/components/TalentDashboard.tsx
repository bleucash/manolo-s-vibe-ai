import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DollarSign, Link2, Building2, TrendingUp, Mail, Zap, Check } from "lucide-react";
import { toast } from "sonner";

interface TalentDashboardProps {
  userId: string;
  avatarUrl?: string;
  displayName?: string;
}

const TalentDashboard = ({ userId }: TalentDashboardProps) => {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({ totalSold: 0, scannedCount: 0, grossSales: 0 });
  const [activeAffiliations, setActiveAffiliations] = useState<any[]>([]);
  const [incomingInvites, setIncomingInvites] = useState<any[]>([]);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [currentVenueId, setCurrentVenueId] = useState<string | null>(null);
  const [togglingActive, setTogglingActive] = useState(false);

  // Static 10% commission calculation
  const availableBalance = metrics.grossSales * 0.1;

  useEffect(() => {
    if (userId) {
      fetchData();

      // ✅ REAL-TIME METRICS: Listen for ticket updates for this promoter
      const channel = supabase
        .channel(`talent-metrics-${userId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "tickets", filter: `promoter_id=eq.${userId}` },
          () => fetchData(),
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [userId]);

  const fetchData = async () => {
    try {
      // 1. Fetch Sales Metrics
      const { data: tickets } = await supabase.from("tickets").select("status, price_paid").eq("promoter_id", userId);

      if (tickets) {
        setMetrics({
          totalSold: tickets.length,
          scannedCount: tickets.filter((t) => t.status === "Scanned").length,
          grossSales: tickets.reduce((sum, t) => sum + (t.price_paid || 0), 0),
        });
      }

      // 2. Fetch Connections
      const { data: connections, error } = await supabase
        .from("venue_staff")
        .select(`*, venues (name, location)`)
        .eq("user_id", userId);

      if (!error && connections) {
        setActiveAffiliations(connections.filter((c) => c.status === "active"));
        setIncomingInvites(connections.filter((c) => c.status === "pending_talent_action"));
      }

      // 3. Fetch Active Status
      await fetchActiveStatus();
    } catch (err) {
      // Neural logging handled by error boundary
    } finally {
      setLoading(false);
    }
  };

  const handleResponse = async (id: string, accept: boolean) => {
    setProcessingIds((prev) => new Set(prev).add(id));
    try {
      const { error } = await supabase
        .from("venue_staff")
        .update({ status: accept ? "active" : "ignored" })
        .eq("id", id)
        .eq("user_id", userId);

      if (error) throw error;
      toast.success(accept ? "Neural Link Established" : "Invitation Dismissed");
      await fetchData();
    } catch (err: any) {
      toast.error("Handshake Failed");
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleCopyLink = async () => {
    const referralLink = `${window.location.origin}/auth?ref=${userId}`;
    await navigator.clipboard.writeText(referralLink);
    setCopied(true);
    toast.success("Referral ID Copied");
    setTimeout(() => setCopied(false), 2000);
  };

  // Fetch talent active status
  const fetchActiveStatus = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("is_active, current_venue_id")
        .eq("id", userId)
        .single();

      if (error) throw error;
      setIsActive(data?.is_active || false);
      setCurrentVenueId(data?.current_venue_id || null);
    } catch (err) {
      console.error("Error fetching active status:", err);
    }
  };

  // Toggle talent active status
  const handleToggleActive = async (venueId?: string) => {
    if (togglingActive) return;

    setTogglingActive(true);
    const newActiveState = !isActive;

    // If activating, must have a venue selected
    if (newActiveState && !venueId) {
      toast.error("Select a venue to go active");
      setTogglingActive(false);
      return;
    }

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          is_active: newActiveState,
          current_venue_id: newActiveState ? venueId : null,
          active_at: newActiveState ? new Date().toISOString() : null,
        })
        .eq("id", userId);

      if (error) throw error;

      setIsActive(newActiveState);
      setCurrentVenueId(newActiveState ? venueId || null : null);

      const venueName = activeAffiliations.find((a) => a.venue_id === venueId)?.venues?.name;
      toast.success(newActiveState ? `Now active at ${venueName || "venue"}` : "Status set to inactive");
    } catch (err) {
      console.error("Error toggling active status:", err);
      toast.error("Failed to update active status");
    } finally {
      setTogglingActive(false);
    }
  };

  if (loading) return null;

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* GO ACTIVE SECTION */}
      <Card className="bg-zinc-900/20 border-white/5 overflow-hidden">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Zap
                className={`w-4 h-4 ${isActive ? "text-neon-green fill-neon-green animate-pulse" : "text-zinc-600"}`}
              />
              <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Active Status</span>
            </div>
            {isActive && currentVenueId && (
              <Badge className="bg-neon-green/10 text-neon-green border-neon-green/30 text-[9px] font-black uppercase tracking-widest">
                Active
              </Badge>
            )}
          </div>

          {isActive && currentVenueId ? (
            // Currently Active - Show where and deactivate button
            <div className="space-y-3">
              <div className="p-4 bg-black/40 rounded-lg border border-neon-green/20">
                <p className="text-[10px] text-zinc-500 uppercase font-black tracking-widest mb-1">Active At</p>
                <p className="text-white font-bold">
                  {activeAffiliations.find((a) => a.venue_id === currentVenueId)?.venues?.name || "Venue"}
                </p>
              </div>
              <Button
                onClick={() => handleToggleActive()}
                disabled={togglingActive}
                className="w-full bg-zinc-900/50 border-white/5 text-zinc-400 hover:bg-zinc-800 font-black uppercase tracking-widest text-[10px]"
                variant="outline"
              >
                {togglingActive ? "Updating..." : "Deactivate"}
              </Button>
            </div>
          ) : (
            // Not Active - Show venue selector and activate button
            <div className="space-y-3">
              {activeAffiliations.length === 0 ? (
                <p className="text-sm text-zinc-500">
                  No active venue connections. Accept venue invites below to get started.
                </p>
              ) : (
                <>
                  <p className="text-[10px] text-zinc-500 uppercase font-black tracking-widest mb-2">Select Venue</p>
                  <div className="grid gap-2">
                    {activeAffiliations.map((affiliation) => (
                      <Button
                        key={affiliation.id}
                        onClick={() => handleToggleActive(affiliation.venue_id)}
                        disabled={togglingActive}
                        className="w-full justify-start h-auto p-4 bg-neon-green/5 border-neon-green/20 text-white hover:bg-neon-green/10 font-bold"
                        variant="outline"
                      >
                        <Building2 className="w-4 h-4 mr-3 text-neon-green" />
                        <div className="text-left">
                          <p className="font-bold">{affiliation.venues?.name}</p>
                          {affiliation.venues?.location && (
                            <p className="text-xs text-zinc-500">{affiliation.venues.location}</p>
                          )}
                        </div>
                      </Button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* PERFORMANCE METRICS */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="bg-zinc-900/20 border-white/5 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-neon-blue opacity-50" />
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-3 h-3 text-neon-blue" />
              <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Efficiency</span>
            </div>
            <p className="text-4xl font-display text-white italic tracking-tighter">{metrics.scannedCount}</p>
            <div className="flex items-center gap-1 mt-1">
              <span className="text-[10px] text-white font-bold">{metrics.totalSold}</span>
              <span className="text-[10px] text-zinc-600 uppercase font-black">Sold</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/20 border-white/5 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-neon-green opacity-50" />
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <DollarSign className="w-3 h-3 text-neon-green" />
              <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Yield</span>
            </div>
            <p className="text-4xl font-display text-neon-green italic tracking-tighter">
              ${availableBalance.toFixed(0)}
            </p>
            <p className="text-[10px] text-zinc-600 mt-1 uppercase font-black tracking-widest">10% Commission</p>
          </CardContent>
        </Card>
      </div>

      {/* REFERRAL LINK HUB */}
      <div className="p-1 bg-gradient-to-r from-neon-blue/20 to-transparent rounded-2xl">
        <div className="flex items-center gap-3 p-4 bg-black rounded-[14px] border border-white/5">
          <Zap className="w-4 h-4 text-neon-blue fill-neon-blue animate-pulse" />
          <div className="flex-1 overflow-hidden">
            <p className="text-[8px] text-zinc-500 uppercase font-black tracking-widest mb-0.5">
              Your Neural Referral ID
            </p>
            <p className="text-[11px] font-mono text-white truncate">{userId.slice(0, 12)}...</p>
          </div>
          <Button
            onClick={handleCopyLink}
            size="sm"
            className={`h-9 px-5 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all ${
              copied ? "bg-neon-green text-black" : "bg-white text-black hover:bg-zinc-200"
            }`}
          >
            {copied ? <Check className="w-3 h-3" /> : "Copy"}
          </Button>
        </div>
      </div>

      {/* INCOMING REQUESTS */}
      {incomingInvites.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-[10px] font-black text-amber-500 uppercase tracking-[0.4em] px-1 flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-ping" />
            Pending Neural Handshakes
          </h3>
          {incomingInvites.map((inv) => (
            <div key={inv.id} className="p-6 rounded-3xl bg-amber-500/5 border border-amber-500/20 backdrop-blur-xl">
              <div className="flex items-center gap-5 mb-6">
                <div className="w-14 h-14 rounded-2xl bg-amber-500/10 flex items-center justify-center border border-amber-500/10">
                  <Mail className="w-6 h-6 text-amber-500" />
                </div>
                <div>
                  <p className="text-lg font-display text-white uppercase italic tracking-tight">{inv.venues?.name}</p>
                  <p className="text-[10px] text-zinc-500 uppercase font-black tracking-widest">
                    {inv.venues?.location}
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <Button
                  className="flex-1 bg-white text-black font-black uppercase text-[10px] h-12 rounded-2xl hover:bg-neon-green hover:text-black transition-all"
                  onClick={() => handleResponse(inv.id, true)}
                  disabled={processingIds.has(inv.id)}
                >
                  Accept Connection
                </Button>
                <Button
                  variant="ghost"
                  className="px-6 border border-white/5 text-zinc-600 font-black uppercase text-[10px] h-12 rounded-2xl"
                  onClick={() => handleResponse(inv.id, false)}
                  disabled={processingIds.has(inv.id)}
                >
                  Ignore
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ACTIVE VENUES */}
      <div className="space-y-4">
        <h3 className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.4em] px-1">Synchronized Venues</h3>
        {activeAffiliations.length > 0 ? (
          activeAffiliations.map((aff) => (
            <div
              key={aff.id}
              className="p-5 rounded-[2rem] bg-zinc-900/30 border border-white/5 flex items-center justify-between group hover:border-neon-blue/40 transition-all shadow-2xl"
            >
              <div className="flex items-center gap-5">
                <div className="w-14 h-14 rounded-2xl bg-black border border-white/5 flex items-center justify-center group-hover:bg-neon-blue/5 transition-colors">
                  <Building2 className="w-6 h-6 text-zinc-800 group-hover:text-neon-blue transition-colors" />
                </div>
                <div>
                  <p className="text-base font-display text-white uppercase italic tracking-tight group-hover:text-neon-blue transition-colors">
                    {aff.venues?.name}
                  </p>
                  <p className="text-[9px] text-zinc-600 font-black uppercase tracking-widest">
                    {aff.venues?.location}
                  </p>
                </div>
              </div>
              <Badge className="bg-neon-blue/10 text-neon-blue border-neon-blue/20 text-[8px] font-black px-4 py-1.5 uppercase tracking-[0.2em] rounded-full">
                Linked
              </Badge>
            </div>
          ))
        ) : (
          <div className="p-16 text-center border border-dashed border-zinc-900 rounded-[3rem] bg-zinc-900/10">
            <p className="text-[9px] text-zinc-800 font-black uppercase tracking-[0.5em]">
              Zero Active Neural Connections
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TalentDashboard;
