import { useNavigate, useLocation } from "react-router-dom";
import { Home, Search, Wallet, User, ShieldCheck } from "lucide-react";
import { useUserMode } from "@/contexts/UserModeContext";

const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { mode } = useUserMode();

  const navItems = [
    { icon: Home, label: "Home", path: "/", modes: ["guest", "talent", "manager"] },
    { icon: Search, label: "Discovery", path: "/discovery", modes: ["guest", "talent", "manager"] },
    { icon: Wallet, label: "Wallet", path: "/wallet", modes: ["guest"] },
    { icon: ShieldCheck, label: "Admin", path: "/dashboard", modes: ["manager"] },
    { icon: User, label: "Profile", path: "/profile", modes: ["guest", "talent", "manager"] },
  ];

  // Only show items allowed for the current user mode
  const filteredItems = navItems.filter((item) => item.modes.includes(mode));

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-black/90 backdrop-blur-xl border-t border-white/5 pb-8 pt-3 px-6">
      <div className="max-w-md mx-auto flex justify-between items-center">
        {filteredItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;

          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className="flex flex-col items-center gap-1 transition-all active:scale-90"
            >
              <div
                className={`p-2 rounded-xl transition-colors ${isActive ? "bg-neon-green/10 text-neon-green" : "text-zinc-500"}`}
              >
                <Icon className={`w-6 h-6 ${isActive ? "drop-shadow-[0_0_8px_rgba(57,255,20,0.5)]" : ""}`} />
              </div>
              <span
                className={`text-[9px] font-black uppercase tracking-widest ${isActive ? "text-neon-green" : "text-zinc-600"}`}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
