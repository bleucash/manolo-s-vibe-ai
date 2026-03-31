import { useLocation, useNavigate } from "react-router-dom";
import { useUserMode } from "@/contexts/UserModeContext";
import { Home, Compass, MessageSquare, Wallet, LayoutDashboard, Star, User } from "lucide-react";
import { cn } from "@/lib/utils";

const BottomNav = () => {
  const { mode, isLoading, session, activeVenueId } = useUserMode();
  const location = useLocation();
  const navigate = useNavigate();

  if (location.pathname === "/auth") return null;

  // ✅ USER ICON LOGIC: Unified Profile vs Settings
  const getProfilePath = () => {
    if (!session?.user?.id) return "/auth";
    if (mode === "talent") return `/talent/${session.user.id}`;
    if (mode === "manager" && activeVenueId) return `/venue/${activeVenueId}`;
    return "/profile"; // Guest Mode
  };

  // ✅ ACTION ICON LOGIC: Wallet vs Business Dashboard
  const getActionIcon = () => {
    if (mode === "manager") return LayoutDashboard;
    if (mode === "talent") return Star;
    return Wallet;
  };

  const getActionPath = () => {
    if (mode === "guest") return "/wallet";
    return "/dashboard";
  };

  const navItems = [
    {
      icon: Home,
      path: "/",
      color: "text-[#FF5F1F]", // Neon Orange
      glow: "drop-shadow-[0_0_10px_rgba(255,95,31,0.5)]",
    },
    {
      icon: Compass,
      path: "/discovery",
      color: "text-[#00B7FF]", // Neon Blue
      glow: "drop-shadow-[0_0_10px_rgba(0,183,255,0.5)]",
    },
    {
      icon: MessageSquare,
      path: "/messages",
      color: "text-[#FF007F]", // Neon Pink
      glow: "drop-shadow-[0_0_10px_rgba(255,0,127,0.5)]",
    },
    {
      // ✅ STAR/DASHBOARD/WALLET Toggle
      icon: getActionIcon(),
      path: getActionPath(),
      color: "text-[#39FF14]", // Neon Green
      glow: "drop-shadow-[0_0_10px_rgba(57,255,20,0.5)]",
    },
    {
      // ✅ USER/STUDIO Toggle
      icon: User,
      path: getProfilePath(),
      color: "text-[#BF00FF]", // Neon Purple
      glow: "drop-shadow-[0_0_10px_rgba(191,0,255,0.5)]",
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
              disabled={isLoading && !session}
              className="group relative p-2 transition-all duration-300 active:scale-90"
            >
              <Icon
                className={cn(
                  "w-8 h-8 transition-all duration-300",
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
