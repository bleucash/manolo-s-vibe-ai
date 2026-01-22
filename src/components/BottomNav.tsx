import { useLocation, useNavigate } from "react-router-dom";
import { useUserMode } from "@/contexts/UserModeContext";
import { Home, Search, MessageSquare, Wallet, LayoutDashboard, Briefcase } from "lucide-react";
import { cn } from "@/lib/utils";

const BottomNav = () => {
  const { mode } = useUserMode();
  const location = useLocation();
  const navigate = useNavigate();

  // ✅ UNIFIED COLOR LOGIC
  // Professional modes (Talent/Manager) get Orange. Guest gets Pink.
  const isProfessional = mode === "talent" || mode === "manager";
  const themeColor = isProfessional ? "text-[#FF5F1F]" : "text-neon-pink";
  const themeBg = isProfessional ? "bg-[#FF5F1F]" : "bg-neon-pink";

  // ✅ DYNAMIC ITEM LOGIC
  // The structure stays the same (preventing the blink), only the data changes.
  const navItems = [
    { icon: Home, path: "/", label: "Home" },
    { icon: Search, path: "/discovery", label: "Discovery" },
    { icon: MessageSquare, path: "/messages", label: "Chat" },
    {
      // Icon and Path change, but the "Slot" remains stable
      icon: mode === "manager" ? LayoutDashboard : mode === "talent" ? Briefcase : Wallet,
      path: mode === "manager" ? "/dashboard" : mode === "talent" ? "/gigs" : "/wallet",
      label: mode === "manager" ? "Dashboard" : mode === "talent" ? "Gigs" : "Wallet",
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-black/90 backdrop-blur-2xl border-t border-white/5 pb-8 pt-3 px-6 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
      <div className="flex justify-between items-center max-w-lg mx-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;

          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className="relative flex flex-col items-center gap-1 p-2 transition-all active:scale-90"
            >
              <Icon className={cn("w-6 h-6 transition-colors duration-300", isActive ? themeColor : "text-zinc-600")} />
              <span
                className={cn(
                  "text-[8px] font-black uppercase tracking-widest transition-colors",
                  isActive ? "text-white" : "text-zinc-700",
                )}
              >
                {item.label}
              </span>

              {isActive && (
                <div className={cn("absolute -bottom-1 w-1 h-1 rounded-full shadow-[0_0_8px_currentColor]", themeBg)} />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
