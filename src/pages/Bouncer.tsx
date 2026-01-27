import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Html5Qrcode } from "html5-qrcode";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle, XCircle, Camera, ArrowLeft, Scan, RefreshCw, AlertOctagon, Power } from "lucide-react";
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
  const [localError, setLocalError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const activeVenue = userVenues?.find((v) => v.id === activeVenueId);

  useEffect(() => {
    return () => {
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop().catch(() => {});
      }
      scannerRef.current = null;
    };
  }, []);

  const onScanSuccess = async (decodedText: string) => {
    try {
      if (scannerRef.current?.isScanning) {
        await scannerRef.current.stop();
        setIsScanning(false);
      }

      const { data, error } = await supabase.rpc("check_in_guest", {
        qr_input: decodedText.trim(),
        current_venue_id: activeVenueId,
      });

      if (error) throw error;
      setScanResult(data?.result || "error");
      if (data?.ticket) setTicketData(data.ticket);
      toast.success(data?.result === "success" ? "Access Granted" : "Denied");
    } catch (err) {
      setLocalError("Database Sync Failure");
    }
  };

  const startScanner = async () => {
    setIsInitializing(true);
    setLocalError(null);

    // Buffer to ensure DOM is painted
    setTimeout(async () => {
      try {
        if (!containerRef.current) throw new Error("Housing Not Ready");

        if (!scannerRef.current) {
          scannerRef.current = new Html5Qrcode("qr-reader");
        }

        const devices = await Html5Qrcode.getCameras();
        if (!devices || devices.length === 0) throw new Error("No Camera Found");

        const cameraId = devices.length > 1 ? devices[devices.length - 1].id : devices[0].id;

        await scannerRef.current.start(
          cameraId,
          { fps: 20, qrbox: { width: 250, height: 250 } },
          onScanSuccess,
          () => {},
        );
        setIsScanning(true);
      } catch (err: any) {
        setLocalError(err.message || "Hardware Access Denied");
      } finally {
        setIsInitializing(false);
      }
    }, 500);
  };

  if (contextLoading) return <LoadingState fullPage />;

  return (
    <div className="min-h-screen bg-black flex flex-col p-8 animate-in fade-in duration-500">
      <div className="w-full flex justify-between items-center mb-12">
        <Button
          variant="ghost"
          onClick={() => navigate("/dashboard")}
          className="text-zinc-500 uppercase font-black text-[9px] tracking-widest bg-white/5 px-6 rounded-full"
        >
          <ArrowLeft className="mr-2 w-4 h-4" /> Disconnect
        </Button>
        <span className="text-white text-[9px] font-black uppercase tracking-widest italic">
          {activeVenue?.name || "Neural Engine"}
        </span>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center">
        {scanResult === null ? (
          <div className="w-full max-w-sm space-y-12">
            <div
              ref={containerRef}
              id="qr-reader"
              className={cn(
                "w-full aspect-square rounded-[3.5rem] overflow-hidden border-2 transition-all duration-500 bg-zinc-950 relative",
                isScanning ? "border-neon-blue" : "border-white/5",
              )}
            >
              {!isScanning && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 bg-zinc-950/90">
                  {localError ? (
                    <AlertOctagon className="w-12 h-12 text-red-500" />
                  ) : (
                    <div className="w-20 h-20 border-2 border-white/5 rounded-full border-dashed animate-[spin_20s_linear_infinite] flex items-center justify-center">
                      <Scan className="w-8 h-8 text-zinc-800" />
                    </div>
                  )}
                  <p className="text-[10px] font-black text-zinc-700 uppercase tracking-[0.4em] text-center px-10">
                    {localError || "Initialize Link"}
                  </p>
                </div>
              )}
            </div>

            <Button
              onClick={startScanner}
              disabled={isScanning || isInitializing}
              className="w-full bg-white text-black h-20 text-[11px] font-black uppercase tracking-[0.3em] rounded-3xl shadow-xl transition-all"
            >
              {isInitializing ? (
                <RefreshCw className="mr-3 w-5 h-5 animate-spin" />
              ) : (
                <Power className="mr-3 w-5 h-5" />
              )}
              {isScanning ? "Scanning Target..." : "Initialize Optical Scan"}
            </Button>
          </div>
        ) : (
          <div className="w-full max-w-sm text-center animate-in zoom-in-95 duration-500">
            <h2
              className={cn(
                "text-7xl font-display uppercase italic tracking-tighter mb-12",
                scanResult === "success" ? "text-neon-green" : "text-red-500",
              )}
            >
              {scanResult === "success" ? "CLEARED" : "DENIED"}
            </h2>
            {ticketData && (
              <Card className="bg-zinc-900/40 border-white/5 p-8 rounded-[2.5rem] mb-12 w-full backdrop-blur-2xl">
                <p className="text-white font-display text-3xl uppercase italic mb-2">
                  {ticketData.customer_segment || "Neural Access"}
                </p>
                <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.3em]">
                  {activeVenue?.name || "Verified Node"}
                </p>
              </Card>
            )}
            <Button
              onClick={() => setScanResult(null)}
              className="w-full h-16 bg-white text-black font-black uppercase tracking-[0.2em] text-[10px] rounded-2xl"
            >
              Reset Loop
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Bouncer;
