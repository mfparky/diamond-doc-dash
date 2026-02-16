import { useRef, useState } from 'react';
import { PitchLocation, PitchTypeConfig, PITCH_TYPE_COLORS, DEFAULT_PITCH_TYPES } from '@/types/pitch-location';
import { getZoneSizeClasses, getZoneAspectStyle, STRIKE_ZONE, GRID_CONFIG } from '@/lib/strike-zone';

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

  // Get unique pitch types in the data
  const usedPitchTypes = [...new Set(pitchLocations.map(p => p.pitchType))].sort();

  // Calculate strike zone box position (CSS positioning)
  const zoneLeft = toPercent(STRIKE_ZONE.ZONE_LEFT);
  const zoneRight = 100 - toPercent(STRIKE_ZONE.ZONE_RIGHT);
  const zoneTop = 100 - toPercent(STRIKE_ZONE.ZONE_TOP);
  const zoneBottom = toPercent(STRIKE_ZONE.ZONE_BOTTOM);

  return (
    <div className="space-y-3">
      <div
        ref={containerRef}
        className={`relative bg-secondary/30 rounded-lg border border-border/50 ${
          interactive ? 'cursor-crosshair hover:bg-secondary/40' : ''
        }`}
        style={getZoneAspectStyle(size)}
        onClick={handleClick}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {/* Background grid - finer resolution for better pitch proximity */}
        <div className="absolute inset-0 opacity-20">
          <div 
            className="w-full h-full grid"
            style={{
              gridTemplateColumns: `repeat(${GRID_CONFIG.COLS}, 1fr)`,
              gridTemplateRows: `repeat(${GRID_CONFIG.ROWS}, 1fr)`,
            }}
          >
            {Array.from({ length: GRID_CONFIG.COLS * GRID_CONFIG.ROWS }).map((_, i) => (
              <div key={i} className="border border-muted-foreground/30" />
            ))}
          </div>
        </div>

        {/* Strike zone box - using accurate MLB proportions */}
        <div
          className="absolute border-2 border-foreground/80 bg-primary/5"
          style={{
            left: `${zoneLeft}%`,
            right: `${zoneRight}%`,
            top: `${zoneTop}%`,
            bottom: `${zoneBottom}%`,
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
