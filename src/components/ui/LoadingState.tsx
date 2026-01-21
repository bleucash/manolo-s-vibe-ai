import { Loader2 } from "lucide-react";

const LoadingState = () => {
  return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-black">
      <Loader2 className="w-16 h-16 text-primary animate-spin mb-6" />
      <div className="animate-pulse text-muted-foreground font-display uppercase tracking-[0.3em] text-[10px]">
        Neural Engine Initializing...
      </div>
    </div>
  );
};

export default LoadingState;
