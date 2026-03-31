import { useRef, useState, useMemo } from 'react';
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

  // Group pitches that share the same snapped position (within 0.05 of each other)
  // This handles both 1-to-1 scanned pitches (exact same coords) and manually plotted ones
  const pitchGroups = useMemo(() => {
    const groups: Array<{ x: number; y: number; pitches: typeof pitchLocations }> = [];
    for (const pitch of pitchLocations) {
      const existing = groups.find(
        g => Math.abs(g.x - pitch.xLocation) < 0.05 && Math.abs(g.y - pitch.yLocation) < 0.05
      );
      if (existing) {
        existing.pitches.push(pitch);
      } else {
        groups.push({ x: pitch.xLocation, y: pitch.yLocation, pitches: [pitch] });
      }
    }
    return groups;
  }, [pitchLocations]);

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

        {/* Strike zone box with inner 3×3 grid */}
        <div
          className="absolute border-2 border-foreground/80 bg-primary/5"
          style={{
            left: `${zoneLeft}%`,
            right: `${zoneRight}%`,
            top: `${zoneTop}%`,
            bottom: `${zoneBottom}%`,
          }}
        >
          {/* Vertical dividers */}
          <div className="absolute top-0 bottom-0 border-l border-foreground/30" style={{ left: '33.33%' }} />
          <div className="absolute top-0 bottom-0 border-l border-foreground/30" style={{ left: '66.66%' }} />
          {/* Horizontal dividers */}
          <div className="absolute left-0 right-0 border-t border-foreground/30" style={{ top: '33.33%' }} />
          <div className="absolute left-0 right-0 border-t border-foreground/30" style={{ top: '66.66%' }} />
        </div>

        {/* Plotted pitches — grouped by position, count badge when stacked */}
        {pitchGroups.map((group) => {
          const count = group.pitches.length;
          // Dominant pitch type = most frequent in this position
          const typeFreq = group.pitches.reduce<Record<string, number>>((acc, p) => {
            const k = p.pitchType.toString();
            acc[k] = (acc[k] ?? 0) + 1;
            return acc;
          }, {});
          const dominantType = Object.entries(typeFreq).sort((a, b) => b[1] - a[1])[0][0];
          const color = PITCH_TYPE_COLORS[dominantType] || PITCH_TYPE_COLORS["1"];
          // Scale dot size with count
          const sizeClass = count === 1 ? 'w-3 h-3 text-[0px]' : count <= 3 ? 'w-5 h-5 text-[9px]' : 'w-6 h-6 text-[9px]';
          const tooltip = group.pitches
            .map(p => `#${p.pitchNumber} ${pitchTypes[p.pitchType.toString()] || `P${p.pitchType}`} – ${p.isStrike ? 'Strike' : 'Ball'}`)
            .join('\n');

          return (
            <div
              key={`${group.x.toFixed(3)},${group.y.toFixed(3)}`}
              className={`absolute ${sizeClass} rounded-full transform -translate-x-1/2 -translate-y-1/2 border border-white/50 flex items-center justify-center font-bold text-white leading-none z-10`}
              style={{
                left: `${toPercent(group.x)}%`,
                top: `${100 - toPercent(group.y)}%`,
                backgroundColor: color,
              }}
              title={tooltip}
            >
              {count > 1 ? count : null}
            </div>
          );
        })}

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
