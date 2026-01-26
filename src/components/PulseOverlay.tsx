import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Volume2, VolumeX, Zap, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface PulseNode {
  id: string;
  type: "venue" | "talent";
  name: string;
  subtitle?: string;
  imageUrl: string;
  videoUrl?: string;
  profileUrl?: string;
}

interface PulseOverlayProps {
  nodes: PulseNode[];
  isOpen: boolean;
  onClose: () => void;
  initialIndex?: number;
  onAccessProfile?: (node: PulseNode) => void;
  onCharge?: (node: PulseNode) => void;
}

const NODE_TTL = 8000; // 8 seconds per node
const PROGRESS_INTERVAL = 50; // Update progress every 50ms

export const PulseOverlay: React.FC<PulseOverlayProps> = ({
  nodes,
  isOpen,
  onClose,
  initialIndex = 0,
  onAccessProfile,
  onCharge,
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [isCharging, setIsCharging] = useState(false);
  const [direction, setDirection] = useState(1);
  
  const progressRef = useRef<number>(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const currentNode = nodes[currentIndex];

  // Reset state when overlay opens
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(initialIndex);
      setProgress(0);
      progressRef.current = 0;
    }
  }, [isOpen, initialIndex]);

  // Progress timer logic
  useEffect(() => {
    if (!isOpen || isPaused || nodes.length === 0) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = setInterval(() => {
      progressRef.current += (PROGRESS_INTERVAL / NODE_TTL) * 100;
      
      if (progressRef.current >= 100) {
        progressRef.current = 0;
        setProgress(0);
        
        // Auto-advance or close
        if (currentIndex < nodes.length - 1) {
          setDirection(1);
          setCurrentIndex((prev) => prev + 1);
        } else {
          onClose();
        }
      } else {
        setProgress(progressRef.current);
      }
    }, PROGRESS_INTERVAL);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isOpen, isPaused, currentIndex, nodes.length, onClose]);

  // Reset progress when index changes
  useEffect(() => {
    progressRef.current = 0;
    setProgress(0);
  }, [currentIndex]);

  // Long-press handlers
  const handlePressStart = useCallback(() => {
    setIsPaused(true);
  }, []);

  const handlePressEnd = useCallback(() => {
    setIsPaused(false);
  }, []);

  // Navigation handlers
  const goToPrevious = useCallback(() => {
    if (currentIndex > 0) {
      setDirection(-1);
      progressRef.current = 0;
      setProgress(0);
      setCurrentIndex((prev) => prev - 1);
    }
  }, [currentIndex]);

  const goToNext = useCallback(() => {
    if (currentIndex < nodes.length - 1) {
      setDirection(1);
      progressRef.current = 0;
      setProgress(0);
      setCurrentIndex((prev) => prev + 1);
    } else {
      onClose();
    }
  }, [currentIndex, nodes.length, onClose]);

  // Tap zone handler
  const handleTapZone = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const width = rect.width;
      const percentage = x / width;

      if (percentage < 0.25) {
        goToPrevious();
      } else if (percentage > 0.75) {
        goToNext();
      }
    },
    [goToPrevious, goToNext]
  );

  // Charge handler with haptic animation
  const handleCharge = useCallback(() => {
    setIsCharging(true);
    
    // Trigger haptic feedback if available
    if (navigator.vibrate) {
      navigator.vibrate([50, 30, 50]);
    }
    
    onCharge?.(currentNode);
    
    setTimeout(() => setIsCharging(false), 600);
  }, [currentNode, onCharge]);

  // Handle mute toggle
  const toggleMute = useCallback(() => {
    setIsMuted((prev) => !prev);
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
    }
  }, [isMuted]);

  if (!isOpen || nodes.length === 0) return null;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key="pulse-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black"
        onMouseDown={handlePressStart}
        onMouseUp={handlePressEnd}
        onMouseLeave={handlePressEnd}
        onTouchStart={handlePressStart}
        onTouchEnd={handlePressEnd}
      >
        {/* Progress Indicators */}
        <div className="absolute top-0 left-0 right-0 z-20 flex gap-1 px-2 pt-3 safe-top">
          {nodes.map((_, index) => (
            <div
              key={index}
              className="h-0.5 flex-1 rounded-full overflow-hidden"
              style={{ backgroundColor: "hsl(var(--pulse-blue) / 0.3)" }}
            >
              <motion.div
                className="h-full rounded-full"
                style={{ backgroundColor: "hsl(var(--pulse-blue))" }}
                initial={{ width: "0%" }}
                animate={{
                  width:
                    index < currentIndex
                      ? "100%"
                      : index === currentIndex
                      ? `${progress}%`
                      : "0%",
                }}
                transition={{ duration: 0.05, ease: "linear" }}
              />
            </div>
          ))}
        </div>

        {/* Top Controls */}
        <div className="absolute top-8 right-3 z-20 flex items-center gap-2 safe-top">
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleMute();
            }}
            className="p-2 rounded-full backdrop-blur-xl bg-black/40 border border-white/10 transition-all hover:bg-black/60"
          >
            {isMuted ? (
              <VolumeX className="w-5 h-5 text-white/80" />
            ) : (
              <Volume2 className="w-5 h-5 text-white/80" />
            )}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="p-2 rounded-full backdrop-blur-xl bg-black/40 border border-white/10 transition-all hover:bg-black/60"
          >
            <X className="w-5 h-5 text-white/80" />
          </button>
        </div>

        {/* Background Media with Cinematic Scrim */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentNode.id}
            initial={{ scale: 1.1, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-0"
          >
            {currentNode.videoUrl ? (
              <video
                ref={videoRef}
                src={currentNode.videoUrl}
                autoPlay
                loop
                muted={isMuted}
                playsInline
                className="w-full h-full object-cover"
              />
            ) : (
              <img
                src={currentNode.imageUrl}
                alt={currentNode.name}
                className="w-full h-full object-cover"
              />
            )}
            
            {/* Cinematic Gradient Overlay */}
            <div 
              className="absolute inset-0"
              style={{
                background: `linear-gradient(
                  to bottom,
                  rgba(0, 0, 0, 0.8) 0%,
                  rgba(0, 0, 0, 0.2) 30%,
                  rgba(0, 0, 0, 0.1) 50%,
                  rgba(0, 0, 0, 0.2) 70%,
                  rgba(0, 0, 0, 0.9) 100%
                )`
              }}
            />
          </motion.div>
        </AnimatePresence>

        {/* Invisible Tap Zones */}
        <div
          className="absolute inset-0 z-10 flex"
          onClick={handleTapZone}
        >
          {/* Left 25% - Previous */}
          <div className="w-1/4 h-full cursor-pointer" />
          {/* Center 50% - No action (pause handled by press) */}
          <div className="w-1/2 h-full" />
          {/* Right 25% - Next */}
          <div className="w-1/4 h-full cursor-pointer" />
        </div>

        {/* Metadata HUD */}
        <div className="absolute bottom-0 left-0 right-0 z-20 p-4 pb-8 safe-bottom">
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.4 }}
            className="space-y-4"
          >
            {/* Live Intelligence Badge */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full backdrop-blur-xl bg-black/40 border border-white/10">
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: "hsl(var(--pulse-green))" }}
                />
                <span className="text-xs font-medium tracking-wider text-white/90 uppercase">
                  Live Intelligence
                </span>
                <Radio className="w-3 h-3 text-white/60" />
              </div>
            </div>

            {/* Node Name */}
            <div className="space-y-1">
              <AnimatePresence mode="wait">
                <motion.h2
                  key={currentNode.id}
                  initial={{ x: direction * 20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: direction * -20, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="font-display text-4xl md:text-5xl tracking-wide italic text-white"
                >
                  {currentNode.name}
                </motion.h2>
              </AnimatePresence>
              {currentNode.subtitle && (
                <p className="text-sm text-white/60 font-medium">
                  {currentNode.subtitle}
                </p>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 pt-2">
              {/* Access Profile Button */}
              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  onAccessProfile?.(currentNode);
                }}
                className="flex-1 h-12 rounded-xl font-semibold tracking-wide"
                style={{ 
                  backgroundColor: "hsl(var(--pulse-blue))",
                  color: "white"
                }}
              >
                Access Profile
              </Button>

              {/* Charge Button */}
              <motion.button
                onClick={(e) => {
                  e.stopPropagation();
                  handleCharge();
                }}
                animate={
                  isCharging
                    ? {
                        scale: [1, 1.2, 0.9, 1.1, 1],
                        rotate: [0, -5, 5, -3, 0],
                      }
                    : {}
                }
                transition={{ duration: 0.5 }}
                className="w-12 h-12 flex items-center justify-center rounded-xl backdrop-blur-xl bg-black/40 border border-white/20 transition-all hover:bg-black/60"
              >
                <motion.div
                  animate={isCharging ? { color: "hsl(var(--pulse-green))" } : {}}
                >
                  <Zap
                    className={`w-5 h-5 transition-colors ${
                      isCharging ? "text-[hsl(106,100%,55%)]" : "text-white/80"
                    }`}
                    fill={isCharging ? "currentColor" : "none"}
                  />
                </motion.div>
              </motion.button>
            </div>

            {/* Pause Indicator */}
            <AnimatePresence>
              {isPaused && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="flex justify-center"
                >
                  <div className="px-4 py-2 rounded-full backdrop-blur-xl bg-black/60 border border-white/10">
                    <span className="text-xs font-medium text-white/70 tracking-wider uppercase">
                      Transmission Paused
                    </span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>

        {/* Node Type Indicator */}
        <div className="absolute top-8 left-3 z-20 safe-top">
          <div className="px-3 py-1.5 rounded-full backdrop-blur-xl bg-black/40 border border-white/10">
            <span className="text-xs font-semibold tracking-wider text-white/80 uppercase">
              {currentNode.type === "venue" ? "Sector" : "Uplink"}
            </span>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default PulseOverlay;
