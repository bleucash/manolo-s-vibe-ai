import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Html5Qrcode } from "html5-qrcode";
import { supabase } from "@/integrations/supabase/client";
import {
  CheckCircle,
  XCircle,
  Camera,
  ArrowLeft,
  Zap,
  ShieldCheck,
  Scan,
  RefreshCw,
  AlertOctagon,
  Lock,
  Power,
  ChevronRight,
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
  const { activeVenueId, userVenues, isLoading: contextLoading } = useUserMode();

  const [scanResult, setScanResult] = useState<ScanResult>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [ticketData, setTicketData] = useState<any>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);

  // 🛡️ NULL-SAFE VENUE RETRIEVAL
  const activeVenue = userVenues && Array.isArray(userVenues) ? userVenues.find((v) => v.id === activeVenueId) : null;

  // 🛡️ CLEAN SHUTDOWN: Releases camera hardware immediately on unmount
  useEffect(() => {
    return () => {
      if (scannerRef.current?.isScanning) {
        scannerRef.current
          .stop()
          .then(() => scannerRef.current?.clear())
          .catch(() => console.warn("Lens release delay"));
      }
    };
  }, []);

  const onScanSuccess = async (qrCodeValue: string) => {
    if (!activeVenueId) return;

    try {
      // Pause camera to prevent rapid-fire scans
      if (scannerRef.current?.isScanning) {
        await scannerRef.current.pause(true);
      }

      const { data, error } = await supabase.rpc("check_in_guest", {
        qr_input: qrCodeValue.trim(),
        current_venue_id: activeVenueId,
      });

      if (error) throw error;

      // Defensive result handling
      const result = data?.result as ScanResult;
      setScanResult(result || "error");
      if (data?.ticket) setTicketData(data.ticket);

      if (result === "success") {
        toast.success("Pattern Authenticated: Cleared");
      } else {
        toast.error("Identity Handshake Refused");
      }
    } catch (err) {
      console.error("Ledger Sync Failure:", err);
      setScanResult("error");
      setLocalError("Handshake desync. Check connection.");
    } finally {
      // Release hardware
      if (scannerRef.current?.isScanning) {
        await scannerRef.current.stop().catch(() => {});
        setIsScanning(false);
      }
    }
  };

  const startScanner = async () => {
    setLocalError(null);
    setScanResult(null);
    setIsInitializing(true);

    try {
      // 1. Verify DOM anchor
      const housing = document.getElementById("qr-reader");
      if (!housing) throw new Error("Optical Housing Interface Failed");

      // 2. Clear previous instances
      if (scannerRef.current) {
        try {
          await scannerRef.current.stop();
        } catch (e) {}
      }

      scannerRef.current = new Html5Qrcode("qr-reader");

      const config = {
        fps: 24,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
      };

      await scannerRef.current.start(
        { facingMode: "environment" },
        config,
        onScanSuccess,
        () => {}, // Frames discarded quietly
      );

      setIsScanning(true);
    } catch (err: any) {
      console.error("Scanner Warm-up Error:", err);
      setLocalError(err.message || "Hardware Access Denied");
      toast.error("Camera handshake failed");
    } finally {
      setIsInitializing(false);
    }
  };

  if (contextLoading) return <LoadingState fullPage />;

  return (
    <div className="min-h-screen bg-black flex flex-col p-8 animate-in fade-in duration-1000 font-body relative overflow-hidden">
      {/* 🛠 HUD NAVIGATION */}
      <div className="w-full flex justify-between items-center mb-16 pt-8 z-20">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/dashboard")}
          className="text-zinc-500 hover:text-white uppercase font-black text-[9px] tracking-[0.4em] bg-white/5 px-6 rounded-full border border-white/5 h-12 transition-all hover:bg-white/10"
        >
          <ArrowLeft className="mr-2 w-4 h-4" /> Disconnect Hub
        </Button>
        <div className="flex items-center gap-4 bg-zinc-900/50 px-6 py-2 rounded-full border border-white/5 h-12 backdrop-blur-xl">
          <div
            className={cn(
              "w-2 h-2 rounded-full shadow-[0_0_10px_currentColor]",
              activeVenue ? "text-neon-green bg-neon-green animate-pulse" : "text-zinc-600 bg-zinc-600",
            )}
          />
          <span className="text-white text-[9px] font-black uppercase tracking-[0.2em] italic truncate max-w-[140px]">
            {activeVenue?.name || "Neural Warming..."}
          </span>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center z-10">
        {!activeVenueId ? (
          <div className="text-center space-y-8 animate-in slide-in-from-bottom-8 duration-700">
            <div className="w-24 h-24 bg-zinc-900/40 rounded-[2.5rem] flex items-center justify-center mx-auto border border-white/5 shadow-2xl backdrop-blur-3xl">
              <Lock className="w-8 h-8 text-zinc-700" />
            </div>
            <div>
              <p className="text-[11px] font-black text-white uppercase tracking-[0.5em] mb-2">Sector Lock Active</p>
              <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-[0.2em]">
                Managerial Clearances Required
              </p>
            </div>
            <Button
              onClick={() => navigate("/dashboard")}
              className="bg-white text-black font-black uppercase text-[10px] px-12 rounded-2xl h-16 hover:scale-105 transition-all shadow-xl"
            >
              Return to Command
            </Button>
          </div>
        ) : scanResult === null ? (
          <div className="w-full max-w-sm space-y-12">
            <div
              id="qr-reader"
              className={cn(
                "w-full aspect-square rounded-[3.5rem] overflow-hidden border-2 transition-all duration-1000 bg-zinc-950 shadow-2xl relative group",
                isScanning ? "border-neon-blue shadow-[0_0_70px_rgba(0,183,255,0.1)]" : "border-white/5",
              )}
            >
              {!isScanning && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 bg-zinc-950/90 backdrop-blur-md">
                  {localError ? (
                    <AlertOctagon className="w-14 h-14 text-red-500 animate-pulse" />
                  ) : (
                    <div className="w-28 h-28 border-2 border-white/5 rounded-full border-dashed animate-[spin_30s_linear_infinite] flex items-center justify-center">
                      <Scan className="w-10 h-10 text-zinc-800" />
                    </div>
                  )}
                  <p className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.6em] px-10 text-center leading-relaxed">
                    {localError || "Optical Lens Offline"}
                  </p>
                </div>
              )}

              {isScanning && (
                <div className="absolute inset-0 z-20 pointer-events-none overflow-hidden">
                  <div className="w-full h-[2px] bg-neon-blue shadow-[0_0_30px_#00B7FF] animate-[scan_2.5s_ease-in-out_infinite]" />
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent via-neon-blue/5 to-transparent animate-pulse" />
                </div>
              )}
            </div>

            <Button
              onClick={startScanner}
              disabled={isScanning || isInitializing}
              className="w-full bg-white text-black h-20 text-[11px] font-black uppercase tracking-[0.4em] rounded-[2rem] shadow-[0_15px_40px_rgba(255,255,255,0.1)] active:scale-95 transition-all border-none group"
            >
              {isInitializing ? (
                <RefreshCw className="mr-4 w-6 h-6 animate-spin text-neon-blue" />
              ) : (
                <Power className="mr-4 w-6 h-6 group-hover:text-neon-blue transition-colors" />
              )}
              {isScanning ? "Pattern detection active" : isInitializing ? "Syncing hardware" : "Initialize Lens"}
            </Button>
          </div>
        ) : (
          /* RESULT INTERFACE */
          <div className="w-full max-w-sm animate-in zoom-in-95 duration-700 text-center">
            <div
              className={cn(
                "inline-flex p-16 rounded-full mb-12 relative",
                scanResult === "success"
                  ? "bg-neon-green/10 shadow-[0_0_50px_rgba(57,255,20,0.1)]"
                  : "bg-red-500/10 shadow-[0_0_50px_rgba(239,68,68,0.1)]",
              )}
            >
              <div
                className={cn(
                  "absolute inset-0 blur-3xl opacity-20 rounded-full",
                  scanResult === "success" ? "bg-neon-green" : "bg-red-500",
                )}
              />
              {scanResult === "success" ? (
                <CheckCircle className="w-28 h-28 text-neon-green relative z-10" />
              ) : (
                <XCircle className="w-28 h-28 text-red-500 relative z-10 shadow-[0_0_30px_rgba(239,68,68,0.3)]" />
              )}
            </div>

            <h2
              className={cn(
                "text-8xl font-display uppercase italic tracking-tighter mb-12 leading-none",
                scanResult === "success" ? "text-neon-green" : "text-red-500",
              )}
            >
              {scanResult === "success" ? "CLEARED" : "DENIED"}
            </h2>

            {ticketData && (
              <Card className="bg-zinc-900/40 border-white/5 p-10 rounded-[3rem] mb-12 w-full backdrop-blur-3xl border border-white/5">
                <div className="flex items-center gap-3 mb-8 justify-center text-zinc-500">
                  <ShieldCheck className="w-4 h-4" />
                  <span className="text-[10px] font-black uppercase tracking-[0.4em]">Pattern Authenticated</span>
                </div>
                <p className="text-white font-display text-4xl uppercase italic mb-3 tracking-tighter leading-none">
                  {ticketData.customer_segment || "Standard Unit"}
                </p>
                <p className="text-zinc-500 text-[11px] font-black uppercase tracking-[0.3em]">
                  {activeVenue?.name || "Verified Sector"}
                </p>
              </Card>
            )}

            <Button
              onClick={() => {
                setScanResult(null);
                startScanner();
              }}
              className="w-full h-18 bg-white text-black font-black uppercase tracking-[0.3em] text-[11px] rounded-[1.8rem] hover:bg-zinc-200 transition-all active:scale-95 shadow-2xl border-none flex items-center justify-center gap-3"
            >
              Reset Scanner Loop <ChevronRight className="w-5 h-5" />
            </Button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes scan {
          0% { transform: translateY(-50px); opacity: 0; }
          20% { opacity: 1; }
          80% { opacity: 1; }
          100% { transform: translateY(300px); opacity: 0; }
        }
      `}</style>
    </div>
  );
};

export default Bouncer;
