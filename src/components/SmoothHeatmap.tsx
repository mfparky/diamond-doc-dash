import { useEffect, useRef, useMemo } from 'react';
import { PitchLocation } from '@/types/pitch-location';
import { STRIKE_ZONE, getZoneAspectStyle } from '@/lib/strike-zone';

interface SmoothHeatmapProps {
  pitchLocations: PitchLocation[];
  size?: 'sm' | 'md' | 'lg';
  showLegend?: boolean;
}

// Color stops for the gradient (transparent -> blue -> cyan -> green -> yellow -> orange -> red)
// Low density = transparent, high density = red
const COLOR_STOPS = [
  { threshold: 0, color: [0, 100, 255], alpha: 0 },        // transparent (no data)
  { threshold: 0.05, color: [0, 100, 255], alpha: 0.3 },   // light blue, low opacity
  { threshold: 0.15, color: [0, 150, 255], alpha: 0.5 },   // blue
  { threshold: 0.25, color: [0, 200, 255], alpha: 0.65 },  // cyan-blue
  { threshold: 0.35, color: [0, 255, 200], alpha: 0.75 },  // cyan-green
  { threshold: 0.45, color: [0, 255, 100], alpha: 0.8 },   // green-cyan
  { threshold: 0.55, color: [100, 255, 0], alpha: 0.85 },  // green
  { threshold: 0.65, color: [200, 255, 0], alpha: 0.9 },   // lime
  { threshold: 0.75, color: [255, 220, 0], alpha: 0.92 },  // yellow
  { threshold: 0.85, color: [255, 150, 0], alpha: 0.95 },  // orange
  { threshold: 1.0, color: [255, 50, 0], alpha: 1 },       // red (highest)
];

function interpolateColor(value: number): [number, number, number, number] {
  // Clamp value between 0 and 1
  value = Math.max(0, Math.min(1, value));
  
  // Find the two color stops to interpolate between
  let lowerStop = COLOR_STOPS[0];
  let upperStop = COLOR_STOPS[COLOR_STOPS.length - 1];
  
  for (let i = 0; i < COLOR_STOPS.length - 1; i++) {
    if (value >= COLOR_STOPS[i].threshold && value <= COLOR_STOPS[i + 1].threshold) {
      lowerStop = COLOR_STOPS[i];
      upperStop = COLOR_STOPS[i + 1];
      break;
    }
  }
  
  // Calculate interpolation factor
  const range = upperStop.threshold - lowerStop.threshold;
  const t = range > 0 ? (value - lowerStop.threshold) / range : 0;
  
  // Interpolate RGB and alpha values
  return [
    Math.round(lowerStop.color[0] + t * (upperStop.color[0] - lowerStop.color[0])),
    Math.round(lowerStop.color[1] + t * (upperStop.color[1] - lowerStop.color[1])),
    Math.round(lowerStop.color[2] + t * (upperStop.color[2] - lowerStop.color[2])),
    Math.round((lowerStop.alpha + t * (upperStop.alpha - lowerStop.alpha)) * 255),
  ];
}

