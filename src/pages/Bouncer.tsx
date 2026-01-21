import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Html5Qrcode } from "html5-qrcode";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle, XCircle, Camera, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUserMode } from "@/contexts/UserModeContext";
import LoadingState from "@/components/ui/LoadingState"; // Unified Loader
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

  // --- UNIFIED LOADING EXPERIENCE ---
  // This replaces the small green circle/blue circle with your branded loader
  if (contextLoading || !isAuthorized) {
    return <LoadingState />;
  }

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6