import { useEffect, useRef, useMemo } from 'react';
import { PitchLocation } from '@/types/pitch-location';
import { STRIKE_ZONE, getZoneAspectStyle } from '@/lib/strike-zone';

interface SmoothHeatmapProps {
  pitchLocations: PitchLocation[];
  size?: 'sm' | 'md' | 'lg';
  showLegend?: boolean;
}

// Color stops for the gradient (magenta -> blue -> cyan -> green -> yellow -> orange -> red)
const COLOR_STOPS = [
  { threshold: 0, color: [255, 0, 255] },      // magenta (lowest)
  { threshold: 0.15, color: [128, 0, 255] },   // purple
  { threshold: 0.25, color: [0, 0, 255] },     // blue
  { threshold: 0.35, color: [0, 128, 255] },   // light blue
  { threshold: 0.45, color: [0, 255, 255] },   // cyan
  { threshold: 0.55, color: [0, 255, 128] },   // teal
  { threshold: 0.65, color: [0, 255, 0] },     // green
  { threshold: 0.75, color: [255, 255, 0] },   // yellow
  { threshold: 0.85, color: [255, 128, 0] },   // orange
  { threshold: 1.0, color: [255, 0, 0] },      // red (highest)
];

function interpolateColor(value: number): [number, number, number] {
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
  
  // Interpolate RGB values
  return [
    Math.round(lowerStop.color[0] + t * (upperStop.color[0] - lowerStop.color[0])),
    Math.round(lowerStop.color[1] + t * (upperStop.color[1] - lowerStop.color[1])),
    Math.round(lowerStop.color[2] + t * (upperStop.color[2] - lowerStop.color[2])),
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

    // Clear canvas with background color
    ctx.fillStyle = 'rgb(255, 0, 255)'; // Magenta background for "no data"
    ctx.fillRect(0, 0, width, height);

    if (pitchLocations.length === 0) {
      return;
    }

    // Create density grid with higher resolution
    const gridSize = 100;
    const densityGrid: number[][] = Array.from({ length: gridSize }, () => 
      Array.from({ length: gridSize }, () => 0)
    );

    // Radius for each pitch point influence (in grid units)
    const influenceRadius = 8;

    // Add density for each pitch with Gaussian falloff
    pitchLocations.forEach((pitch) => {
      // Convert -1 to 1 range to 0 to gridSize-1
      const centerX = Math.floor(((pitch.xLocation + 1) / 2) * gridSize);
      const centerY = Math.floor(((1 - pitch.yLocation) / 2) * gridSize);

      // Add influence in a circular area around the pitch
      for (let dy = -influenceRadius; dy <= influenceRadius; dy++) {
        for (let dx = -influenceRadius; dx <= influenceRadius; dx++) {
          const x = centerX + dx;
          const y = centerY + dy;
          
          if (x >= 0 && x < gridSize && y >= 0 && y < gridSize) {
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance <= influenceRadius) {
              // Gaussian falloff
              const sigma = influenceRadius / 2.5;
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

    // Apply multi-pass blur for smoother gradients
    const blurPasses = 3;
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
      
      for (let y = 1; y < gridSize - 1; y++) {
        for (let x = 1; x < gridSize - 1; x++) {
          densityGrid[y][x] = tempGrid[y][x];
        }
      }
    }

    // Create image data
    const imageData = ctx.createImageData(width, height);
    const cellWidth = width / gridSize;
    const cellHeight = height / gridSize;

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
        
        // Normalize and get color
        const normalizedDensity = maxDensity > 0 ? density / maxDensity : 0;
        const [r, g, b] = interpolateColor(normalizedDensity);
        
        const idx = (py * width + px) * 4;
        imageData.data[idx] = r;
        imageData.data[idx + 1] = g;
        imageData.data[idx + 2] = b;
        imageData.data[idx + 3] = 255; // Full opacity
      }
    }

    // Put image data
    ctx.putImageData(imageData, 0, 0);

    // Draw strike zone outline
    const zoneLeftPx = (zoneLeft / 100) * width;
    const zoneRightPx = width - (zoneRight / 100) * width;
    const zoneTopPx = (zoneTop / 100) * height;
    const zoneBottomPx = height - (zoneBottom / 100) * height;

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
        className="relative rounded-lg border border-border/50 overflow-hidden"
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
          <div className="flex h-3 flex-1 max-w-[150px] rounded overflow-hidden">
            <div className="flex-1" style={{ backgroundColor: 'rgb(255, 0, 255)' }} />
            <div className="flex-1" style={{ backgroundColor: 'rgb(0, 0, 255)' }} />
            <div className="flex-1" style={{ backgroundColor: 'rgb(0, 255, 255)' }} />
            <div className="flex-1" style={{ backgroundColor: 'rgb(0, 255, 0)' }} />
            <div className="flex-1" style={{ backgroundColor: 'rgb(255, 255, 0)' }} />
            <div className="flex-1" style={{ backgroundColor: 'rgb(255, 0, 0)' }} />
          </div>
          <span>High</span>
        </div>
      )}
    </div>
  );
}
