import { useUserMode } from "@/contexts/UserModeContext";
import { ShieldX } from "lucide-react";
import TalentDashboard from "@/components/TalentDashboard";

const Gigs = () => {
  const { isTalent, isLoading, session } = useUserMode();

  /**
   * ✅ OPTIMIZED RENDERING
   * The ProtectedRoute now handles the global LoadingState.
   * If we reach this point and isLoading is still true, we stay silent
   * to allow the parent guard to finish its handshake.
   */
  if (isLoading) {
    return null;
  }

  /**
   * ✅ BRANDED ACCESS DENIED
   * This only triggers if the sync is complete and the user
   * is definitely not authorized as Talent.
   */
  if (!isTalent) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-black p-6 animate-in fade-in duration-500">
        <div className="relative mb-6">
          <div className="absolute inset-0 blur-2xl bg-red-500/20 rounded-full animate-pulse" />
          <ShieldX className="w-16 h-16 text-red-500 relative z-10" />
        </div>
        <h1 className="text-white font-display text-3xl tracking-tighter uppercase italic text-center">
          Access Denied
        </h1>
        <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em] mt-2 text-center">
          Verified Talent Credentials Required
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black p-4 pb-24 animate-in fade-in duration-700">
      {/* HEADER SECTION - 2026 Neural Aesthetic */}
      <div className="mb-8 px-2 pt-6">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-2 h-2 bg-neon-purple rounded-full shadow-[0_0_8px_#BF00FF]" />
          <h2 className="text-[10px] font-black text-neon-purple uppercase tracking-[0.4em]">Performance Engine</h2>
        </div>
        <h1 className="text-5xl font-display text-white uppercase tracking-tighter italic leading-none">Active Gigs</h1>
      </div>

      {/* Main Dashboard Logic */}
      <TalentDashboard userId={session?.user?.id || ""} />
    </div>
  );
};

export default Gigs;
