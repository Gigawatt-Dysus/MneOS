import React, { useRef, useEffect, useState } from 'react';
import ReactDOM from 'react-dom';

// Types for the telemetry expected from the Forge WebSocket
interface ForgeTelemetry {
  status: 'connecting' | 'downloading' | 'stalled' | 'extracting' | 'igniting' | 'ready';
  downloadSpeedMb: number; // in MB/s
  progressPercent: number;
}

interface ClothoProvisioningOverlayProps {
  telemetry: ForgeTelemetry;
  isVisible: boolean;
  onClose: () => void;
}

export const ClothoProvisioningOverlay: React.FC<ClothoProvisioningOverlayProps> = ({ telemetry, isVisible, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentVideoSrc, setCurrentVideoSrc] = useState<string>('/assets/videos/clotho_weaving_loop.webm');
  const [isAnnoyed, setIsAnnoyed] = useState<boolean>(false);

  // State Machine logic for Clotho's mood based on Iron Market telemetry
  useEffect(() => {
    if (!videoRef.current) return;

    if (telemetry.status === 'stalled' || (telemetry.status === 'downloading' && telemetry.downloadSpeedMb < 2)) {
      // Hobbyist internet dropped or is crawling. Trigger the Hogwarts painting annoyance.
      if (!isAnnoyed) {
        setIsAnnoyed(true);
        setCurrentVideoSrc('/assets/videos/clotho_annoyed_idle.webm');
        videoRef.current.playbackRate = 1.0; // Play the annoyed sighing at normal speed
      }
    } else if (telemetry.status === 'downloading') {
      // Normal or Fast download. She weaves.
      if (isAnnoyed) {
        setIsAnnoyed(false);
        setCurrentVideoSrc('/assets/videos/clotho_weaving_loop.webm');
      }
      
      // Map download speed to playback rate (Min 0.5x, Max 3.0x)
      // Assuming 100 MB/s is "fast" for a 5090 datacenter node
      const speedFactor = Math.max(0.5, Math.min(telemetry.downloadSpeedMb / 33, 3.0));
      videoRef.current.playbackRate = speedFactor;
    } else if (telemetry.status === 'extracting' || telemetry.status === 'igniting') {
      // Almost done. Maybe a rapid finishing animation or an expectant look.
      setIsAnnoyed(false);
      setCurrentVideoSrc('/assets/videos/clotho_expectant.webm');
      videoRef.current.playbackRate = 1.0;
    }
  }, [telemetry.status, telemetry.downloadSpeedMb, isAnnoyed]);

  // Ensure seamless looping when the source changes
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.load();
      videoRef.current.play().catch(err => console.warn("Clotho playback blocked:", err));
    }
  }, [currentVideoSrc]);

  if (!isVisible) return null;

  const overlayContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-md">
      {/* 
        The "Hogwarts Painting" frame
        We use an ornate CSS border or an actual PNG frame overlay, 
        with the video sitting underneath it. 
      */}
      <div className="relative w-[512px] h-[768px] rounded-lg overflow-hidden border-4 border-yellow-900/50 shadow-[0_0_50px_rgba(255,215,0,0.1)]">
        
        {/* Clotho Video Asset */}
        <video 
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover transition-opacity duration-700"
          src={currentVideoSrc}
          loop
          muted
          playsInline
        />

        {/* Glassmorphism Tactical Telemetry Overlay */}
        <div className="absolute bottom-4 left-4 right-4 p-4 rounded-xl bg-black/40 backdrop-blur-xl border border-white/10 font-mono text-xs text-green-400">
          <div className="flex justify-between items-center mb-2">
            <span className="text-gray-300">FORGE REHYDRATION</span>
            <span className={telemetry.status === 'stalled' ? 'text-red-500 animate-pulse' : 'text-blue-400'}>
              {telemetry.status.toUpperCase()}
            </span>
          </div>
          
          <div className="w-full h-2 bg-black/50 rounded-full overflow-hidden mb-2">
            <div 
              className={`h-full transition-all duration-300 ${isAnnoyed ? 'bg-red-500' : 'bg-green-500'}`}
              style={{ width: `${telemetry.progressPercent}%` }}
            />
          </div>

          <div className="flex justify-between text-gray-400">
            <span>Payload: Golden Tarball v1</span>
            <span>{telemetry.downloadSpeedMb.toFixed(1)} MB/s</span>
          </div>
        </div>

      </div>
    </div>
  );

  // Mount at the root level to prevent z-index clipping
  return ReactDOM.createPortal(overlayContent, document.body);
};
