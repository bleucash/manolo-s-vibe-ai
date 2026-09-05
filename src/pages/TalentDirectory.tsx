import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Search, ArrowLeft, Sparkles, User, TrendingUp, Send } from "lucide-react";
import { toast } from "sonner";
import { guestFacingLabel, isOperationalPosition } from "@/config/positions";
import { useUserMode } from "@/contexts/UserModeContext";
import { InviteTalentModal } from "@/components/InviteTalentModal";

interface TalentProfile {
  id: string;
  // profiles.username is nullable in the database. This said `string`, which
  // was simply wrong — a hand-written shape claiming a guarantee the schema
  // does not make. Both render sites already fall back
  // (`display_name || username`), so correcting the type costs nothing and
  // stops the next reader from trusting it.
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  role_type: string;
  sub_role: string | null;
}

const TalentDirectory = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [talent, setTalent] = useState<TalentProfile[]>([]);
  const [loading, setLoading] = useState(true);

  // Invites need a manager AND a venue to invite into. activeVenueId is the
  // venue the invite lands on, so without one there is nothing to send.
  const { isManager, activeVenueId } = useUserMode();
  const canInvite = isManager && !!activeVenueId;
  const [inviteTarget, setInviteTarget] = useState<any>(null);

  useEffect(() => {
    fetchTalent();
  }, []);

  const fetchTalent = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, role_type, sub_role")
        .eq("role_type", "talent")
        .order("username", { ascending: true });

      if (error) throw error;

      setTalent(data || []);
    } catch (error) {
      console.error(error);
      toast.error("Directory sync failed");
    } finally {
      setLoading(false);
    }
  };

  const filteredTalent = talent
    // Operational positions never appear in the directory at all.
    .filter((t) => !isOperationalPosition(t.sub_role))
    .filter((t) => {
      const searchLower = searchTerm.toLowerCase();
      const name = (t.display_name || t.username || "").toLowerCase();
      // Search the displayed label, not the stored value, so typing "bottle"
      // matches "Bottle Girl" as shown rather than only the raw bottle_girl.
      const role = (guestFacingLabel(t.sub_role) || t.role_type || "").toLowerCase();
      return name.includes(searchLower) || role.includes(searchLower);
    });

  if (loading)
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-neon-pink" />
      </div>
    );

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* STICKY HEADER */}
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur-md border-b border-white/10">
        <div className="px-4 py-4 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/discovery")}
            className="text-zinc-400 hover:text-white bg-white/5 rounded-full"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-2xl font-display text-white tracking-tighter uppercase flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-neon-pink" />
            Spotlight Directory
          </h1>
        </div>

        <div className="px-4 pb-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
            <Input
              placeholder="Search DJ, Dancer, Host..."
              className="pl-11 bg-zinc-900/50 border-white/10 text-white rounded-xl h-12"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* TALENT GRID */}
      <div className="px-4 py-6">
        {filteredTalent.length === 0 ? (
          <div className="text-center py-24">
            <User className="w-12 h-12 text-zinc-800 mx-auto mb-4" />
            <p className="text-zinc-500">No matches found.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
            {filteredTalent.map((t) => (
              <div key={t.id} className="relative cursor-pointer group" onClick={() => navigate(`/talent/${t.id}`)}>
                <div className="aspect-[3/4.5] rounded-2xl overflow-hidden relative transition-all duration-500 border border-white/10">
                  <img
                    src={t.avatar_url || "https://github.com/shadcn.png"}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/10 to-transparent" />

                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    <h3 className="text-white font-display text-lg leading-none truncate tracking-tight">
                      {t.display_name || t.username}
                    </h3>
                    {/* The real position, always. This used to read "Top
                        Talent" for array indices 0, 3 and 7. That was a
                        placeholder standing in for the charge system, which
                        never got wired, so the glow and the badge claimed an
                        engagement signal that was really just sort order, and
                        hid the person's actual position to do it. Removed
                        2026-09-05 rather than deferred: a false claim to
                        guests is worse than an absent feature. The real
                        version returns when charges exist. */}
                    <p className="text-neon-pink text-[10px] font-bold uppercase tracking-widest mt-2">
                      {guestFacingLabel(t.sub_role) || "Talent"}
                    </p>
                  </div>

                  {/* Manager-only. The directory was guest-only before: no
                      user context at all, every card going to the public
                      profile. stopPropagation so inviting does not also
                      navigate away to that profile. */}
                  {canInvite && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setInviteTarget(t);
                      }}
                      className="absolute top-3 left-3 z-10 h-8 px-3 rounded-full bg-black/70 backdrop-blur-md border border-amber-500/40 text-amber-500 text-[8px] font-black uppercase tracking-widest flex items-center gap-1.5 hover:bg-amber-500 hover:text-black transition-all"
                    >
                      <Send className="w-3 h-3" /> Invite
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <InviteTalentModal
        talent={inviteTarget}
        isOpen={!!inviteTarget}
        onClose={() => setInviteTarget(null)}
      />
    </div>
  );
};

export default TalentDirectory;
