import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Html5Qrcode } from "html5-qrcode";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle, XCircle, Camera, ArrowLeft, Zap, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUserMode } from "@/contexts/UserModeContext";
import { toast } from "sonner";
import LoadingState from "@/components/ui/LoadingState";
import { Card } from "@/components/ui/card";
type ScanResult = "success" | "already_used" | "invalid" | "wrong_venue" | null;

const Bouncer = () => {
  const navigate = useNavigate();
  const { activeVenueId, userVenues, isManager, isLoading: contextLoading } = useUserMode();
  const [scanResult, setScanResult] = useState<ScanResult>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [ticketData, setTicketData] = useState<any>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  const activeVenue = userVenues.find((v) => v.id === activeVenueId);

  // Stop scanner on unmount
  useEffect(() => {
    return () => {
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  // ✅ REDIRECT LOGIC:
  // If we finish loading and find no active venue, we send them back.
  useEffect(() => {
    if (!contextLoading && !activeVenueId) {
      toast.error("Sector Selection Required");
      navigate("/dashboard");
    }
  }, [activeVenueId, contextLoading, navigate]);

  const onScanSuccess = async (qrCodeValue: string) => {
    if (!activeVenueId) return;

    if (scannerRef.current?.isScanning) {
      await scannerRef.current.stop();
      setIsScanning(false);
    }

    const scannedValue = qrCodeValue.trim();

    try {
      const { data, error } = await supabase.rpc("check_in_guest", {
        qr_input: scannedValue,
        current_venue_id: activeVenueId,
      });

      if (error) throw error;

      const result = data.result as ScanResult;
      setScanResult(result);
      if (data.ticket) setTicketData(data.ticket);

      if (result === "success") {
        toast.success("Identity Verified");
      } else {
        const messages = {
          already_used: "Ticket utilized",
          wrong_venue: "Invalid sector",
          invalid: "Sequence unrecognized",
        };
        toast.error(messages[result as keyof typeof messages] || "Access Denied");
      }
    } catch (err) {
      toast.error("Ledger Sync Failure");
      resetScanner();
    }
  };

  const startScanner = async () => {
    try {
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode("qr-reader");
      }

      await scannerRef.current.start(
        { facingMode: "environment" },
        { fps: 20, qrbox: { width: 250, height: 250 } },
        onScanSuccess,
        () => {},
      );
      setIsScanning(true);
    } catch (err) {
      toast.error("Optical Hardware Offline");
    }
  };

  const resetScanner = () => {
    setScanResult(null);
    setTicketData(null);
    startScanner();
  };

  // ✅ LOCALIZED LOADING
  if (contextLoading) return <LoadingState />;

  return (
    <div className="min-h-screen bg-black flex flex-col p-6 animate-in fade-in duration-700">
      {/* HEADER SECTION */}
      <div className="w-full flex justify-between items-center mb-12 pt-12">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/dashboard")}
          className="text-zinc-500 hover:text-white uppercase font-black text-[9px] tracking-[0.3em]"
        >
          <ArrowLeft className="mr-2 w-4 h-4" /> Disconnect
        </Button>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-neon-green rounded-full shadow-[0_0_10px_#39FF14] animate-pulse" />
          <span className="text-white text-[10px] font-black uppercase tracking-widest italic">
            {activeVenue?.name || "Bouncer Engine"}
          </span>
        </div>
      </div>

      {/* SCANNING INTERFACE */}
      <div className="flex-1 flex flex-col items-center justify-center">
        {scanResult === null ? (
          <div className="w-full max-w-sm">
            <div
              id="qr-reader"
              className="w-full aspect-square rounded-[3rem] overflow-hidden border border-white/5 bg-zinc-900 shadow-2xl relative"
            >
              {!isScanning && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-zinc-900/50 backdrop-blur-sm">
                  <div className="w-32 h-32 border border-white/10 rounded-3xl border-dashed animate-[spin_10s_linear_infinite]" />
                  <p className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.4em]">Lens Offline</p>
                </div>
              )}
            </div>

            {!isScanning && (
              <div className="mt-12 space-y-4">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Zap className="w-3 h-3 text-zinc-700" />
                  <p className="text-[9px] font-black text-zinc-700 uppercase tracking-[0.3em]">
                    Optical Calibration Required
                  </p>
                </div>
                <Button
                  onClick={startScanner}
                  className="w-full bg-white text-black h-16 text-xs font-black uppercase tracking-[0.3em] rounded-2xl shadow-[0_0_30px_rgba(255,255,255,0.1)] active:scale-95 transition-all"
                >
                  <Camera className="mr-3 w-5 h-5" /> Initialize Scanner
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="w-full max-w-sm animate-in zoom-in-95 duration-500">
            <div className="flex flex-col items-center text-center">
              <div
                className={`p-10 rounded-full mb-8 relative ${scanResult === "success" ? "bg-neon-green/10" : "bg-red-500/10"}`}
              >
                <div
                  className={`absolute inset-0 blur-3xl opacity-30 rounded-full ${scanResult === "success" ? "bg-neon-green" : "bg-red-500"}`}
                />
                {scanResult === "success" ? (
                  <CheckCircle className="w-24 h-24 text-neon-green relative z-10" />
                ) : (
                  <XCircle className="w-24 h-24 text-red-500 relative z-10" />
                )}
              </div>

              <h2
                className={`text-6xl font-display uppercase tracking-tighter mb-6 italic ${scanResult === "success" ? "text-neon-green" : "text-red-500"}`}
              >
                {scanResult === "success" ? "CLEARED" : "DENIED"}
              </h2>

              {ticketData && (
                <Card className="bg-zinc-900/40 border-white/5 p-6 rounded-[2rem] mb-10 w-full backdrop-blur-xl">
                  <div className="flex items-center gap-2 mb-4 justify-center">
                    <ShieldCheck className="w-3 h-3 text-zinc-500" />
                    <span className="text-[8px] text-zinc-500 uppercase font-black tracking-widest">
                      Digital Ledger Entry
                    </span>
                  </div>
                  <p className="text-white font-display text-2xl uppercase italic tracking-tight leading-none mb-1">
                    {ticketData.customer_segment || "Standard"}
                  </p>
                  <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.2em]">
                    {ticketData.event_name || "Neural Access"}
                  </p>
                </Card>
              )}

              <Button
                onClick={resetScanner}
                className="w-full h-16 bg-white text-black font-black uppercase tracking-[0.2em] text-[10px] rounded-2xl hover:bg-zinc-200 active:scale-95 shadow-2xl"
              >
                Reset Scanner Loop
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Bouncer;
