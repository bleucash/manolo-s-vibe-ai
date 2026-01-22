import { useLocation, useNavigate } from "react-router-dom";
import { useUserMode } from "@/contexts/UserModeContext";
import { Home, Search, MessageSquare, Wallet, LayoutDashboard, Briefcase, User } from "lucide-react";
import { cn } from "@/lib/utils";

const BottomNav = () => {
  const { mode } = useUserMode();
  const location = useLocation();
  const navigate = useNavigate();

  // 1. Hide on Auth Page
  if (location.pathname === "/auth") return null;

  // 2. Define Theme Mappings
  const isProfessional = mode === "talent" || mode === "manager";

  const navItems = [
    { icon: Home, path: "/", color: "text-neon-pink", glow: "shadow-[0_0_15px_#FF007F]" },
    { icon: Search, path: "/discovery", color: "text-neon-pink", glow: "shadow-[0_0_15px_#FF007F]" },
    { icon: MessageSquare, path: "/messages", color: "text-neon-pink", glow: "shadow-[0_0_15px_#FF007F]" },
    {
      icon: mode === "manager" ? LayoutDashboard : mode === "talent" ? Briefcase : Wallet,
      path: mode === "manager" ? "/dashboard" : mode === "talent" ? "/gigs" : "/wallet",
      // Only Gigs/Dashboard get Orange. Wallet remains Pink.
      color: isProfessional ? "text-[#FF5F1F]" : "text-neon-pink",
      glow: isProfessional ? "shadow-[0_0_15px_#FF5F1F]" : "shadow-[0_0_15px_#FF007F]",
    },
    { icon: User, path: "/profile", color: "text-neon-pink", glow: "shadow-[0_0_15px_#FF007F]" },
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
                  isActive ? `${item.color} ${item.glow}` : "text-zinc-700",
                )}
              />
              {isActive && (
                <div
                  className={cn(
                    "absolute -bottom-2 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full",
                    isProfessional && item.path.match(/dashboard|gigs/) ? "bg-[#FF5F1F]" : "bg-neon-pink",
                  )}
                />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
