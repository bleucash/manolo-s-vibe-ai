import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Html5Qrcode } from "html5-qrcode";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle, XCircle, Camera, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUserMode } from "@/contexts/UserModeContext";
import LoadingState from "@/components/ui/LoadingState";
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
      toast.error("No active venue selected");
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
        toast.success("Access Granted");
      } else {
        const messages = {
          already_used: "Ticket already scanned",
          wrong_venue: "Invalid venue for this ticket",
          invalid: "Ticket code not recognized",
        };
        toast.error(messages[result as keyof typeof messages] || "Scan failed");
      }
    } catch (err) {
      console.error("Scan error:", err);
      toast.error("Database sync error");
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
      toast.error("Camera access denied");
    }
  };

  const resetScanner = () => {
    setScanResult(null);
    setTicketData(null);
    startScanner();
  };

  if (contextLoading || !isAuthorized) {
    return <LoadingState />;
  }

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 text-white font-sans animate-in fade-in duration-700">
      <div className="fixed top-0 left-0 right-0 z-50 bg-black/95 backdrop-blur-md border-b border-white/5 p-4 flex justify-between items-center">
        <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")} className="text-zinc-400">
          <ArrowLeft className="mr-2 w-4 h-4" /> Exit
        </Button>
        <div className="text-right">
          <p className="text-neon-green text-xs font-black uppercase tracking-tighter">
            {activeVenue?.name || "Bouncer Mode"}
          </p>
        </div>
      </div>

      {scanResult === null ? (
        <div className="w-full max-w-sm">
          <div
            id="qr-reader"
            className="w-full aspect-square rounded-3xl overflow-hidden border border-white/10 bg-zinc-900"
          />
          {!isScanning && (
            <Button
              onClick={startScanner}
              className="w-full mt-8 bg-neon-green text-black h-16 text-lg font-black uppercase tracking-widest rounded-2xl hover:bg-neon-green/90"
            >
              <Camera className="mr-3" /> Start Scanner
            </Button>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center text-center animate-in zoom-in-95 duration-300">
          <div className={`p-8 rounded-full mb-6 ${scanResult === "success" ? "bg-neon-green/20" : "bg-red-500/20"}`}>
            {scanResult === "success" ? (
              <CheckCircle className="w-24 h-24 text-neon-green" />
            ) : (
              <XCircle className="w-24 h-24 text-red-500" />
            )}
          </div>

          <h2
            className={`text-5xl font-black uppercase italic tracking-tighter mb-2 ${scanResult === "success" ? "text-neon-green" : "text-red-500"}`}
          >
            {scanResult === "success" ? "Access Granted" : "Access Denied"}
          </h2>

          {ticketData && (
            <div className="bg-white/5 border border-white/10 px-6 py-4 rounded-2xl mb-8">
              <p className="text-zinc-400 text-[10px] uppercase font-bold tracking-widest mb-1">Guest Info</p>
              <p className="text-white font-black uppercase">
                {ticketData.customer_segment || "General"} • {ticketData.event_name || "Entry"}
              </p>
            </div>
          )}

          <Button
            onClick={resetScanner}
            className="min-w-[240px] h-14 bg-white text-black font-black uppercase tracking-widest rounded-full hover:bg-zinc-200 transition-all active:scale-95"
          >
            Ready for Next
          </Button>
        </div>
      )}
    </div>
  );
};

export default Bouncer;
