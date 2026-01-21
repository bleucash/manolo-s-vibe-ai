import { useUserMode } from "@/contexts/UserModeContext";
import { ShieldX } from "lucide-react"; // Removed Loader2
import TalentDashboard from "@/components/TalentDashboard";

const Gigs = () => {
  const { isTalent, isLoading, session } = useUserMode();

  // ✅ UNIFIED LOADING STRATEGY
  // We return null so the ProtectedRoute's "Neural Engine" stays visible
  // until the session and talent status are fully synchronized.
  if (isLoading) {
    return null;
  }

  // ✅ BRANDED ACCESS DENIED
  if (!isTalent)
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-black p-6 animate-in fade-in duration-500">
        <div className="relative mb-6">
          <div className="absolute inset-0 blur-2xl bg-red-500/20 rounded-full animate-pulse" />
          <ShieldX className="w-16 h-16 text-red-500 relative z-10" />
        </div>
        <h1 className="text-white font-display text-3xl tracking-tighter uppercase italic">Access Denied</h1>
        <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em] mt-2">
          Verified Talent Credentials Required
        </p>
      </div>
    );

  return (
    <div className="min-h-screen bg-background p-4 pb-24 animate-in fade-in duration-700">
      {/* HEADER SECTION */}
      <div className="mb-6 px-2 pt-4">
        <h2 className="text-[10px] font-black text-neon-purple uppercase tracking-[0.4em] mb-1">Performance Engine</h2>
        <h1 className="text-4xl font-display text-white uppercase tracking-tighter italic">Active Gigs</h1>
      </div>

      <TalentDashboard userId={session?.user?.id || ""} />
    </div>
  );
};

export default Gigs;
