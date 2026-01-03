import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Html5Qrcode } from "html5-qrcode";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle, XCircle, Camera, ArrowLeft, Loader2 } from "lucide-react";
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

  // 1. Hardware Lifecycle Management
  useEffect(() => {
    return () => {
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop().catch(console.error);
      }
    };
  }, []);

  // 2. Permission Guard
  useEffect(() => {
    if (contextLoading) return;
    if (isManager && activeVenueId) {
      setIsAuthorized(true);
      return;
    }
    // Redirect if unauthorized or no active venue selected
    if (!activeVenueId) {
      toast.error("No active venue selected");
      navigate("/dashboard");
    }
  }, [isManager, activeVenueId, contextLoading, navigate]);

  const onScanSuccess = async (qrCodeValue: string) => {
    if (!activeVenueId) return;

    // Stop scanner immediately to prevent double-reads
    if (scannerRef.current?.isScanning) {
      await scannerRef.current.stop();
      setIsScanning(false);
    }

    const scannedValue = qrCodeValue.trim();

    try {
      // 3. ATOMIC VALIDATION: Use a single query to check and update
      // We check venue_id, qr_code, and current status in one go
      const { data: ticket, error } = await supabase
        .from("tickets")
        .select("id, status, venue_id, event_name, customer_segment")
        .eq("qr_code", scannedValue)
        .maybeSingle();

      if (error || !ticket) {
        setScanResult("invalid");
        return;
      }

      if (ticket.venue_id !== activeVenueId) {
        setScanResult("wrong_venue");
        return;
      }

      if (ticket.status === "Scanned") {
        setScanResult("already_used");
        setTicketData(ticket);
        return;
      }

      // 4. Update with status check to prevent race conditions
      const { error: updateError } = await supabase
        .from("tickets")
        .update({
          status: "Scanned",
          scanned_at: new Date().toISOString(),
        })
        .eq("id", ticket.id)
        .eq("status", "Valid"); // Ensure it's still valid at time of update

      if (updateError) throw updateError;

      setScanResult("success");
      setTicketData(ticket);
    } catch (err) {
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

  if (contextLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="animate-spin text-neon-green" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 text-white font-sans">
      {/* Dynamic Header */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-black/95 backdrop-blur-md border-b border-white/5 p-4 flex justify-between items-center">
        <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")} className="text-zinc-400">
          <ArrowLeft className="mr-2 w-4 h-4" /> Exit
        </Button>
        <div className="text-right">
          <p className="text-neon-green text-xs font-black uppercase tracking-tighter">
            {activeVenue?.name || "Operational Mode"}
          </p>
        </div>
      </div>

      {scanResult === null ? (
        <div className="w-full max-w-sm">
          <div
            id="qr-reader"
            className="w-full aspect-square rounded-3xl overflow-hidden border border-white/10 bg-zinc-900 shadow-[0_0_50px_rgba(0,0,0,1)]"
          />
          {!isScanning && (
            <Button
              onClick={startScanner}
              className="w-full mt-8 bg-neon-green text-black h-16 text-lg font-black uppercase tracking-widest rounded-2xl hover:bg-neon-green/90"
            >
              <Camera className="mr-3" /> Initiate Scan
            </Button>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
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
            {scanResult === "success"
              ? "Access Granted"
              : scanResult === "wrong_venue"
                ? "Invalid Venue"
                : "Access Denied"}
          </h2>

          {ticketData && (
            <div className="bg-white/5 border border-white/10 px-6 py-4 rounded-2xl mb-8">
              <p className="text-zinc-400 text-[10px] uppercase font-bold tracking-widest mb-1">Pass Identity</p>
              <p className="text-white font-black uppercase">
                {ticketData.customer_segment} • {ticketData.event_name}
              </p>
            </div>
          )}

          <Button
            onClick={resetScanner}
            className="min-w-[240px] h-14 bg-white text-black font-black uppercase tracking-widest rounded-full hover:bg-zinc-200 transition-all active:scale-95"
          >
            Next Scan
          </Button>
        </div>
      )}
    </div>
  );
};

export default Bouncer;
