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

  // 🛡️ ULTRA-SAFE VENUE LOOKUP
  const activeVenue = Array.isArray(userVenues) ? userVenues.find((v) => v.id === activeVenueId) : null;

  // 🛡️ SYSTEM SHUTDOWN PROTOCOL
  useEffect(() => {
    return () => {
      const shutdown = async () => {
        if (scannerRef.current?.isScanning) {
          try {
            await scannerRef.current.stop();
            scannerRef.current.clear();
          } catch (e) {
            console.warn("Lens shutdown delayed or already cleared");
          }
        }
      };
      shutdown();
    };
  }, []);

  // 🛡️ SECTOR VALIDATION
  useEffect(() => {
    if (!contextLoading && !activeVenueId) {
      toast.error("Sector Authorization Required");
      navigate("/dashboard");
    }
  }, [activeVenueId, contextLoading, navigate]);

  const onScanSuccess = async (qrCodeValue: string) => {
    if (!activeVenueId) return;

    try {
      // Immediate Hardware Pause
      if (scannerRef.current?.isScanning) {
        await scannerRef.current.pause(true);
      }

      const { data, error } = await supabase.rpc("check_in_guest", {
        qr_input: qrCodeValue.trim(),
        current_venue_id: activeVenueId,
      });

      if (error) throw error;

      setScanResult(data.result as ScanResult);
      if (data.ticket) setTicketData(data.ticket);

      if (data.result === "success") {
        toast.success("ID Patterns Verified");
      } else {
        toast.error("Handshake Refused");
      }
    } catch (err) {
      console.error("Ledger Sync Failure:", err);
      setScanResult("error");
      setLocalError("Sync error with global ledger");
    } finally {
      // Release hardware after pattern check
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
      // 1. Verify DOM Stability
      const container = document.getElementById("qr-reader");
      if (!container) throw new Error("Optical Housing Interface Missing");

      // 2. Initialize Hardware Instance
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode("qr-reader");
      }

      const config = {
        fps: 24,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
      };

      // 3. Request Hardware Permission & Start Stream
      await scannerRef.current.start(
        { facingMode: "environment" },
        config,
        onScanSuccess,
        () => {}, // Silent catch for frame-read jitter
      );

      setIsScanning(true);
    } catch (err: any) {
      console.error("Hardware Init failure:", err);
      setLocalError(err.message || "Hardware Access Denied");
      toast.error("Optical Lens Failure");
    } finally {
      setIsInitializing(false);
    }
  };

  if (contextLoading) return <LoadingState fullPage />;

  return (
    <div className="min-h-screen bg-black flex flex-col p-8 animate-in fade-in duration-700 font-body relative overflow-hidden">
      {/* 🛠 HUD NAVIGATION */}
      <div className="w-full flex justify-between items-center mb-16 pt-8 z-20">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/dashboard")}
          className="text-zinc-500 hover:text-white uppercase font-black text-[9px] tracking-[0.4em] bg-white/5 px-6 rounded-full border border-white/5 h-10"
        >
          <ArrowLeft className="mr-2 w-4 h-4" /> Disconnect
        </Button>
        <div className="flex items-center gap-3 bg-zinc-900/50 px-5 py-2 rounded-full border border-white/5 h-10">
          <div
            className={cn(
              "w-1.5 h-1.5 rounded-full shadow-[0_0_10px_currentColor]",
              activeVenue ? "text-neon-green bg-neon-green animate-pulse" : "text-zinc-600 bg-zinc-600",
            )}
          />
          <span className="text-white text-[9px] font-black uppercase tracking-[0.2em] italic truncate max-w-[120px]">
            {activeVenue?.name || "Neural Warming..."}
          </span>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center z-10">
        {!activeVenueId ? (
          <div className="text-center space-y-6">
            <div className="w-20 h-20 bg-zinc-900/50 rounded-[2rem] flex items-center justify-center mx-auto border border-white/5 shadow-2xl">
              <Lock className="w-8 h-8 text-zinc-700" />
            </div>
            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.5em]">Sector Lock Enabled</p>
            <Button
              onClick={() => navigate("/dashboard")}
              className="bg-white text-black font-black uppercase text-[10px] px-8 rounded-xl h-14"
            >
              Authorize via Dashboard
            </Button>
          </div>
        ) : scanResult === null ? (
          <div className="w-full max-w-sm space-y-12">
            <div
              id="qr-reader"
              className={cn(
                "w-full aspect-square rounded-[3.5rem] overflow-hidden border-2 transition-all duration-700 bg-zinc-950 shadow-2xl relative",
                isScanning ? "border-neon-blue shadow-[0_0_60px_rgba(0,183,255,0.1)]" : "border-white/5",
              )}
            >
              {!isScanning && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 bg-zinc-950/90 backdrop-blur-md">
                  {localError ? (
                    <AlertOctagon className="w-12 h-12 text-red-500 animate-pulse" />
                  ) : (
                    <div className="w-24 h-24 border-2 border-white/5 rounded-full border-dashed animate-[spin_25s_linear_infinite] flex items-center justify-center">
                      <Scan className="w-8 h-8 text-zinc-800" />
                    </div>
                  )}
                  <p className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.5em] px-10 text-center leading-relaxed">
                    {localError || "Bouncer Lens Offline"}
                  </p>
                </div>
              )}

              {isScanning && (
                <div className="absolute inset-0 z-20 pointer-events-none overflow-hidden">
                  <div className="w-full h-[1px] bg-neon-blue shadow-[0_0_20px_#00B7FF] animate-[scan_3s_ease-in-out_infinite]" />
                </div>
              )}
            </div>

            <Button
              onClick={startScanner}
              disabled={isScanning || isInitializing}
              className="w-full bg-white text-black h-20 text-[11px] font-black uppercase tracking-[0.3em] rounded-3xl shadow-[0_10px_30px_rgba(255,255,255,0.1)] active:scale-95 transition-all border-none"
            >
              {isInitializing ? (
                <RefreshCw className="mr-3 w-5 h-5 animate-spin" />
              ) : (
                <Power className="mr-3 w-5 h-5" />
              )}
              {isScanning ? "Scanning Target..." : isInitializing ? "Warming Up..." : "Initialize Optical Link"}
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
              <div
                className={cn(
                  "absolute inset-0 blur-3xl opacity-20 rounded-full",
                  scanResult === "success" ? "bg-neon-green" : "bg-red-500",
                )}
              />
              {scanResult === "success" ? (
                <CheckCircle className="w-24 h-24 text-neon-green relative z-10" />
              ) : (
                <XCircle className="w-24 h-24 text-red-500 relative z-10" />
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
                  <span className="text-[9px] font-black uppercase tracking-[0.3em]">Identity Authenticated</span>
                </div>
                <p className="text-white font-display text-3xl uppercase italic mb-2 tracking-tight leading-none">
                  {ticketData.customer_segment || "General Access"}
                </p>
                <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.3em]">
                  Sector Check-in: {activeVenue?.name || "Verified"}
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

      <style>{`
        @keyframes scan {
          0% { transform: translateY(0); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translateY(280px); opacity: 0; }
        }
      `}</style>
    </div>
  );
};

export default Bouncer;
