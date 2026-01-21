import { Loader2 } from "lucide-react";

const LoadingState = () => {
  return (
    <div className="h-screen flex flex-col items-center justify-center bg-background">
      <Loader2 className="animate-spin text-neon-green w-16 h-16" />
      <p className="mt-4 text-xs tracking-[0.3em] uppercase text-muted-foreground font-mono">
        Neural Engine Initializing...
      </p>
    </div>
  );
};

export default LoadingState;
