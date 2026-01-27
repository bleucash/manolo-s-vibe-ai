import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Html5Qrcode } from "html5-qrcode";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle, XCircle, Camera, ArrowLeft, Zap, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useUserMode } from "@/contexts/UserModeContext";
import { toast } from "sonner";
import LoadingState from "@/components/ui/LoadingState";

type ScanResult = "success" | "already_used" | "invalid" | "wrong_venue" | null;

const Bouncer = () => {
  const navigate = useNavigate();
  const { activeVenueId, userVenues, isLoading: contextLoading } = useUserMode();
  const [scanResult, setScanResult] = useState<ScanResult>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [ticketData, setTicketData] = useState<any>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  const activeVenue = userVenues.find((v) => v.id === activeVenueId);

  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, []);

  useEffect(() => {
    if (!contextLoading && !activeVenueId) {
      toast.error("Sector Selection Required");
      navigate("/dashboard");
    }
  }, [activeVenueId, contextLoading, navigate]);

  const stopScanner = async () => {
    if (scannerRef.current?.isScanning) {
      try {
        await scannerRef.current.stop();
        scannerRef.current = null;
      } catch (err) {
        console.warn("Scanner shutdown error:", err);
      } finally {
        setIsScanning(false);
      }
    }
  };

  const onScanSuccess = async (qrCodeValue: string) => {
    if (!activeVenueId) return;
    await stopScanner();

    try {
      // Calling the robust RPC function we just deployed
      const { data, error } = await supabase.rpc("check_in_guest", {
        qr_input: qrCodeValue.trim(),
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
      console.error(err);
      setScanResult(null);
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
        () => {}, // Silent on scan attempt
      );
      setIsScanning(true);
    } catch (err: any) {
      console.error("Scanner init error:", err);
      if (err.name === "NotAllowedError") {
        toast.error("Lens Permission Denied");
      } else {
        toast.error("Optical Hardware Offline");
      }
    }
  };

  const resetScanner = () => {
    setScanResult(null);
    setTicketData(null);
    startScanner();
  };

  if (contextLoading) return <LoadingState />;

  return (
    <div className="min-h-screen bg-black flex flex-col p-6 animate-in fade-in duration-700">
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

      <div className="flex-1 flex flex-col items-center justify-center">
        {scanResult === null ? (
          <div className="w-full max-w-sm">
            <div
              id="qr-reader"
              className="w-full aspect-square rounded-[3rem] overflow-hidden border border-white/5 bg-zinc-900 shadow-2xl relative"
            />

            {!isScanning && (
              <div className="mt-12 space-y-4">
                <Button
                  onClick={startScanner}
                  className="w-full bg-white text-black h-16 text-xs font-black uppercase tracking-[0.3em] rounded-2xl shadow-[0_0_30px_rgba(255,255,255,0.1)]"
                >
                  <Camera className="mr-3 w-5 h-5" /> Initialize Scanner
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="w-full max-w-sm text-center animate-in zoom-in-95 duration-500">
            <div
              className={`p-10 rounded-full mb-8 inline-block ${scanResult === "success" ? "bg-neon-green/10" : "bg-red-500/10"}`}
            >
              {scanResult === "success" ? (
                <CheckCircle className="w-24 h-24 text-neon-green" />
              ) : (
                <XCircle className="w-24 h-24 text-red-500" />
              )}
            </div>
            <h2
              className={`text-6xl font-display uppercase tracking-tighter mb-6 italic ${scanResult === "success" ? "text-neon-green" : "text-red-500"}`}
            >
              {scanResult === "success" ? "CLEARED" : "DENIED"}
            </h2>
            {ticketData && (
              <Card className="bg-zinc-900/40 border-white/5 p-6 rounded-[2rem] mb-10 backdrop-blur-xl">
                <p className="text-white font-display text-2xl uppercase italic mb-1">
                  {ticketData.customer_segment || "Standard"}
                </p>
                <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.2em]">
                  {ticketData.event_name || "Neural Access"}
                </p>
              </Card>
            )}
            <Button
              onClick={resetScanner}
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
