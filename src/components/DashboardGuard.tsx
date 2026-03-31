import { ShieldCheck, ArrowLeft, Loader2, Instagram } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useVenueStatus } from "@/hooks/useVenueStatus";

interface DashboardGuardProps {
  venueId: string;
  children: React.ReactNode;
}

export const DashboardGuard = ({ venueId, children }: DashboardGuardProps) => {
  const navigate = useNavigate();
  const { isOwner, hasPendingClaim, loading } = useVenueStatus(venueId);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-black">
        <Loader2 className="w-8 h-8 text-neon-blue animate-spin" />
      </div>
    );
  }

  // ✅ THE SECURITY GATE
  // If they have a pending claim but are NOT the official owner yet, block access.
  if (hasPendingClaim && !isOwner) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-black px-12 text-center animate-in fade-in duration-700">
        <div className="w-20 h-20 bg-neon-blue/10 rounded-[2rem] flex items-center justify-center mb-8 shadow-[0_0_50px_rgba(0,183,255,0.1)]">
          <ShieldCheck className="w-10 h-10 text-neon-blue" />
        </div>
        
        <h2 className="font-display text-3xl text-white uppercase italic tracking-tighter leading-none">
          Neural Link: Pending
        </h2>
        
        <div className="mt-6 space-y-4 max-w-sm">
          <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.2em] leading-relaxed">
            Your IG Handshake for this sector is currently under review. 
          </p>
          <p className="text-zinc-600 text-[9px] font-bold uppercase tracking-widest leading-relaxed border-t border-white/5 pt-4">
            Financial Systems, Staffing Rosters, and Secure Entry tools remain locked until identity is verified by an Admin.
          </p>
        </div>

        <div className="mt-12 flex flex-col gap-4 w-full max-w-xs">
          <Button 
            onClick={() => navigate(-1)}
            className="h-16 bg-white text-black font-black uppercase text-[10px] tracking-widest rounded-2xl hover:bg-neon-blue transition-all"
          >
            <ArrowLeft className="w-4 h-4 mr-2" /> Return to Profile
          </Button>
          
          <div className="flex items-center justify-center gap-2 opacity-40">
            <Instagram className="w-3 h-3 text-neon-pink" />
            <span className="text-[8px] font-black text-white uppercase tracking-widest">Verification via Instagram</span>
          </div>
        </div>
      </div>
    );
  }

  // If they are the owner (verified), let them in.
  if (isOwner) {
    return <>{children}</>;
  }

  // If they have no business here at all, kick them to discovery.
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-black text-white">
      <p className="text-[10px] font-black uppercase tracking-[0.4em]">Access Denied</p>
      <Button onClick={() => navigate("/discovery")} variant="ghost" className="mt-4 text-zinc-500 uppercase text-[10px] font-black">
        Exit to Discovery
      </Button>
    </div>
  );
};
