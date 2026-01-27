import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Html5Qrcode } from "html5-qrcode";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle, XCircle, Camera, ArrowLeft, Scan, RefreshCw, AlertOctagon, Power } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUserMode } from "@/contexts/UserModeContext";
import { toast } from "sonner";
import LoadingState from "@/components/ui/LoadingState";
import { cn } from "@/lib/utils";

const Bouncer = () => {
  const navigate = useNavigate();
  const { activeVenueId, userVenues, isLoading: contextLoading } = useUserMode();

  const [scanResult, setScanResult] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);

  const activeVenue = userVenues?.find((v) => v.id === activeVenueId);

  useEffect(() => {
    return () => {
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  const onScanSuccess = async (decodedText: string) => {
    try {
      if (scannerRef.current?.isScanning) {
        await scannerRef.current.stop();
        setIsScanning(false);
      }

      const { data, error } = await supabase.rpc("check_in_guest", {
        qr_input: decodedText.trim(),
        current_venue_id: activeVenueId,
      });

      if (error) throw error;
      setScanResult(data.result);
      toast.success(data.result === "success" ? "Cleared" : "Denied");
    } catch (err) {
      setLocalError("Database Sync Failure");
    }
  };

  const startScanner = async () => {
    setIsInitializing(true);
    setLocalError(null);

    // 🛡️ STEP 1: Wait for DOM to definitely be ready
    setTimeout(async () => {
      try {
        const container = document.getElementById("qr-reader");
        if (!container) throw new Error("Visual container not found");

        if (!scannerRef.current) {
          scannerRef.current = new Html5Qrcode("qr-reader");
        }

        // 🛡️ STEP 2: Find any available camera instead of forcing "environment"
        const devices = await Html5Qrcode.getCameras();
        if (!devices || devices.length === 0) {
          throw new Error("No optical hardware detected");
        }

        // Use the back camera if it exists, otherwise use the first one found
        const cameraId = devices.length > 1 ? devices[devices.length - 1].id : devices[0].id;

        await scannerRef.current.start(
          cameraId,
          { fps: 20, qrbox: { width: 250, height: 250 } },
          onScanSuccess,
          () => {},
        );

        setIsScanning(true);
      } catch (err: any) {
        console.error("Scanner Error:", err);
        // Map the "The object can not be found" error to something helpful
        const msg = err.message?.includes("not found") ? "Camera Link Broken: Refresh Permissions" : err.message;
        setLocalError(msg);
      } finally {
        setIsInitializing(false);
      }
    }, 300); // 300ms delay to ensure React finishes the paint
  };

  if (contextLoading) return <LoadingState fullPage />;

  return (
    <div className="min-h-screen bg-black flex flex-col p-8">
      <div className="w-full flex justify-between items-center mb-12">
        <Button
          variant="ghost"
          onClick={() => navigate("/dashboard")}
          className="text-zinc-500 text-[10px] uppercase font-black"
        >
          <ArrowLeft className="mr-2 w-4 h-4" /> Exit
        </Button>
        <span className="text-white text-[10px] font-black uppercase tracking-widest italic">
          {activeVenue?.name || "Bouncer Engine"}
        </span>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center">
        {scanResult === null ? (
          <div className="w-full max-w-sm space-y-10">
            <div
              id="qr-reader"
              className={cn(
                "w-full aspect-square rounded-[3rem] overflow-hidden border-2 bg-zinc-950 relative",
                isScanning ? "border-neon-blue" : "border-white/5",
              )}
            >
              {!isScanning && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-zinc-950/90">
                  {localError ? (
                    <AlertOctagon className="w-10 h-10 text-red-500" />
                  ) : (
                    <Scan className="w-8 h-8 text-zinc-800" />
                  )}
                  <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest text-center px-6">
                    {localError || "Lens Offline"}
                  </p>
                </div>
              )}
            </div>

            <Button
              onClick={startScanner}
              disabled={isScanning || isInitializing}
              className="w-full bg-white text-black h-20 text-[11px] font-black uppercase tracking-widest rounded-3xl"
            >
              {isInitializing ? <RefreshCw className="animate-spin mr-2" /> : <Power className="mr-2" />}
              {isScanning ? "Scanning..." : "Initialize Link"}
            </Button>
          </div>
        ) : (
          <div className="text-center animate-in zoom-in-95">
            <div className="mb-8">
              {scanResult === "success" ? (
                <CheckCircle className="w-32 h-32 text-neon-green mx-auto" />
              ) : (
                <XCircle className="w-32 h-32 text-red-500 mx-auto" />
              )}
            </div>
            <h2
              className={cn(
                "text-6xl font-display italic uppercase mb-12",
                scanResult === "success" ? "text-neon-green" : "text-red-500",
              )}
            >
              {scanResult === "success" ? "Cleared" : "Denied"}
            </h2>
            <Button
              onClick={() => setScanResult(null)}
              className="w-full bg-white text-black h-16 rounded-2xl font-black uppercase"
            >
              Reset Loop
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Bouncer;
