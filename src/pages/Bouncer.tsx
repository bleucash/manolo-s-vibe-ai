import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Html5Qrcode } from "html5-qrcode";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle, XCircle, Camera, ArrowLeft } from "lucide-react"; // Loader2 removed
import { Button } from "@/components/ui/button";
import { useUserMode } from "@/contexts/UserModeContext";
import { toast } from "sonner";

type ScanResult = "success" | "already_used" | "invalid" | "wrong_venue" | null;

const Bouncer = () => {
  const navigate = useNavigate();
  const { activeVenueId, userVenues, isManager, isLoading: contextLoading } = useUserMode();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [ticketData, setTicketData] = useState<any>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  const activeVenue = userVenues.find((v) => v.id === activeVenueId);

  useEffect(() => {
    return () => {
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop().catch(console.error);
      }
    };
  }, []);

  useEffect(() => {
    if (contextLoading) return;
    if (isManager && activeVenueId) {
      setIsAuthorized(true);
      return;
    }
    if (!activeVenueId) {
      toast.error("Venue Link Inactive");
      navigate("/dashboard");
    }
  }, [isManager, activeVenueId, contextLoading, navigate]);

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

      if (data.ticket) {
        setTicketData(data.ticket);
      }

      if (result === "success") {
        toast.success("Identity Verified");
      } else {
        const messages = {
          already_used: "Ticket already utilized",
          wrong_venue: "Incorrect venue sector",
          invalid: "Unrecognized sequence",
        };
        toast.error(messages[result as keyof typeof messages] || "Access Denied");
      }
    } catch (err) {
      console.error("Neural Sync Error:", err);
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
        { fps: 15, qrbox: { width: 250, height: 250 } },
        onScanSuccess,
        () => {},
      );
      setIsScanning(true);
    } catch (err) {
      toast.error("Camera Hardware Unavailable");
    }
  };

  const resetScanner = () => {
    setScanResult(null);
    setTicketData(null);
    startScanner();
  };

  // ✅ UNIFIED LOADING STRATEGY
  // We return null so the Neural Engine loader stays visible
  // until the manager clearance is verified.
  if (contextLoading || !isAuthorized) {
    return null;
  }

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 animate-in fade-in duration-700">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-black/95 backdrop-blur-md border-b border-white/5 p-4 flex justify-between items-center">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/dashboard")}
          className="text-zinc-500 hover:text-white uppercase font-black text-[10px] tracking-widest"
        >
          <ArrowLeft className="mr-2 w-4 h-4" /> Disconnect
        </Button>
        <div className="text-right">
          <p className="text-neon-green text-[10px] font-black uppercase tracking-[0.2em]">
            {activeVenue?.name || "Neural Bouncer"}
          </p>
        </div>
      </div>

      {scanResult === null ? (
        <div className="w-full max-w-sm flex flex-col items-center">
          <div
            id="qr-reader"
            className="w-full aspect-square rounded-[2rem] overflow-hidden border-2 border-white/5 bg-zinc-900 shadow-[0_0_50px_rgba(0,0,0,0.8)] relative"
          >
            {/* Target Reticle Overlay */}
            {!isScanning && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-48 h-48 border-2 border-white/10 rounded-3xl border-dashed animate-pulse" />
              </div>
            )}
          </div>

          {!isScanning && (
            <div className="w-full space-y-4 mt-12 text-center">
              <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.4em]">Optical Sync Required</h3>
              <Button
                onClick={startScanner}
                className="w-full bg-white text-black h-16 text-sm font-black uppercase tracking-[0.3em] rounded-2xl hover:bg-neon-green transition-all shadow-xl active:scale-95"
              >
                <Camera className="mr-3 w-5 h-5" /> Initialize Lens
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center text-center max-w-sm w-full animate-in fade-in zoom-in-95 duration-500">
          <div
            className={`p-10 rounded-full mb-8 relative ${scanResult === "success" ? "bg-neon-green/10" : "bg-red-500/10"}`}
          >
            <div
              className={`absolute inset-0 blur-3xl opacity-50 rounded-full ${scanResult === "success" ? "bg-neon-green" : "bg-red-500"}`}
            />
            {scanResult === "success" ? (
              <CheckCircle className="w-24 h-24 text-neon-green relative z-10" />
            ) : (
              <XCircle className="w-24 h-24 text-red-500 relative z-10" />
            )}
          </div>

          <h2
            className={`text-5xl font-display uppercase tracking-tighter mb-4 italic ${scanResult === "success" ? "text-neon-green" : "text-red-500"}`}
          >
            {scanResult === "success" ? "Verified" : "Denied"}
          </h2>

          {ticketData && (
            <div className="bg-white/5 border border-white/10 px-8 py-5 rounded-2xl mb-10 w-full backdrop-blur-md">
              <p className="text-zinc-500 text-[9px] uppercase font-black tracking-[0.3em] mb-2">Subject Ledger</p>
              <p className="text-white font-black uppercase tracking-tight text-lg italic">
                {ticketData.customer_segment || "Standard"} Entry
              </p>
              <p className="text-zinc-400 text-xs font-bold uppercase mt-1">
                {ticketData.event_name || "General Admission"}
              </p>
            </div>
          )}

          <Button
            onClick={resetScanner}
            className="w-full h-16 bg-white text-black font-black uppercase tracking-widest rounded-2xl hover:bg-zinc-200 transition-all active:scale-95 shadow-2xl"
          >
            Reset Sequence
          </Button>
        </div>
      )}
    </div>
  );
};

export default Bouncer;
