import { useMemo } from 'react';
import { PitchLocation, PitchTypeConfig, DEFAULT_PITCH_TYPES, PITCH_TYPE_COLORS } from '@/types/pitch-location';
import { getZoneSizeClasses, getZoneAspectStyle, STRIKE_ZONE, GRID_CONFIG } from '@/lib/strike-zone';

interface StrikeZoneHeatmapProps {
  pitchLocations: PitchLocation[];
  pitchTypes?: PitchTypeConfig;
  showLegend?: boolean;
  size?: 'sm' | 'md' | 'lg';
  filterPitchType?: number | null;
}

export function StrikeZoneHeatmap({
  pitchLocations,
  pitchTypes = DEFAULT_PITCH_TYPES,
  showLegend = true,
  size = 'md',
  filterPitchType = null,
}: StrikeZoneHeatmapProps) {
  // Convert normalized coordinates to percentage for positioning
  const toPercent = (val: number) => ((val + 1) / 2) * 100;

  // Calculate strike zone box position (CSS positioning)
  const zoneLeft = toPercent(STRIKE_ZONE.ZONE_LEFT);
  const zoneRight = 100 - toPercent(STRIKE_ZONE.ZONE_RIGHT);
  const zoneTop = 100 - toPercent(STRIKE_ZONE.ZONE_TOP);
  const zoneBottom = toPercent(STRIKE_ZONE.ZONE_BOTTOM);

  // Filter pitches by type if specified
  const filteredPitches = useMemo(() => {
    if (filterPitchType === null) return pitchLocations;
    return pitchLocations.filter(p => p.pitchType === filterPitchType);
  }, [pitchLocations, filterPitchType]);

  // Create heatmap grid - higher resolution for better proximity
  const heatmapData = useMemo(() => {
    const gridCols = GRID_CONFIG.HEATMAP_COLS;
    const gridRows = GRID_CONFIG.HEATMAP_ROWS;
    const grid: number[][] = Array.from({ length: gridRows }, () => 
      Array.from({ length: gridCols }, () => 0)
    );

    filteredPitches.forEach((pitch) => {
      // Convert -1 to 1 range to 0 to gridSize-1 index
      const xIndex = Math.min(gridCols - 1, Math.max(0, Math.floor(((pitch.xLocation + 1) / 2) * gridCols)));
      const yIndex = Math.min(gridRows - 1, Math.max(0, Math.floor(((1 - pitch.yLocation) / 2) * gridRows)));
      
      grid[yIndex][xIndex]++;
    });

    const maxCount = Math.max(...grid.flat(), 1);
    return { grid, maxCount, gridCols, gridRows };
  }, [filteredPitches]);

  // Get color intensity based on count
  const getHeatColor = (count: number) => {
    if (count === 0) return 'transparent';
    const intensity = count / heatmapData.maxCount;
    
    // Green to Yellow to Red gradient
    if (intensity < 0.33) {
      return `hsla(142, 70%, 50%, ${0.2 + intensity * 0.8})`;
    } else if (intensity < 0.66) {
      return `hsla(60, 80%, 50%, ${0.3 + intensity * 0.6})`;
    } else {
      return `hsla(0, 80%, 50%, ${0.4 + intensity * 0.5})`;
    }
  };

  // Get unique pitch types in the data
  const usedPitchTypes = [...new Set(pitchLocations.map(p => p.pitchType))].sort();

  return (
    <div className="space-y-3">
      <div 
        className={`${getZoneSizeClasses(size)} relative bg-secondary/30 rounded-lg border border-border/50 overflow-hidden`}
        style={getZoneAspectStyle()}
      >
        {/* Heatmap grid - higher resolution */}
        <div 
          className="absolute inset-0 grid"
          style={{
            gridTemplateColumns: `repeat(${heatmapData.gridCols}, 1fr)`,
            gridTemplateRows: `repeat(${heatmapData.gridRows}, 1fr)`,
          }}
        >
          {heatmapData.grid.map((row, rowIndex) =>
            row.map((count, colIndex) => (
              <div
                key={`${rowIndex}-${colIndex}`}
                className="transition-colors duration-200"
                style={{ backgroundColor: getHeatColor(count) }}
                title={`${count} pitch${count !== 1 ? 'es' : ''}`}
              />
            ))
          )}
        </div>

        {/* Strike zone box overlay - using accurate MLB proportions */}
        <div
          className="absolute border-2 border-foreground/80 pointer-events-none"
          style={{
            left: `${zoneLeft}%`,
            right: `${zoneRight}%`,
            top: `${zoneTop}%`,
            bottom: `${zoneBottom}%`,
          }}
        />

        {/* Zone labels */}
        <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-xs text-muted-foreground">High</span>
        <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-xs text-muted-foreground">Low</span>
        <span className="absolute top-1/2 -left-6 -translate-y-1/2 text-xs text-muted-foreground">In</span>
        <span className="absolute top-1/2 -right-8 -translate-y-1/2 text-xs text-muted-foreground">Out</span>
      </div>

      {/* Stats summary */}
      <div className="text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{filteredPitches.length}</span> pitches plotted
        {filteredPitches.length > 0 && (
          <span className="ml-2">
            • <span className="font-medium text-foreground">
              {filteredPitches.filter(p => p.isStrike).length}
            </span> strikes ({((filteredPitches.filter(p => p.isStrike).length / filteredPitches.length) * 100).toFixed(0)}%)
          </span>
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

      {/* Heatmap intensity legend */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>Low</span>
        <div className="flex h-3 rounded overflow-hidden">
          <div className="w-6" style={{ backgroundColor: 'hsla(142, 70%, 50%, 0.4)' }} />
          <div className="w-6" style={{ backgroundColor: 'hsla(60, 80%, 50%, 0.5)' }} />
          <div className="w-6" style={{ backgroundColor: 'hsla(0, 80%, 50%, 0.7)' }} />
        </div>
        <span>High</span>
      </div>
    </div>
  );
}
