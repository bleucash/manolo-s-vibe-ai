import { useLocation, useNavigate } from "react-router-dom";
import { useUserMode } from "@/contexts/UserModeContext";
import { Home, Search, MessageSquare, Wallet, LayoutDashboard, Briefcase, User } from "lucide-react";
import { cn } from "@/lib/utils";

const BottomNav = () => {
  const { mode } = useUserMode();
  const location = useLocation();
  const navigate = useNavigate();

  // 1. Logic: Hide on Auth page to prevent overlap
  if (location.pathname === "/auth") return null;

  // 2. The Color & Glow Definition
  // Mapping each slot to its specific Neon ID
  const navItems = [
    { icon: Home, path: "/", color: "text-[#FF5F1F]", glow: "shadow-[0_0_15px_#FF5F1F]" },
    { icon: Search, path: "/discovery", color: "text-[#00B7FF]", glow: "shadow-[0_0_15px_#00B7FF]" },
    { icon: MessageSquare, path: "/messages", color: "text-[#FF007F]", glow: "shadow-[0_0_15px_#FF007F]" },
    {
      // This slot transforms but stays Neon Green across all modes
      icon: mode === "manager" ? LayoutDashboard : mode === "talent" ? Briefcase : Wallet,
      path: mode === "manager" ? "/dashboard" : mode === "talent" ? "/gigs" : "/wallet",
      color: "text-[#39FF14]",
      glow: "shadow-[0_0_15px_#39FF14]",
    },
    { icon: User, path: "/profile", color: "text-[#00FFFF]", glow: "shadow-[0_0_15px_#00FFFF]" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-[100] bg-black/90 backdrop-blur-2xl border-t border-white/5 pb-8 pt-5 px-6">
      <div className="flex justify-between items-center max-w-md mx-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;

          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className="relative p-2 transition-transform active:scale-90"
            >
              <Icon
                className={cn(
                  "w-7 h-7 transition-all duration-300",
                  isActive ? `${item.color} ${item.glow}` : "text-zinc-800",
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