export function SmoothHeatmap({ 
  pitchLocations, 
  size = 'md',
  showLegend = true 
}: SmoothHeatmapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Canvas dimensions based on size
  const dimensions = useMemo(() => {
    switch (size) {
      case 'sm': return { width: 200, height: 259 };
      case 'lg': return { width: 380, height: 492 };
      default: return { width: 300, height: 388 };
    }
  }, [size]);

  // Calculate strike zone box position
  const toPercent = (val: number) => ((val + 1) / 2) * 100;
  const zoneLeft = toPercent(STRIKE_ZONE.ZONE_LEFT);
  const zoneRight = 100 - toPercent(STRIKE_ZONE.ZONE_RIGHT);
  const zoneTop = 100 - toPercent(STRIKE_ZONE.ZONE_TOP);
  const zoneBottom = toPercent(STRIKE_ZONE.ZONE_BOTTOM);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = dimensions;
    
    // Set canvas size (use higher resolution for smoother gradients)
    const scale = 2;
    canvas.width = width * scale;
    canvas.height = height * scale;
    ctx.scale(scale, scale);

    // Clear canvas with transparent background
    ctx.clearRect(0, 0, width, height);

    // Draw strike zone background
    const zoneLeftPx = (zoneLeft / 100) * width;
    const zoneRightPx = width - (zoneRight / 100) * width;
    const zoneTopPx = (zoneTop / 100) * height;
    const zoneBottomPx = height - (zoneBottom / 100) * height;

    // Subtle background for entire zone area
    ctx.fillStyle = 'rgba(100, 100, 120, 0.15)';
    ctx.fillRect(0, 0, width, height);

    if (pitchLocations.length === 0) {
      // Draw strike zone outline even with no data
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.lineWidth = 2;
      ctx.strokeRect(zoneLeftPx, zoneTopPx, zoneRightPx - zoneLeftPx, zoneBottomPx - zoneTopPx);
      return;
    }

    // Create density grid with higher resolution
    const gridSize = 120; // Increased for better accuracy
    const densityGrid: number[][] = Array.from({ length: gridSize }, () => 
      Array.from({ length: gridSize }, () => 0)
    );

    // Smaller influence radius for more accurate pitch representation
    const influenceRadius = 6;

    // Add density for each pitch with Gaussian falloff
    pitchLocations.forEach((pitch) => {
      // Convert -1 to 1 range to 0 to gridSize-1
      // X: -1 = left edge, 1 = right edge
      const centerX = ((pitch.xLocation + 1) / 2) * (gridSize - 1);
      // Y: 1 = top (high), -1 = bottom (low) - canvas Y is inverted
      const centerY = ((1 - pitch.yLocation) / 2) * (gridSize - 1);

      // Add influence in a circular area around the pitch
      for (let dy = -influenceRadius; dy <= influenceRadius; dy++) {
        for (let dx = -influenceRadius; dx <= influenceRadius; dx++) {
          const x = Math.round(centerX) + dx;
          const y = Math.round(centerY) + dy;
          
          if (x >= 0 && x < gridSize && y >= 0 && y < gridSize) {
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance <= influenceRadius) {
              // Tighter Gaussian falloff for more accurate representation
              const sigma = influenceRadius / 3;
              const weight = Math.exp(-(distance * distance) / (2 * sigma * sigma));
              densityGrid[y][x] += weight;
            }
          }
        }
      }
    });

    // Find max density for normalization
    let maxDensity = 0;
    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        maxDensity = Math.max(maxDensity, densityGrid[y][x]);
      }
    }

    // Apply fewer blur passes for more accurate representation
    const blurPasses = 2;
    for (let pass = 0; pass < blurPasses; pass++) {
      const tempGrid: number[][] = Array.from({ length: gridSize }, () => 
        Array.from({ length: gridSize }, () => 0)
      );
      
      for (let y = 1; y < gridSize - 1; y++) {
        for (let x = 1; x < gridSize - 1; x++) {
          // 3x3 Gaussian kernel
          tempGrid[y][x] = (
            densityGrid[y-1][x-1] * 0.0625 +
            densityGrid[y-1][x] * 0.125 +
            densityGrid[y-1][x+1] * 0.0625 +
            densityGrid[y][x-1] * 0.125 +
            densityGrid[y][x] * 0.25 +
            densityGrid[y][x+1] * 0.125 +
            densityGrid[y+1][x-1] * 0.0625 +
            densityGrid[y+1][x] * 0.125 +
            densityGrid[y+1][x+1] * 0.0625
          );
        }
      }
      
      // Copy edges
      for (let x = 0; x < gridSize; x++) {
        tempGrid[0][x] = densityGrid[0][x] * 0.5;
        tempGrid[gridSize-1][x] = densityGrid[gridSize-1][x] * 0.5;
      }
      for (let y = 0; y < gridSize; y++) {
        tempGrid[y][0] = densityGrid[y][0] * 0.5;
        tempGrid[y][gridSize-1] = densityGrid[y][gridSize-1] * 0.5;
      }
      
      for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
          densityGrid[y][x] = tempGrid[y][x];
        }
      }
    }

    // Create image data
    const imageData = ctx.createImageData(width, height);

    // Render with bilinear interpolation for smooth color transitions
    for (let py = 0; py < height; py++) {
      for (let px = 0; px < width; px++) {
        // Map pixel to grid coordinates with sub-pixel precision
        const gx = (px / width) * (gridSize - 1);
        const gy = (py / height) * (gridSize - 1);
        
        const x0 = Math.floor(gx);
        const y0 = Math.floor(gy);
        const x1 = Math.min(x0 + 1, gridSize - 1);
        const y1 = Math.min(y0 + 1, gridSize - 1);
        
        const xFrac = gx - x0;
        const yFrac = gy - y0;
        
        // Bilinear interpolation
        const density = 
          densityGrid[y0][x0] * (1 - xFrac) * (1 - yFrac) +
          densityGrid[y0][x1] * xFrac * (1 - yFrac) +
          densityGrid[y1][x0] * (1 - xFrac) * yFrac +
          densityGrid[y1][x1] * xFrac * yFrac;
        
        // Normalize with slight gamma correction for better visual distribution
        const normalizedDensity = maxDensity > 0 ? Math.pow(density / maxDensity, 0.8) : 0;
        const [r, g, b, a] = interpolateColor(normalizedDensity);
        
        const idx = (py * width + px) * 4;
        imageData.data[idx] = r;
        imageData.data[idx + 1] = g;
        imageData.data[idx + 2] = b;
        imageData.data[idx + 3] = a;
      }
    }

    // Put image data
    ctx.putImageData(imageData, 0, 0);

    // Draw strike zone outline
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = 2;
    ctx.strokeRect(zoneLeftPx, zoneTopPx, zoneRightPx - zoneLeftPx, zoneBottomPx - zoneTopPx);

    // Draw grid lines within strike zone
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1;
    
    const zoneWidth = zoneRightPx - zoneLeftPx;
    const zoneHeight = zoneBottomPx - zoneTopPx;
    
    // Vertical lines (3 columns)
    for (let i = 1; i < 3; i++) {
      const x = zoneLeftPx + (zoneWidth / 3) * i;
      ctx.beginPath();
      ctx.moveTo(x, zoneTopPx);
      ctx.lineTo(x, zoneBottomPx);
      ctx.stroke();
    }
    
    // Horizontal lines (3 rows)
    for (let i = 1; i < 3; i++) {
      const y = zoneTopPx + (zoneHeight / 3) * i;
      ctx.beginPath();
      ctx.moveTo(zoneLeftPx, y);
      ctx.lineTo(zoneRightPx, y);
      ctx.stroke();
    }

  }, [pitchLocations, dimensions, zoneLeft, zoneRight, zoneTop, zoneBottom]);

  return (
    <div className="space-y-3">
      <div 
        className="relative rounded-lg border border-border/50 overflow-hidden bg-secondary/30"
        style={getZoneAspectStyle(size)}
      >
        <canvas
          ref={canvasRef}
          style={{
            width: dimensions.width,
            height: dimensions.height,
          }}
          className="block"
        />
        
        {/* Zone labels */}
        <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-xs text-muted-foreground">High</span>
        <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-xs text-muted-foreground">Low</span>
        <span className="absolute top-1/2 -left-6 -translate-y-1/2 text-xs text-muted-foreground">In</span>
        <span className="absolute top-1/2 -right-8 -translate-y-1/2 text-xs text-muted-foreground">Out</span>
      </div>

      {/* Stats summary */}
      <div className="text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{pitchLocations.length}</span> pitches plotted
        {pitchLocations.length > 0 && (
          <span className="ml-2">
            • <span className="font-medium text-foreground">
              {pitchLocations.filter(p => p.isStrike).length}
            </span> strikes ({((pitchLocations.filter(p => p.isStrike).length / pitchLocations.length) * 100).toFixed(0)}%)
          </span>
        )}
      </div>

      {/* Color legend */}
      {showLegend && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Low</span>
          <div className="flex h-3 flex-1 max-w-[150px] rounded overflow-hidden border border-border/30">
            <div className="flex-1" style={{ backgroundColor: 'rgba(0, 100, 255, 0.3)' }} />
            <div className="flex-1" style={{ backgroundColor: 'rgba(0, 255, 200, 0.7)' }} />
            <div className="flex-1" style={{ backgroundColor: 'rgba(100, 255, 0, 0.85)' }} />
            <div className="flex-1" style={{ backgroundColor: 'rgba(255, 220, 0, 0.92)' }} />
            <div className="flex-1" style={{ backgroundColor: 'rgba(255, 150, 0, 0.95)' }} />
            <div className="flex-1" style={{ backgroundColor: 'rgb(255, 50, 0)' }} />
          </div>
          <span>High</span>
        </div>
      )}
    </div>
  );
}
