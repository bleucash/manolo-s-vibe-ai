import { useLocation, useNavigate } from "react-router-dom";
import { useUserMode } from "@/contexts/UserModeContext";
import { Home, Compass, MessageSquare, Wallet, LayoutDashboard, Star, User } from "lucide-react";
import { cn } from "@/lib/utils";

const BottomNav = () => {
  const { mode } = useUserMode();
  const location = useLocation();
  const navigate = useNavigate();

  // Hide on Auth page
  if (location.pathname === "/auth") return null;

  const navItems = [
    {
      icon: Home,
      path: "/",
      color: "text-[#FF5F1F]",
      glow: "drop-shadow([0_0_10px_rgba(255,95,31,0.5)])",
    },
    {
      icon: Compass,
      path: "/discovery",
      color: "text-[#00B7FF]",
      glow: "drop-shadow([0_0_10px_rgba(0,183,255,0.5)])",
    },
    {
      icon: MessageSquare,
      path: "/messages",
      color: "text-[#FF007F]",
      glow: "drop-shadow([0_0_10px_rgba(255,0,127,0.5)])",
    },
    {
      // ✅ STAR replacing Briefcase for Talent/Gigs
      icon: mode === "manager" ? LayoutDashboard : mode === "talent" ? Star : Wallet,
      path: mode === "manager" ? "/dashboard" : mode === "talent" ? "/gigs" : "/wallet",
      color: "text-[#39FF14]", // STILL GREEN
      glow: "drop-shadow([0_0_10px_rgba(57,255,20,0.5)])",
    },
    {
      icon: User,
      path: "/profile",
      color: "text-[#BF00FF]",
      glow: "drop-shadow([0_0_10px_rgba(191,0,255,0.5)])",
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-[100] bg-black/95 backdrop-blur-2xl border-t border-white/5 pb-6 pt-4 px-4">
      <div className="flex justify-between items-center max-w-md mx-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;

          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className="group relative p-2 transition-all duration-300 active:scale-90"
            >
              <Icon
                className={cn(
                  "w-8 h-8 transition-all duration-300", // Increased to w-8
                  isActive ? `${item.color} ${item.glow}` : "text-zinc-800 group-hover:text-zinc-400",
                )}
              />
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
