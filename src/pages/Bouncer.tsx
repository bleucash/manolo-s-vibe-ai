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
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useUserMode } from "@/contexts/UserModeContext";
import { toast } from "sonner";
import LoadingState from "@/components/ui/LoadingState";
import { cn } from "@/lib/utils";

type ScanResult = "success" | "already_used" | "invalid" | "wrong_venue" | null;

const Bouncer = () => {
  const navigate = useNavigate();
  const { activeVenueId, userVenues, isLoading: contextLoading } = useUserMode();

  const [scanResult, setScanResult] = useState<ScanResult>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [ticketData, setTicketData] = useState<any>(null);
  const [initError, setInitError] = useState<string | null>(null);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const activeVenue = userVenues.find((v) => v.id === activeVenueId);

  // Clean up scanner on unmount
  useEffect(() => {
    return () => {
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop().catch(console.error);
      }
    };
  }, []);

  // Strict check for active sector
  useEffect(() => {
    if (!contextLoading && !activeVenueId) {
      toast.error("Sector Selection Required");
      navigate("/dashboard");
    }
  }, [activeVenueId, contextLoading, navigate]);

  const stopScanner = async () => {
    if (scannerRef.current?.isScanning) {
      await scannerRef.current.stop();
      setIsScanning(false);
    }
  };

  const onScanSuccess = async (decodedText: string) => {
    try {
      await stopScanner();

      const { data, error } = await supabase.rpc("check_in_guest", {
        qr_input: decodedText.trim(),
        current_venue_id: activeVenueId,
      });

      if (error) throw error;

      const result = data.result as ScanResult;
      setScanResult(result);
      if (data.ticket) setTicketData(data.ticket);

      if (result === "success") {
        toast.success("Pattern Recognized: Access Granted");
      } else {
        toast.error("Handshake Denied");
      }
    } catch (err) {
      console.error("Neural Sync Error:", err);
      setInitError("Ledger Sync failure");
    }
  };

  const startScanner = async () => {
    setInitError(null);
    try {
      // Ensure the DOM element exists before initializing
      const readerElem = document.getElementById("qr-reader");
      if (!readerElem) {
        throw new Error("Optical Interface Not Rendered");
      }

      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode("qr-reader");
      }

      await scannerRef.current.start(
        { facingMode: "environment" },
        { fps: 20, qrbox: { width: 250, height: 250 } },
        onScanSuccess,
        () => {}, // Silent frame-read errors
      );
      setIsScanning(true);
    } catch (err: any) {
      console.error(err);
      setInitError(err.message || "Hardware Access Denied");
      toast.error("Optical Hardware Offline");
    }
  };

  if (contextLoading) return <LoadingState />;

  return (
    <div className="min-h-screen bg-black flex flex-col p-8 animate-in fade-in duration-700 font-body relative overflow-hidden">
      {/* 🛠 HUD NAVIGATION */}
      <div className="w-full flex justify-between items-center mb-16 pt-8 z-20">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/dashboard")}
          className="text-zinc-500 hover:text-white uppercase font-black text-[9px] tracking-[0.4em] bg-white/5 px-6 rounded-full border border-white/5"
        >
          <ArrowLeft className="mr-2 w-4 h-4" /> Disconnect
        </Button>
        <div className="flex items-center gap-3 bg-zinc-900/50 px-5 py-2 rounded-full border border-white/5">
          <div className="w-2 h-2 bg-neon-green rounded-full shadow-[0_0_10px_#39FF14] animate-pulse" />
          <span className="text-white text-[9px] font-black uppercase tracking-[0.2em] italic">
            {activeVenue?.name || "Bouncer Engine"}
          </span>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center z-10">
        {scanResult === null ? (
          <div className="w-full max-w-sm space-y-12">
            <div
              id="qr-reader"
              className={cn(
                "w-full aspect-square rounded-[3.5rem] overflow-hidden border-2 transition-all duration-500 bg-zinc-950 shadow-2xl relative",
                isScanning ? "border-neon-blue shadow-[0_0_40px_rgba(0,183,255,0.2)]" : "border-white/5",
              )}
            >
              {!isScanning && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 bg-zinc-950">
                  {initError ? (
                    <AlertTriangle className="w-12 h-12 text-red-500 animate-pulse" />
                  ) : (
                    <div className="w-24 h-24 border-2 border-white/5 rounded-full border-dashed animate-[spin_15s_linear_infinite] flex items-center justify-center">
                      <Scan className="w-8 h-8 text-zinc-800" />
                    </div>
                  )}
                  <p className="text-[10px] font-black text-zinc-700 uppercase tracking-[0.5em] px-8 text-center">
                    {initError || "Optical Lens Offline"}
                  </p>
                </div>
              )}

              {/* CINEMATIC SCANNING LINE */}
              {isScanning && (
                <div className="absolute inset-0 z-20 pointer-events-none overflow-hidden">
                  <div className="w-full h-[2px] bg-neon-blue shadow-[0_0_15px_#00B7FF] animate-[scan_2s_ease-in-out_infinite]" />
                </div>
              )}
            </div>

            <Button
              onClick={startScanner}
              disabled={isScanning}
              className="w-full bg-white text-black h-20 text-[11px] font-black uppercase tracking-[0.3em] rounded-3xl shadow-xl hover:scale-105 active:scale-95 transition-all"
            >
              <Camera className="mr-3 w-6 h-6" /> Initialize Optical Scan
            </Button>
          </div>
        ) : (
          <div className="w-full max-w-sm animate-in zoom-in-95 duration-500">
            <div className="flex flex-col items-center text-center">
              <div
                className={cn(
                  "p-12 rounded-full mb-10 relative",
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
                  "text-7xl font-display uppercase tracking-tighter mb-8 italic leading-none",
                  scanResult === "success" ? "text-neon-green" : "text-red-500",
                )}
              >
                {scanResult === "success" ? "CLEARED" : "DENIED"}
              </h2>

              {ticketData && (
                <Card className="bg-zinc-900/40 border-white/5 p-8 rounded-[2.5rem] mb-12 w-full backdrop-blur-2xl border-white/5">
                  <div className="flex items-center gap-3 mb-6 justify-center">
                    <ShieldCheck className="w-4 h-4 text-zinc-500" />
                    <span className="text-[9px] text-zinc-500 font-black uppercase tracking-[0.3em]">
                      Neural ID Verified
                    </span>
                  </div>
                  <p className="text-white font-display text-3xl uppercase italic mb-2 tracking-tight">
                    {ticketData.customer_segment || "Standard Entry"}
                  </p>
                  <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.3em]">
                    Sector: {activeVenue?.name || "Verified Node"}
                  </p>
                </Card>
              )}

              <Button
                onClick={() => {
                  setScanResult(null);
                  startScanner();
                }}
                className="w-full h-16 bg-white text-black font-black uppercase tracking-[0.2em] text-[10px] rounded-2xl hover:bg-zinc-200 transition-all active:scale-95 shadow-xl"
              >
                Initialize Next Pattern
              </Button>
            </div>
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
