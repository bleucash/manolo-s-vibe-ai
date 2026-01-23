import { useLocation, useNavigate } from "react-router-dom";
import { useUserMode } from "@/contexts/UserModeContext";
import { Home, Search, MessageSquare, Wallet, LayoutDashboard, Briefcase, User } from "lucide-react";
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
      glow: "drop-shadow([0_0_8px_rgba(255,95,31,0.6)])",
    },
    {
      icon: Search,
      path: "/discovery",
      color: "text-[#00B7FF]",
      glow: "drop-shadow([0_0_8px_rgba(0,183,255,0.6)])",
    },
    {
      icon: MessageSquare,
      path: "/messages",
      color: "text-[#FF007F]",
      glow: "drop-shadow([0_0_8px_rgba(255,0,127,0.6)])",
    },
    {
      icon: mode === "manager" ? LayoutDashboard : mode === "talent" ? Briefcase : Wallet,
      path: mode === "manager" ? "/dashboard" : mode === "talent" ? "/gigs" : "/wallet",
      color: "text-[#39FF14]",
      glow: "drop-shadow([0_0_8px_rgba(57,255,20,0.6)])",
    },
    {
      icon: User,
      path: "/profile",
      color: "text-[#00FFFF]",
      glow: "drop-shadow([0_0_8px_rgba(0,255,255,0.6)])",
    },
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
              className="group relative p-2 transition-all duration-300 active:scale-90"
            >
              <Icon
                className={cn(
                  "w-7 h-7 transition-all duration-300",
                  // Inactive: zinc-800, Hover: zinc-400, Active: Neon Color + Subtle Glow
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
