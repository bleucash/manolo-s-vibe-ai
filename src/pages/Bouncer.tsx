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
  // 🛡️ THE STABILIZER: Use a ref instead of document.getElementById
  const containerRef = useRef<HTMLDivElement>(null);

  const activeVenue = userVenues?.find((v) => v.id === activeVenueId);

  // 🛡️ HARDENED CLEANUP
  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        if (scannerRef.current.isScanning) {
          scannerRef.current.stop().catch(() => {});
        }
        // Completely clear the instance to prevent "Object not found" on remount
        scannerRef.current = null;
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
      setLocalError("Handshake failure with Identity Ledger");
    }
  };

  const startScanner = async () => {
    // 🛡️ SHIELD: Don't start if the DOM ref isn't ready
    if (!containerRef.current) {
      setLocalError("Optical Housing Not Ready");
      return;
    }

    setIsInitializing(true);
    setLocalError(null);

    try {
      // Create fresh instance only when needed
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode("qr-reader");
      }

      const devices = await Html5Qrcode.getCameras();
      if (!devices || devices.length === 0) {
        throw new Error("No optical hardware found");
      }

      // Default to back camera
      const cameraId = devices.length > 1 ? devices[devices.length - 1].id : devices[0].id;

      await scannerRef.current.start(
        cameraId,
        { fps: 20, qrbox: { width: 250, height: 250 } },
        onScanSuccess,
        () => {}, // Frame error ignore
      );

      setIsScanning(true);
    } catch (err: any) {
      console.error("Scanner Warm-up Error:", err);
      // Map the "object not found" error to a safe internal state
      setLocalError(err.message || "Lens Initialization Failure");
    } finally {
      setIsInitializing(false);
    }
  };

  if (contextLoading) return <LoadingState fullPage />;

  return (
    <div className="min-h-screen bg-black flex flex-col p-8 font-body">
      <div className="w-full flex justify-between items-center mb-12">
        <Button
          variant="ghost"
          onClick={() => navigate("/dashboard")}
          className="text-zinc-500 text-[10px] uppercase font-black tracking-widest"
        >
          <ArrowLeft className="mr-2 w-4 h-4" /> Disconnect
        </Button>
        <span className="text-white text-[10px] font-black uppercase tracking-widest italic opacity-50">
          {activeVenue?.name || "Neural Node"}
        </span>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center">
        {scanResult === null ? (
          <div className="w-full max-w-sm space-y-10">
            {/* 🛡️ STABLE CONTAINER */}
            <div
              ref={containerRef}
              id="qr-reader"
              className={cn(
                "w-full aspect-square rounded-[3.5rem] overflow-hidden border-2 transition-all duration-500 bg-zinc-950 relative",
                isScanning ? "border-neon-blue shadow-[0_0_30px_rgba(0,183,255,0.2)]" : "border-white/5",
              )}
            >
              {!isScanning && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 bg-zinc-950">
                  {localError ? (
                    <AlertOctagon className="w-12 h-12 text-red-500 animate-pulse" />
                  ) : (
                    <div className="w-20 h-20 border-2 border-white/5 rounded-full border-dashed animate-[spin_20s_linear_infinite] flex items-center justify-center">
                      <Scan className="w-8 h-8 text-zinc-800" />
                    </div>
                  )}
                  <p className="text-[10px] font-black text-zinc-700 uppercase tracking-[0.4em] text-center px-10 leading-relaxed">
                    {localError || "Initialize Optical Link"}
                  </p>
                </div>
              )}
            </div>

            <Button
              onClick={startScanner}
              disabled={isScanning || isInitializing}
              className="w-full bg-white text-black h-20 text-[11px] font-black uppercase tracking-[0.3em] rounded-3xl transition-transform active:scale-95"
            >
              {isInitializing ? (
                <RefreshCw className="mr-3 w-5 h-5 animate-spin" />
              ) : (
                <Power className="mr-3 w-5 h-5" />
              )}
              {isScanning ? "Scanning Target..." : "Initialize Link"}
            </Button>
          </div>
        ) : (
          /* RESULT VIEW */
          <div className="text-center animate-in zoom-in-95 duration-500">
            <div
              className={cn(
                "p-12 rounded-full mb-10 relative inline-flex",
                scanResult === "success" ? "bg-neon-green/10" : "bg-red-500/10",
              )}
            >
              {scanResult === "success" ? (
                <CheckCircle className="w-24 h-24 text-neon-green" />
              ) : (
                <XCircle className="w-24 h-24 text-red-500" />
              )}
            </div>
            <h2
              className={cn(
                "text-7xl font-display italic uppercase mb-12",
                scanResult === "success" ? "text-neon-green" : "text-red-500",
              )}
            >
              {scanResult === "success" ? "Cleared" : "Denied"}
            </h2>
            <Button
              onClick={() => setScanResult(null)}
              className="w-full bg-white text-black h-16 rounded-2xl font-black uppercase tracking-widest"
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
