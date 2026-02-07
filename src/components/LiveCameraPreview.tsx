import { useRef, useEffect, useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { PitchTypeConfig, DEFAULT_PITCH_TYPES, PITCH_TYPE_COLORS } from '@/types/pitch-location';
import { STRIKE_ZONE, GRID_CONFIG } from '@/lib/strike-zone';
import { X, Video } from 'lucide-react';

interface LiveCameraPreviewProps {
  stream: MediaStream;
  pitchTypes?: PitchTypeConfig;
  onCapture: (x: number, y: number) => void;
  onCancel: () => void;
}

export function LiveCameraPreview({
  stream,
  pitchTypes = DEFAULT_PITCH_TYPES,
  onCapture,
  onCancel,
}: LiveCameraPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isReady, setIsReady] = useState(false);

  // Attach stream to video element
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(console.error);
    }
  }, [stream]);

  const handleVideoReady = useCallback(() => {
    setIsReady(true);
  }, []);

  // Handle tap on the overlay
  const handleTap = useCallback((clientX: number, clientY: number) => {
    if (!containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 2 - 1;
    const y = 1 - ((clientY - rect.top) / rect.height) * 2;
    
    onCapture(x, y);
  }, [onCapture]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    handleTap(e.clientX, e.clientY);
  }, [handleTap]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    const touch = e.changedTouches[0];
    handleTap(touch.clientX, touch.clientY);
  }, [handleTap]);

  // Convert normalized coordinates to percentage for positioning
  const toPercent = (val: number) => ((val + 1) / 2) * 100;

  // Calculate strike zone box position
  const zoneLeft = toPercent(STRIKE_ZONE.ZONE_LEFT);
  const zoneRight = 100 - toPercent(STRIKE_ZONE.ZONE_RIGHT);
  const zoneTop = 100 - toPercent(STRIKE_ZONE.ZONE_TOP);
  const zoneBottom = toPercent(STRIKE_ZONE.ZONE_BOTTOM);

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Header with recording indicator and cancel */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between p-4 bg-gradient-to-b from-black/70 to-transparent">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-destructive rounded-full animate-pulse" />
          <span className="text-white font-semibold text-sm">REC</span>
        </div>
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={onCancel}
          className="text-white hover:bg-white/20"
        >
          <X className="w-6 h-6" />
        </Button>
      </div>

      {/* Video container with overlay */}
      <div 
        ref={containerRef}
        className="flex-1 relative touch-none cursor-crosshair"
        onClick={handleClick}
        onTouchEnd={handleTouchEnd}
      >
        {/* Live camera feed */}
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover"
          autoPlay
          playsInline
          muted
          onLoadedMetadata={handleVideoReady}
        />

        {/* Strike zone overlay - 20% opacity */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <div 
            className="relative w-[70%] max-w-[400px]"
            style={{ aspectRatio: `${STRIKE_ZONE.ASPECT_RATIO}` }}
          >
            {/* Background grid */}
            <div className="absolute inset-0 opacity-10">
              <div 
                className="w-full h-full grid"
                style={{
                  gridTemplateColumns: `repeat(${GRID_CONFIG.COLS}, 1fr)`,
                  gridTemplateRows: `repeat(${GRID_CONFIG.ROWS}, 1fr)`,
                }}
              >
                {Array.from({ length: GRID_CONFIG.COLS * GRID_CONFIG.ROWS }).map((_, i) => (
                  <div key={i} className="border border-white/30" />
                ))}
              </div>
            </div>

            {/* Strike zone box - 20% opacity */}
            <div
              className="absolute border-2 border-white/60 bg-white/20"
              style={{
                left: `${zoneLeft}%`,
                right: `${zoneRight}%`,
                top: `${zoneTop}%`,
                bottom: `${zoneBottom}%`,
              }}
            >
              {/* Inner grid lines for the strike zone (9-zone layout) */}
              <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 opacity-40">
                {Array.from({ length: 9 }).map((_, i) => (
                  <div key={i} className="border border-white/30" />
                ))}
              </div>
            </div>

            {/* Zone labels */}
            <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs text-white/70 font-medium">High</span>
            <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs text-white/70 font-medium">Low</span>
            <span className="absolute top-1/2 -left-8 -translate-y-1/2 text-xs text-white/70 font-medium">In</span>
            <span className="absolute top-1/2 -right-8 -translate-y-1/2 text-xs text-white/70 font-medium">Out</span>
          </div>
        </div>

        {/* Tap instruction at bottom */}
        <div className="absolute bottom-0 left-0 right-0 z-20 p-6 bg-gradient-to-t from-black/70 to-transparent">
          <p className="text-white text-center text-lg font-medium">
            Tap pitch location to stop recording
          </p>
          <p className="text-white/60 text-center text-sm mt-1">
            The zone overlay shows where to aim
          </p>
        </div>
      </div>
    </div>
  );
}
