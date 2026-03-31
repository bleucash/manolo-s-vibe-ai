import { ShieldCheck, ArrowLeft, Loader2, Instagram, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useUserMode } from "@/contexts/UserModeContext";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface TalentGuardProps {
  children: React.ReactNode;
}

export const TalentGuard = ({ children }: TalentGuardProps) => {
  const navigate = useNavigate();
  const { session } = useUserMode();
  const [loading, setLoading] = useState(true);
  const [isVerified, setIsVerified] = useState(false);

  useEffect(() => {
    const checkVerification = async () => {
      if (!session?.user?.id) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("is_verified_talent")
        .eq("id", session.user.id)
        .single();

      if (data) {
        setIsVerified(data.is_verified_talent);
      }
      setLoading(false);
    };

    checkVerification();
  }, [session]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-black">
        <Loader2 className="w-8 h-8 text-neon-purple animate-spin" />
      </div>
    );
  }

  // ✅ THE SECURITY GATE
  if (!isVerified) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-black px-12 text-center animate-in fade-in duration-700">
        <div className="w-20 h-20 bg-neon-purple/10 rounded-[2.5rem] flex items-center justify-center mb-8 shadow-[0_0_50px_rgba(191,0,255,0.1)]">
          <ShieldCheck className="w-10 h-10 text-neon-purple" />
        </div>
        
        <h2 className="font-display text-3xl text-white uppercase italic tracking-tighter leading-none">
          Identity Verification Required
        </h2>
        
        <div className="mt-6 space-y-4 max-w-sm">
          <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.2em] leading-relaxed">
            Talent professional tools are locked until your identity is verified.
          </p>
          <p className="text-zinc-600 text-[9px] font-bold uppercase tracking-widest leading-relaxed border-t border-white/5 pt-4">
            Link your professional Instagram in your profile settings to initiate the Neural Handshake.
          </p>
        </div>

        <div className="mt-12 flex flex-col gap-4 w-full max-w-xs">
          <Button 
            onClick={() => navigate('/profile')}
            className="h-16 bg-white text-black font-black uppercase text-[10px] tracking-widest rounded-2xl hover:bg-neon-purple transition-all"
          >
            Go to Profile Settings
          </Button>
          
          <Button 
            variant="ghost"
            onClick={() => navigate(-1)}
            className="text-zinc-500 uppercase text-[9px] font-black tracking-widest"
          >
            <ArrowLeft className="w-3 h-3 mr-2" /> Back
          </Button>
        </div>
      </div>
    );
  }

  // If verified, render the Talent Dashboard
  return <>{children}</>;
};
