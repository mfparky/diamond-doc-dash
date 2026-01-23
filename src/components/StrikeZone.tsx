import { useRef, useState } from 'react';
import { PitchLocation, PitchTypeConfig, PITCH_TYPE_COLORS, DEFAULT_PITCH_TYPES } from '@/types/pitch-location';

interface StrikeZoneProps {
  pitchLocations: PitchLocation[];
  pitchTypes?: PitchTypeConfig;
  onPlotPitch?: (x: number, y: number) => void;
  interactive?: boolean;
  showLegend?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function StrikeZone({
  pitchLocations,
  pitchTypes = DEFAULT_PITCH_TYPES,
  onPlotPitch,
  interactive = false,
  showLegend = true,
  size = 'md',
}: StrikeZoneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);

  const sizeClasses = {
    sm: 'w-48 h-56',
    md: 'w-64 h-72',
    lg: 'w-80 h-96',
  };

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!interactive || !onPlotPitch || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    // Normalize to -1 to 1 range (centered on strike zone)
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = 1 - ((e.clientY - rect.top) / rect.height) * 2; // Invert Y so up is positive

    onPlotPitch(x, y);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!interactive || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = 1 - ((e.clientY - rect.top) / rect.height) * 2;
    setHoverPos({ x, y });
  };

  const handleMouseLeave = () => {
    setHoverPos(null);
  };

  // Convert normalized coordinates to percentage for positioning
  const toPercent = (val: number) => ((val + 1) / 2) * 100;

  // Check if a point is within the strike zone (roughly -0.4 to 0.4 horizontally, -0.3 to 0.5 vertically)
  const isInStrikeZone = (x: number, y: number) => {
    return x >= -0.4 && x <= 0.4 && y >= -0.3 && y <= 0.5;
  };

  // Get unique pitch types in the data
  const usedPitchTypes = [...new Set(pitchLocations.map(p => p.pitchType))].sort();

  return (
    <div className="space-y-3">
      <div
        ref={containerRef}
        className={`${sizeClasses[size]} relative bg-secondary/30 rounded-lg border border-border/50 ${
          interactive ? 'cursor-crosshair hover:bg-secondary/40' : ''
        }`}
        onClick={handleClick}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {/* Background grid */}
        <div className="absolute inset-0 opacity-20">
          <div className="w-full h-full grid grid-cols-5 grid-rows-5">
            {Array.from({ length: 25 }).map((_, i) => (
              <div key={i} className="border border-muted-foreground/30" />
            ))}
          </div>
        </div>

        {/* Strike zone box (centered, roughly 40% width and 40% height) */}
        <div
          className="absolute border-2 border-foreground/80 bg-primary/5"
          style={{
            left: '30%',
            right: '30%',
            top: '25%',
            bottom: '35%',
          }}
        />

        {/* Plotted pitches */}
        {pitchLocations.map((pitch) => (
          <div
            key={pitch.id}
            className="absolute w-3 h-3 rounded-full transform -translate-x-1/2 -translate-y-1/2 border border-white/50"
            style={{
              left: `${toPercent(pitch.xLocation)}%`,
              top: `${100 - toPercent(pitch.yLocation)}%`,
              backgroundColor: PITCH_TYPE_COLORS[pitch.pitchType.toString()] || PITCH_TYPE_COLORS["1"],
            }}
            title={`#${pitch.pitchNumber} - ${pitchTypes[pitch.pitchType.toString()] || `P${pitch.pitchType}`} - ${pitch.isStrike ? 'Strike' : 'Ball'}`}
          />
        ))}

        {/* Hover indicator */}
        {interactive && hoverPos && (
          <div
            className="absolute w-4 h-4 rounded-full border-2 border-dashed border-primary transform -translate-x-1/2 -translate-y-1/2 pointer-events-none"
            style={{
              left: `${toPercent(hoverPos.x)}%`,
              top: `${100 - toPercent(hoverPos.y)}%`,
            }}
          />
        )}

        {/* Zone labels */}
        <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-xs text-muted-foreground">High</span>
        <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-xs text-muted-foreground">Low</span>
        <span className="absolute top-1/2 -left-6 -translate-y-1/2 text-xs text-muted-foreground">In</span>
        <span className="absolute top-1/2 -right-8 -translate-y-1/2 text-xs text-muted-foreground">Out</span>
      </div>

      {/* Legend */}
      {showLegend && usedPitchTypes.length > 0 && (
        <div className="flex flex-wrap gap-3 text-xs">
          {usedPitchTypes.map((pt) => (
            <div key={pt} className="flex items-center gap-1.5">
              <div
                className="w-3 h-3 rounded-full border border-white/30"
                style={{ backgroundColor: PITCH_TYPE_COLORS[pt.toString()] }}
              />
              <span className="text-muted-foreground">{pitchTypes[pt.toString()] || `P${pt}`}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
