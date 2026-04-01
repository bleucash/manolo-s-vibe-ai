import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserMode } from "@/contexts/UserModeContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Instagram, Zap, ShieldCheck, Loader2, Video, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { InteractiveHeroReel } from "@/components/InteractiveHeroReel";

const TalentManage = () => {
  const navigate = useNavigate();
  const { session, mode, setMode, isTalent, isManager } = useUserMode();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<any>(null);

  // Form State
  const [displayName, setDisplayName] = useState("");
  const [subRole, setSubRole] = useState("");
  const [bio, setBio] = useState("");
  const [instagram, setInstagram] = useState("");

  useEffect(() => {
    fetchProfile();
  }, [session]);

  const fetchProfile = async () => {
    if (!session?.user?.id) return;
    const { data } = await supabase.from("profiles").select("*").eq("id", session.user.id).single();
    if (data) {
      setProfile(data);
      setDisplayName(data.display_name || "");
      setSubRole(data.sub_role || "");
      setBio(data.bio || "");
      // Extract IG username if it exists in a 'metadata' or 'instagram' field 
      // (Assuming we store the handle for the handshake)
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          display_name: displayName,
          sub_role: subRole,
          bio: bio,
        })
        .eq("id", session?.user?.id);

      if (error) throw error;
      toast.success("Vibe Updated");
    } catch (err) {
      toast.error("Update Failed");
    } finally {
      setSaving(false);
    }
  };

  const initiateHandshake = async () => {
    if (!instagram.includes("@")) {
      toast.error("Enter a valid @handle");
      return;
    }
    // Logic to store the IG handle in a 'talent_claims' or similar verification table
    toast.success("Handshake Initiated", {
      description: "Admin will verify your IG profile shortly."
    });
  };

  const toggleUserMode = () => {
    if (mode === "guest") {
      if (isTalent) {
        setMode("talent");
        toast.success("Talent Mode Initialized");
      } else if (isManager) {
        setMode("manager");
        toast.success("Manager Control Active");
      } else {
        toast.error("Verified Role Required", {
          description: "Complete onboarding to unlock business tools."
        });
      }
    } else {
      setMode("guest");
      toast.success("Guest Mode Active");
      navigate("/profile");
    }
  };

  if (loading) return null;
  if (!profile) return null; // Guard against null profile

  return (
    <div className="min-h-screen bg-black pb-40 animate-in fade-in duration-700">
      {/* 1. HUD HEADER */}
      <div className="px-8 pt-8 flex items-center justify-between mb-8">
        {/* Mode Switcher */}
        <div className="flex flex-col gap-2">
          <span className="text-[8px] font-black text-white/40 uppercase tracking-[0.3em] ml-1">
            Neural Link
          </span>
          <button
            onClick={toggleUserMode}
            className={cn(
              "h-10 w-36 rounded-full border backdrop-blur-xl transition-all duration-500 flex items-center px-1 relative overflow-hidden",
              mode !== "guest"
                ? "bg-neon-green/10 border-neon-green/30 shadow-[0_0_20px_rgba(57,255,20,0.15)]"
                : "bg-white/5 border-white/10"
            )}
          >
            <div
              className={cn(
                "w-8 h-8 rounded-full shadow-2xl transform transition-all duration-500 ease-spring z-10 flex items-center justify-center",
                mode !== "guest" ? "translate-x-[96px] bg-neon-green" : "translate-x-0 bg-white"
              )}
            >
              <Zap className="w-4 h-4 text-black" />
            </div>
            <span
              className={cn(
                "absolute w-full text-center text-[9px] font-black uppercase tracking-widest transition-colors",
                mode !== "guest" ? "text-neon-green pr-8" : "text-white pl-8"
              )}
            >
              {mode}
            </span>
          </button>
        </div>
        <div className="w-10" />
      </div>

      {/* 2. HERO REEL EDITOR (The Vibe Layer) */}
      <div className="px-8 mb-12">
        <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-4 flex items-center gap-2">
          <Video className="w-3 h-3 text-neon-purple" /> Cinematic Hero Reel
        </h3>
        <div className="aspect-[9/16] w-full max-w-[300px] mx-auto rounded-[2.5rem] overflow-hidden border border-white/10 relative">
          <InteractiveHeroReel
            entityId={profile.id}
            entityType="talent"
            currentReelUrl={profile.hero_reel_url}
            isOwner={true}
          />
        </div>
      </div>

      {/* 3. VERIFICATION MOAT (The IG Handshake) */}
      {!profile.is_verified_talent && (
        <div className="px-8 mb-12">
          <div className="bg-neon-purple/5 border border-neon-purple/20 rounded-[2rem] p-8 space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-neon-purple/20 rounded-xl flex items-center justify-center">
                <Instagram className="w-6 h-6 text-neon-purple" />
              </div>
              <div>
                <p className="text-white font-display text-xl uppercase italic leading-none">IG Handshake</p>
                <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest mt-1">Proof of Identity</p>
              </div>
            </div>
            
            <div className="flex gap-2">
              <Input 
                value={instagram}
                onChange={(e) => setInstagram(e.target.value)}
                placeholder="@username"
                className="bg-black border-white/10 text-white rounded-xl h-12 font-bold"
              />
              <Button onClick={initiateHandshake} className="bg-white text-black font-black uppercase text-[10px] px-6 rounded-xl">
                Verify
              </Button>
            </div>
            <p className="text-[8px] text-zinc-600 font-bold uppercase tracking-widest leading-relaxed">
              *Verification unlocks Gigs, Secure Entry, and Payout sectors.
            </p>
          </div>
        </div>
      )}

      {/* 4. IDENTITY SETTINGS */}
      <div className="px-8 space-y-8">
        <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Public Intel</h3>
        
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-zinc-600 uppercase ml-4">Professional Name</label>
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="bg-zinc-900/40 border-white/5 h-14 rounded-2xl text-white font-bold" />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-zinc-600 uppercase ml-4">Primary Role</label>
            <Input value={subRole} onChange={(e) => setSubRole(e.target.value)} placeholder="e.g. Lead Dancer" className="bg-zinc-900/40 border-white/5 h-14 rounded-2xl text-white font-bold" />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-zinc-600 uppercase ml-4">Transmission (Bio)</label>
            <Textarea value={bio} onChange={(e) => setBio(e.target.value)} className="bg-zinc-900/40 border-white/5 rounded-2xl text-white min-h-[120px]" />
          </div>
        </div>

        <Button 
          onClick={handleSave} 
          disabled={saving}
          className="w-full h-20 bg-neon-purple text-white font-black uppercase tracking-[0.2em] rounded-[2rem] shadow-[0_0_30px_rgba(191,0,255,0.2)]"
        >
          {saving ? <Loader2 className="animate-spin" /> : <><Zap className="w-5 h-5 mr-3" /> Commit Changes</>}
        </Button>
      </div>
    </div>
  );
};

export default TalentManage;
