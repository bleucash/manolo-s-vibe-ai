import { useState } from "react";
import { useUserMode } from "@/contexts/UserModeContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ShieldX, ScanLine, CheckCircle2, XCircle } from "lucide-react";

const Bouncer = () => {
  const { isManager, isLoading } = useUserMode();
  const [scanResult, setScanResult] = useState<"idle" | "valid" | "invalid">("idle");

  if (isLoading)
    return (
      <div className="h-screen flex items-center justify-center bg-black">
        <Loader2 className="animate-spin text-neon-green w-10 h-10" />
      </div>
    );

  if (!isManager)
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-black p-6">
        <ShieldX className="w-16 h-16 text-red-500 mb-4" />
        <h1 className="text-white font-display text-2xl tracking-tighter">ACCESS DENIED</h1>
        <p className="text-zinc-500 text-sm mt-2">Manager access required</p>
      </div>
    );

  const handleSimulateScan = (result: "valid" | "invalid") => {
    setScanResult(result);
    setTimeout(() => setScanResult("idle"), 3000);
  };

  return (
    <div className="min-h-screen bg-background p-4 pb-24">
      <div className="mb-6">
        <h1 className="text-3xl font-display text-white uppercase tracking-tighter">
          Door Scanner
        </h1>
        <p className="text-zinc-500 text-sm">Validate guest entry tickets</p>
      </div>

      <Card className="bg-zinc-900 border-white/5 p-6 mb-6">
        <div className="aspect-square max-w-sm mx-auto bg-black rounded-2xl border-2 border-dashed border-white/10 flex flex-col items-center justify-center">
          {scanResult === "idle" ? (
            <>
              <ScanLine className="w-16 h-16 text-zinc-600 mb-4" />
              <p className="text-zinc-500 text-sm uppercase tracking-widest">Ready to Scan</p>
            </>
          ) : scanResult === "valid" ? (
            <>
              <CheckCircle2 className="w-20 h-20 text-neon-green mb-4" />
              <Badge className="bg-neon-green/20 text-neon-green text-lg px-4 py-2">
                VALID ENTRY
              </Badge>
            </>
          ) : (
            <>
              <XCircle className="w-20 h-20 text-red-500 mb-4" />
              <Badge className="bg-red-500/20 text-red-500 text-lg px-4 py-2">
                INVALID TICKET
              </Badge>
            </>
          )}
        </div>
      </Card>

      {import.meta.env.DEV && (
        <div className="flex gap-4">
          <Button
            onClick={() => handleSimulateScan("valid")}
            className="flex-1 bg-neon-green text-black font-bold uppercase"
          >
            Simulate Valid
          </Button>
          <Button
            onClick={() => handleSimulateScan("invalid")}
            variant="outline"
            className="flex-1 border-red-500/50 text-red-500"
          >
            Simulate Invalid
          </Button>
        </div>
      )}
    </div>
  );
};

export default Bouncer;
