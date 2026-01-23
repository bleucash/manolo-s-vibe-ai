import { useUserMode } from "@/contexts/UserModeContext";
import { ShieldX, LayoutDashboard } from "lucide-react";
import ManagerDashboard from "@/components/ManagerDashboard";

const Dashboard = () => {
  const { isManager, isLoading, session } = useUserMode();

  /**
   * ✅ UNIFIED LOADING STRATEGY
   * We yield to the ProtectedRoute's LoadingState.
   * This prevents the component from mounting with partial data
   * and accidentally triggering a "not authorized" state.
   */
  if (isLoading) {
    return null;
  }

  /**
   * ✅ BRANDED ACCESS DENIED
   * Triggered only if the context sync is 100% complete and
   * the user is verified to NOT be a Manager.
   */
  if (!isManager) {
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
          Managerial Authorization Required
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black p-4 pb-24 animate-in fade-in duration-700">
      {/* HEADER SECTION - 2026 Managerial Aesthetic */}
      <div className="mb-8 px-2 pt-6">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-2 h-2 bg-neon-green rounded-full shadow-[0_0_8px_#39FF14]" />
          <h2 className="text-[10px] font-black text-neon-green uppercase tracking-[0.4em]">Command Center</h2>
        </div>
        <h1 className="text-5xl font-display text-white uppercase tracking-tighter italic leading-none">Dashboard</h1>
      </div>

      {/* Main Manager Logic */}
      <ManagerDashboard userId={session?.user?.id || ""} />
    </div>
  );
};

export default Dashboard;
