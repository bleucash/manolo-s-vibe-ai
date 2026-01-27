import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Html5Qrcode } from "html5-qrcode";
import { supabase } from "@/integrations/supabase/client";
import {
  CheckCircle,
  XCircle,
  Camera,
  ArrowLeft,
  Scan,
  RefreshCw,
  AlertOctagon,
  Power,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useUserMode } from "@/contexts/UserModeContext";
import { toast } from "sonner";
import LoadingState from "@/components/ui/LoadingState";
import { cn } from "@/lib/utils";

type ScanResult = "success" | "already_used" | "invalid" | "wrong_venue" | "error" | null;

const Bouncer = () => {
  const navigate = useNavigate();
  const { activeVenueId, userVenues, isLoading: contextLoading, session } = useUserMode();

  const [scanResult, setScanResult] = useState<ScanResult>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [ticketData, setTicketData] = useState<any>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const activeVenue = userVenues?.find((v) => v.id === activeVenueId);

  // 🛡️ CRITICAL CLEANUP: Prevents the "Object not found" on re-entry
  useEffect(() => {
    return () => {
      const shutdown = async () => {
        if (scannerRef.current) {
          if (scannerRef.current.isScanning) {
            await scannerRef.current.stop().catch(() => {});
          }
          scannerRef.current = null;
        }
      };
      shutdown();
    };
  }, []);

  const onScanSuccess = async (qrCodeValue: string) => {
    if (!activeVenueId || !session?.user?.id) return;

    try {
      if (scannerRef.current?.isScanning) {
        await scannerRef.current.pause(true);
      }

      const { data, error } = await supabase.rpc("check_in_guest", {
        qr_input: qrCodeValue.trim(),
        current_venue_id: activeVenueId,
      });

      if (error) throw error;

      setScanResult((data?.result as ScanResult) || "error");
      if (data?.ticket) setTicketData(data.ticket);

      toast.success(data?.result === "success" ? "Access Cleared" : "Handshake Denied");
    } catch (err) {
      console.error("Ledger Sync Failure:", err);
      setScanResult("error");
    } finally {
      if (scannerRef.current?.isScanning) {
        await scannerRef.current.stop().catch(() => {});
        setIsScanning(false);
      }
    }
  };

  const startScanner = async () => {
    // 🛡️ DOM PROTECTION: ensures we don't call library on unmounted div
    if (!containerRef.current) {
      setLocalError("Optical Housing Interface Not Ready");
      return;
    }

    setLocalError(null);
    setScanResult(null);
    setIsInitializing(true);

    try {
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode("qr-reader");
      }

      const devices = await Html5Qrcode.getCameras();
      if (!devices || devices.length === 0) throw new Error("No Optical Hardware Detected");

      // Select back camera or first available
      const cameraId = devices.length > 1 ? devices[devices.length - 1].id : devices[0].id;

      await scannerRef.current.start(
        cameraId,
        { fps: 24, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 },
        onScanSuccess,
        () => {},
      );

      setIsScanning(true);
    } catch (err: any) {
      console.error("Camera Init failure:", err);
      setLocalError(err.message || "Hardware Access Denied");
    } finally {
      setIsInitializing(false);
    }
  };

  if (contextLoading || !session) return <LoadingState fullPage />;

  return (
    <div className="min-h-screen bg-black flex flex-col p-8 font-body relative overflow-hidden">
      {/* 🛠 HUD NAVIGATION */}
      <div className="w-full flex justify-between items-center mb-16 pt-8 z-20">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/dashboard")}
          className="text-zinc-500 hover:text-white uppercase font-black text-[9px] tracking-[0.4em] bg-white/5 px-6 rounded-full border border-white/5 h-10"
        >
          <ArrowLeft className="mr-2 w-4 h-4" /> Exit
        </Button>
        <div className="flex items-center gap-3 bg-zinc-900/50 px-5 py-2 rounded-full border border-white/5 h-10">
          <div
            className={cn(
              "w-1.5 h-1.5 rounded-full shadow-[0_0_10px_currentColor]",
              activeVenue ? "text-neon-green bg-neon-green animate-pulse" : "text-zinc-600 bg-zinc-600",
            )}
          />
          <span className="text-white text-[9px] font-black uppercase tracking-[0.2em] italic truncate max-w-[120px]">
            {activeVenue?.name || "Neural Node"}
          </span>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center z-10">
        {scanResult === null ? (
          <div className="w-full max-w-sm space-y-12">
            <div
              ref={containerRef}
              id="qr-reader"
              className={cn(
                "w-full aspect-square rounded-[3.5rem] overflow-hidden border-2 transition-all duration-700 bg-zinc-950 relative shadow-2xl",
                isScanning ? "border-neon-blue shadow-[0_0_60px_rgba(0,183,255,0.1)]" : "border-white/5",
              )}
            >
              {!isScanning && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 bg-zinc-950/90 backdrop-blur-md">
                  {localError ? (
                    <AlertOctagon className="w-12 h-12 text-red-500 animate-pulse" />
                  ) : (
                    <Scan className="w-8 h-8 text-zinc-800" />
                  )}
                  <p className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.5em] px-10 text-center leading-relaxed">
                    {localError || "Optical Interface Ready"}
                  </p>
                </div>
              )}
            </div>

            <Button
              onClick={startScanner}
              disabled={isScanning || isInitializing}
              className="w-full bg-white text-black h-20 text-[11px] font-black uppercase tracking-[0.3em] rounded-3xl shadow-xl active:scale-95 transition-all border-none"
            >
              {isInitializing ? (
                <RefreshCw className="mr-3 w-5 h-5 animate-spin text-neon-blue" />
              ) : (
                <Power className="mr-3 w-5 h-5" />
              )}
              {isScanning ? "Detecting Pattern..." : isInitializing ? "Warming Up..." : "Initialize Link"}
            </Button>
          </div>
        ) : (
          <div className="w-full max-w-sm animate-in zoom-in-95 duration-500 text-center">
            <div
              className={cn(
                "inline-flex p-12 rounded-full mb-10 relative",
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
                "text-7xl font-display uppercase italic tracking-tighter mb-8 leading-none",
                scanResult === "success" ? "text-neon-green" : "text-red-500",
              )}
            >
              {scanResult === "success" ? "CLEARED" : "DENIED"}
            </h2>

            {ticketData && (
              <Card className="bg-zinc-900/40 border-white/5 p-8 rounded-[2.5rem] mb-12 w-full backdrop-blur-2xl">
                <div className="flex items-center gap-3 mb-6 justify-center text-zinc-500">
                  <ShieldCheck className="w-4 h-4" />
                  <span className="text-[9px] font-black uppercase tracking-[0.3em]">Identity Link Verified</span>
                </div>
                <p className="text-white font-display text-3xl uppercase italic mb-2 leading-none">
                  {ticketData.customer_segment || "General Access"}
                </p>
                <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.3em]">
                  Sector: {activeVenue?.name || "Verified"}
                </p>
              </Card>
            )}

            <Button
              onClick={() => {
                setScanResult(null);
                startScanner();
              }}
              className="w-full h-16 bg-white text-black font-black uppercase tracking-[0.2em] text-[10px] rounded-2xl hover:bg-zinc-200 transition-all active:scale-95 shadow-xl border-none"
            >
              Reset Scanner Loop
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Bouncer;
