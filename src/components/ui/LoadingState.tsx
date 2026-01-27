import { forwardRef } from "react";
import { Loader2 } from "lucide-react";

interface LoadingStateProps {
  fullPage?: boolean;
}

// ✅ FIXED: Using forwardRef to prevent Radix/Tooltip crashes
export const LoadingState = forwardRef<HTMLDivElement, LoadingStateProps>(({ fullPage = false }, ref) => {
  return (
    <div
      ref={ref}
      className={`
          flex flex-col items-center justify-center transition-opacity duration-300
          ${fullPage ? "fixed inset-0 z-[9999] bg-black" : "h-[60vh] w-full bg-transparent"}
        `}
    >
      <div className="relative">
        <div className="absolute inset-0 blur-xl bg-neon-green/20 rounded-full animate-pulse" />
        <Loader2 className="h-12 w-12 animate-spin text-neon-green relative z-10" />
      </div>
      <div className="mt-6 flex flex-col items-center gap-1">
        <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em] animate-pulse">
          Neural Engine Initializing...
        </p>
        <div className="h-[1px] w-12 bg-zinc-800 overflow-hidden">
          <div className="h-full bg-neon-green animate-[loading-bar_1.5s_infinite]" />
        </div>
      </div>
    </div>
  );
});

LoadingState.displayName = "LoadingState";
export default LoadingState;
