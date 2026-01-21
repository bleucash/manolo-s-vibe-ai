import React, { forwardRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Home, Compass, LayoutDashboard, User, Wallet, Mic2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUserMode } from "@/contexts/UserModeContext";

const BottomNav = forwardRef<HTMLDivElement>((_, ref) => {
  const navigate = useNavigate();
  const location = useLocation();

  // ✅ Pulling 'mode' to ensure UI matches current intent
  const { mode } = useUserMode();

  // Hide Nav on full-screen experiences like Auth or the Bouncer scanner
  const hiddenRoutes = ["/auth", "/bouncer"];
  if (hiddenRoutes.includes(location.pathname)) return null;

  // 1. Guest Mode
  const guestItems = [
    { path: "/", icon: Home, label: "Home", color: "text-neon-green" },
    { path: "/discovery", icon: Compass, label: "Discovery", color: "text-neon-blue" },
    { path: "/wallet", icon: Wallet, label: "Wallet", color: "text-neon-pink" },
    { path: "/profile", icon: User, label: "Profile", color: "text-neon-cyan" },
  ];

  // 2. Talent Mode
  const talentItems = [
    { path: "/", icon: Home, label: "Home", color: "text-neon-green" },
    { path: "/discovery", icon: Compass, label: "Discovery", color: "text-neon-blue" },
    { path: "/gigs", icon: Mic2, label: "Gigs", color: "text-neon-purple" },
    { path: "/profile", icon: User, label: "Profile", color: "text-neon-cyan" },
  ];

  // 3. Manager Mode
  const managerItems = [
    { path: "/", icon: Home, label: "Home", color: "text-neon-green" },
    { path: "/discovery", icon: Compass, label: "Discovery", color: "text-neon-blue" },
    { path: "/dashboard", icon: LayoutDashboard, label: "Manager", color: "text-neon-green" },
    { path: "/profile", icon: User, label: "Profile", color: "text-neon-cyan" },
  ];

  const navItems = mode === "manager" ? managerItems : mode === "talent" ? talentItems : guestItems;

  return (
    <div
      ref={ref}
      className="fixed bottom-0 left-0 right-0 z-50 bg-black/95 border-t border-white/10 backdrop-blur-lg pb-safe animate-in fade-in slide-in-from-bottom-4 duration-700"
    >
      <div className="flex items-center justify-around h-16 max-w-md mx-auto px-2">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <button
              key={item.label}
              onClick={() => navigate(item.path)}
              className={cn(
                "flex flex-col items-center gap-1 p-2 transition-all duration-300 min-w-[64px] active:scale-90",
                isActive ? `${item.color} scale-110` : "text-zinc-500 hover:text-zinc-300",
              )}
            >
              <item.icon
                size={22}
                strokeWidth={isActive ? 2.5 : 2}
                className={cn(isActive && "drop-shadow-[0_0_8px_rgba(57,255,20,0.3)]")}
              />
              <span
                className={cn(
                  "text-[9px] uppercase font-black tracking-[0.2em]",
                  isActive ? "opacity-100" : "opacity-60",
                )}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
});

BottomNav.displayName = "BottomNav";

// ✅ CRITICAL: Using default export to match App.tsx import style
export default BottomNav;
