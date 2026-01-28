import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Gauge } from 'lucide-react';

interface VelocityScaleProps {
  velocities: number[];
  minRange?: number;
  maxRange?: number;
}

export function VelocityScale({ 
  velocities, 
  minRange = 45, 
  maxRange = 60 
}: VelocityScaleProps) {
  // Calculate velocity distribution and stats
  const { plotPoints, stats, densityPath } = useMemo(() => {
    if (velocities.length === 0) {
      return { plotPoints: [], stats: null, densityPath: '' };
    }

    const min = Math.min(...velocities);
    const max = Math.max(...velocities);
    const avg = Math.round(velocities.reduce((a, b) => a + b, 0) / velocities.length);

    // Count velocities at each mph value for density
    const counts: Record<number, number> = {};
    velocities.forEach(v => {
      const rounded = Math.round(v);
      counts[rounded] = (counts[rounded] || 0) + 1;
    });

    const maxCount = Math.max(...Object.values(counts));

    // Create plot points with vertical offset based on occurrence index
    const occurrenceIndex: Record<number, number> = {};
    const points = velocities.map((v) => {
      const rounded = Math.round(v);
      const idx = occurrenceIndex[rounded] || 0;
      occurrenceIndex[rounded] = idx + 1;
      
      // Calculate x position (0-100%)
      const x = ((v - minRange) / (maxRange - minRange)) * 100;
      
      // Calculate y offset for stacking (beeswarm effect)
      const count = counts[rounded];
      const yOffset = count > 1 ? (idx - (count - 1) / 2) * 8 : 0;
      
      return { 
        velocity: v, 
        x: Math.max(0, Math.min(100, x)), 
        yOffset,
        density: counts[rounded] / maxCount 
      };
    });

    // Generate smooth density curve path
    const curvePoints: { x: number; height: number }[] = [];
    for (let mph = minRange; mph <= maxRange; mph++) {
      const x = ((mph - minRange) / (maxRange - minRange)) * 100;
      
      // Gaussian smoothing: sum contributions from nearby velocities
      let density = 0;
      velocities.forEach(v => {
        const dist = Math.abs(v - mph);
        if (dist < 3) {
          density += Math.exp(-(dist * dist) / 2);
        }
      });
      
      const normalizedHeight = maxCount > 0 ? (density / (maxCount * 1.5)) * 40 : 0;
      curvePoints.push({ x, height: Math.min(normalizedHeight, 35) });
    }

    // Create SVG path for density curve
    let path = '';
    if (curvePoints.length > 0) {
      // Top curve
      path = `M 0,50 `;
      curvePoints.forEach((p, i) => {
        if (i === 0) {
          path += `L ${p.x},${50 - p.height} `;
        } else {
          const prev = curvePoints[i - 1];
          const cpx = (prev.x + p.x) / 2;
          path += `Q ${cpx},${50 - prev.height} ${p.x},${50 - p.height} `;
        }
      });
      path += `L 100,50 `;
      
      // Bottom curve (mirror)
      for (let i = curvePoints.length - 1; i >= 0; i--) {
        const p = curvePoints[i];
        if (i === curvePoints.length - 1) {
          path += `L ${p.x},${50 + p.height} `;
        } else {
          const next = curvePoints[i + 1];
          const cpx = (next.x + p.x) / 2;
          path += `Q ${cpx},${50 + next.height} ${p.x},${50 + p.height} `;
        }
      }
      path += `L 0,50 Z`;
    }

    return {
      plotPoints: points,
      stats: { min, max, avg, count: velocities.length },
      densityPath: path,
    };
  }, [velocities, minRange, maxRange]);

  if (velocities.length === 0) {
    return null;
  }

  // Generate tick marks
  const ticks = [];
  for (let mph = minRange; mph <= maxRange; mph += 5) {
    ticks.push(mph);
  }

  return (
    <Card className="glass-card">
      <CardHeader className="pb-2 px-3 sm:px-6">
        <CardTitle className="font-display text-base sm:text-lg flex items-center gap-2">
          <Gauge className="w-4 h-4 sm:w-5 sm:h-5 text-warning" />
          Velocity Distribution
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 sm:px-6">
        {/* Stats row */}
        {stats && (
          <div className="flex justify-between text-xs sm:text-sm mb-4">
            <div className="text-center">
              <p className="text-muted-foreground">Min</p>
              <p className="font-bold text-foreground">{stats.min}</p>
            </div>
            <div className="text-center">
              <p className="text-muted-foreground">Avg</p>
              <p className="font-bold text-primary">{stats.avg}</p>
            </div>
            <div className="text-center">
              <p className="text-muted-foreground">Max</p>
              <p className="font-bold text-foreground">{stats.max}</p>
            </div>
            <div className="text-center">
              <p className="text-muted-foreground">Count</p>
              <p className="font-bold text-foreground">{stats.count}</p>
            </div>
          </div>
        )}

        {/* Velocity visualization */}
        <div className="relative h-24 sm:h-28">
          <svg 
            viewBox="0 0 100 100" 
            preserveAspectRatio="none"
            className="absolute inset-0 w-full h-full"
          >
            {/* Density curve (violin shape) */}
            <defs>
              <linearGradient id="velocityGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="hsl(200, 80%, 50%)" stopOpacity="0.6" />
                <stop offset="50%" stopColor="hsl(45, 90%, 55%)" stopOpacity="0.6" />
                <stop offset="100%" stopColor="hsl(0, 80%, 55%)" stopOpacity="0.6" />
              </linearGradient>
            </defs>
            
            {densityPath && (
              <path
                d={densityPath}
                fill="url(#velocityGradient)"
                className="opacity-60"
              />
            )}

            {/* Center line */}
            <line
              x1="0"
              y1="50"
              x2="100"
              y2="50"
              stroke="hsl(var(--border))"
              strokeWidth="0.5"
            />

            {/* Tick marks */}
            {ticks.map((mph) => {
              const x = ((mph - minRange) / (maxRange - minRange)) * 100;
              return (
                <g key={mph}>
                  <line
                    x1={x}
                    y1="85"
                    x2={x}
                    y2="90"
                    stroke="hsl(var(--muted-foreground))"
                    strokeWidth="0.5"
                  />
                </g>
              );
            })}
          </svg>

          {/* Tick labels */}
          <div className="absolute bottom-0 left-0 right-0 flex justify-between px-0">
            {ticks.map((mph) => (
              <span 
                key={mph} 
                className="text-[10px] sm:text-xs text-muted-foreground"
                style={{ 
                  position: 'absolute',
                  left: `${((mph - minRange) / (maxRange - minRange)) * 100}%`,
                  transform: 'translateX(-50%)'
                }}
              >
                {mph}
              </span>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
