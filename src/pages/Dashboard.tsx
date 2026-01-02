import { useUserMode } from "@/contexts/UserModeContext";
import { Loader2, ShieldX } from "lucide-react";
import ManagerDashboard from "@/components/ManagerDashboard";

const Dashboard = () => {
  const { isManager, isLoading } = useUserMode();

  if (isLoading)
    return (
      <div className="h-screen flex items-center justify-center bg-black">
        <Loader2 className="animate-spin text-neon-green w-10 h-10" />
      </div>
    );

  if (!isManager)
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-black p-6">
        <ShieldX className="w-16 h-16 text-red-500 mb-4" />
        <h1 className="text-white font-display text-2xl tracking-tighter">ACCESS DENIED</h1>
      </div>
    );

  return <ManagerDashboard />;
};

export default Dashboard;
