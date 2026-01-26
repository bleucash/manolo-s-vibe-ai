import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Html5Qrcode } from "html5-qrcode";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle, XCircle, Camera, ArrowLeft, Zap, ShieldCheck, Scan, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useUserMode } from "@/contexts/UserModeContext";
import { toast } from "sonner";
import LoadingState from "@/components/ui/LoadingState";
import { cn } from "@/lib/utils";

const Bouncer = () => {
  const navigate = useNavigate();
  const { activeVenueId, userVenues, isLoading: contextLoading } = useUserMode();

  const [scanResult, setScanResult] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [ticketData, setTicketData] = useState<any>(null);
  const [errorState, setErrorState] = useState<string | null>(null);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const activeVenue = userVenues.find((v) => v.id === activeVenueId);

  useEffect(() => {
    // Safety check: Redirect if no venue is selected
    if (!contextLoading && !activeVenueId) {
      toast.error("Sector Selection Required");
      navigate("/dashboard");
    }

    return () => {
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, [activeVenueId, contextLoading]);

  const onScanSuccess = async (decodedText: string) => {
    try {
      if (scannerRef.current?.isScanning) {
        await scannerRef.current.stop();
        setIsScanning(false);
      }

      // Transmit to Supabase RPC
      const { data, error } = await supabase.rpc("check_in_guest", {
        qr_input: decodedText.trim(),
        current_venue_id: activeVenueId,
      });

      if (error) throw error;

      setScanResult(data.result);
      if (data.ticket) setTicketData(data.ticket);

      if (data.result === "success") {
        toast.success("Access Cleared");
      } else {
        toast.error("Handshake Denied");
      }
    } catch (err) {
      console.error("Scan Sync Error:", err);
      setErrorState("Ledger Sync Failure");
    }
  };

  const startScanner = async () => {
    setErrorState(null);
    try {
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode("qr-reader");
      }

      await scannerRef.current.start(
        { facingMode: "environment" },
        { fps: 20, qrbox: { width: 250, height: 250 } },
        onScanSuccess,
        (errorMessage) => {
          /* Silently handle frames */
        },
      );
      setIsScanning(true);
    } catch (err) {
      console.error(err);
      setErrorState("Optical Hardware Offline");
      toast.error("Camera access denied");
    }
  };

  if (contextLoading) return <LoadingState />;

  return (
    <div className="min-h-screen bg-black flex flex-col p-8 animate-in fade-in duration-700 relative overflow-hidden">
      {/* HEADER HUD */}
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
                "w-full aspect-square rounded-[3.5rem] overflow-hidden border-2 transition-all duration-500 bg-zinc-950 relative",
                isScanning ? "border-neon-blue shadow-[0_0_40px_rgba(0,183,255,0.2)]" : "border-white/5",
              )}
            >
              {!isScanning && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 bg-zinc-950">
                  <div className="w-24 h-24 border-2 border-white/5 rounded-full border-dashed animate-[spin_15s_linear_infinite] flex items-center justify-center">
                    <Scan className="w-8 h-8 text-zinc-800" />
                  </div>
                  <p className="text-[10px] font-black text-zinc-700 uppercase tracking-[0.5em]">
                    {errorState || "Optical Lens Offline"}
                  </p>
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
          /* RESULT VIEW */
          <div className="w-full max-w-sm flex flex-col items-center text-center">
            <div
              className={cn(
                "p-12 rounded-full mb-10 relative",
                scanResult === "success" ? "bg-neon-green/10" : "bg-red-500/10",
              )}
            >
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
              <Card className="bg-zinc-900/40 border-white/5 p-8 rounded-[2.5rem] mb-12 w-full backdrop-blur-2xl">
                <p className="text-white font-display text-3xl uppercase italic mb-1">{ticketData.customer_segment}</p>
                <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.3em]">
                  {ticketData.event_name}
                </p>
              </Card>
            )}

            <Button
              onClick={() => setScanResult(null)}
              className="w-full h-16 bg-white text-black font-black uppercase tracking-[0.2em] text-[10px] rounded-2xl"
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
