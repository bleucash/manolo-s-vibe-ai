import { TalentGuard } from "@/components/TalentGuard";
import { TalentDashboard } from "@/components/TalentDashboard";
import { useUserMode } from "@/contexts/UserModeContext";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const Gigs = () => {
  const { mode, session } = useUserMode();
  const navigate = useNavigate();

  // Redirect if not in talent mode or not logged in
  useEffect(() => {
    if (!session) {
      navigate("/auth");
    }
  }, [session, navigate]);

  return (
    <TalentGuard>
      <div className="min-h-screen bg-black pb-32 animate-in fade-in duration-700">
        {/* HUD HEADER */}
        <div className="px-8 pt-8 flex items-center justify-between">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate(-1)} 
            className="rounded-full bg-white/5 border border-white/10"
          >
            <ArrowLeft className="w-4 h-4 text-white" />
          </Button>
          <span className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.4em]">
            Professional Sector
          </span>
          <div className="w-10" /> {/* Spacer for symmetry */}
        </div>

        {/* INJECTED DASHBOARD COMPONENT */}
        <TalentDashboard />
      </div>
    </TalentGuard>
  );
};

export default Gigs;
