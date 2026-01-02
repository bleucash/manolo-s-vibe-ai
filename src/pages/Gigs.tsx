import { useUserMode } from "@/contexts/UserModeContext";
import { Loader2, ShieldX } from "lucide-react";
import TalentDashboard from "@/components/TalentDashboard";

const Gigs = () => {
  const { isTalent, isLoading, session } = useUserMode();

  if (isLoading)
    return (
      <div className="h-screen flex items-center justify-center bg-black">
        <Loader2 className="animate-spin text-neon-green w-10 h-10" />
      </div>
    );

  if (!isTalent)
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-black p-6">
        <ShieldX className="w-16 h-16 text-red-500 mb-4" />
        <h1 className="text-white font-display text-2xl tracking-tighter">ACCESS DENIED</h1>
      </div>
    );

  return (
    <div className="min-h-screen bg-background p-4 pb-24">
      <TalentDashboard userId={session?.user?.id || ""} />
    </div>
  );
};

export default Gigs;
