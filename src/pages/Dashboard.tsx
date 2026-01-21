import { useUserMode } from "@/contexts/UserModeContext";
import { ShieldX } from "lucide-react"; // Loader2 removed
import ManagerDashboard from "@/components/ManagerDashboard";

const Dashboard = () => {
  const { isManager, isLoading } = useUserMode();

  // ✅ UNIFIED LOADING STRATEGY
  // By returning null, we keep the Master Loader (Neural Engine)
  // active. This prevents the "small green circle" flicker.
  if (isLoading) {
    return null;
  }

  // ✅ BRANDED ACCESS DENIED
  if (!isManager)
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-black p-6 animate-in fade-in duration-500">
        <div className="relative mb-6">
          {/* Red Glow for Security Warning */}
          <div className="absolute inset-0 blur-2xl bg-red-500/20 rounded-full animate-pulse" />
          <ShieldX className="w-16 h-16 text-red-500 relative z-10" />
        </div>
        <h1 className="text-white font-display text-3xl tracking-tighter uppercase italic">Access Denied</h1>
        <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em] mt-2">
          Managerial Clearance Required
        </p>
      </div>
    );

  // Once authorized, we render the Dashboard.
  // Note: We already added the fade-in duration-700 inside the ManagerDashboard rewrite.
  return <ManagerDashboard />;
};

export default Dashboard;
