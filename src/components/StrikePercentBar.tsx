import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Target } from 'lucide-react';

interface PitcherSeasonSummary {
  strikePercent: number;
  strikePitches: number;
}

interface StrikePercentBarProps {
  pitcherSeasons: PitcherSeasonSummary[];
}

const ZONE_COLORS = [
  { min: 0, max: 45, color: 'hsl(var(--destructive))' },
  { min: 45, max: 50, color: 'hsl(var(--warning))' },
  { min: 50, max: 55, color: 'hsl(38, 92%, 50%)' },
  { min: 55, max: 60, color: 'hsl(var(--primary))' },
  { min: 60, max: 100, color: 'hsl(142, 60%, 42%)' },
];

function getDotColor(pct: number) {
  for (const zone of ZONE_COLORS) {
    if (pct >= zone.min && pct < zone.max) return zone.color;
  }
  return ZONE_COLORS[ZONE_COLORS.length - 1].color;
}

export function StrikePercentBar({ pitcherSeasons }: StrikePercentBarProps) {
  const data = useMemo(() => {
    const eligible = pitcherSeasons
      .filter((p) => p.strikePitches >= 10)
      .map((p) => Math.round(p.strikePercent * 10) / 10)
      .sort((a, b) => a - b);

    if (eligible.length < 2) return null;

    const avg = Math.round((eligible.reduce((s, v) => s + v, 0) / eligible.length) * 10) / 10;
    const min = eligible[0];
    const max = eligible[eligible.length - 1];

    // Spread dots vertically to avoid overlap (beeswarm-style)
    // Group by proximity and offset y
    const dots: { x: number; y: number; color: string }[] = [];
    const PROXIMITY = 2; // % proximity for stacking

    eligible.forEach((pct) => {
      // Count how many existing dots are near this value
      const nearbyCount = dots.filter((d) => Math.abs(d.x - pct) < PROXIMITY).length;
      // Alternate above/below center
      const yOffset = nearbyCount === 0 ? 0 : (Math.ceil(nearbyCount / 2)) * (nearbyCount % 2 === 1 ? -1 : 1);
      dots.push({ x: pct, y: yOffset, color: getDotColor(pct) });
    });

    return { dots, avg, min, max, count: eligible.length };
  }, [pitcherSeasons]);

  if (!data) return null;

  // Chart bounds
  const rangeMin = Math.max(0, Math.floor(data.min / 5) * 5 - 5);
  const rangeMax = Math.min(100, Math.ceil(data.max / 5) * 5 + 5);
  const ticks: number[] = [];
  for (let t = rangeMin; t <= rangeMax; t += 5) ticks.push(t);

  const toX = (pct: number) => ((pct - rangeMin) / (rangeMax - rangeMin)) * 100;
  const maxYOffset = Math.max(...data.dots.map((d) => Math.abs(d.y)), 1);

  return (
    <Card className="glass-card">
      <CardHeader className="pb-2 px-3 sm:px-6">
        <div className="flex items-center justify-between">
          <CardTitle className="font-display text-base sm:text-lg flex items-center gap-2">
            <Target className="w-4 h-4 sm:w-5 sm:h-5 text-accent" />
            Team Strike %
          </CardTitle>
          <span className="text-xs text-muted-foreground">
            Avg: <span className="font-semibold text-foreground">{data.avg}%</span>
          </span>
        </div>
      </CardHeader>
      <CardContent className="px-3 sm:px-6">
        {/* Dot strip chart */}
        <div className="relative w-full" style={{ height: '100px' }}>
          <svg
            viewBox={`0 0 100 50`}
            preserveAspectRatio="none"
            className="w-full h-full"
            style={{ overflow: 'visible' }}
          >
            {/* Background zones */}
            {ZONE_COLORS.map((zone, i) => {
              const x1 = toX(Math.max(zone.min, rangeMin));
              const x2 = toX(Math.min(zone.max, rangeMax));
              if (x2 <= x1) return null;
              return (
                <rect
                  key={i}
                  x={x1}
                  y={10}
                  width={x2 - x1}
                  height={30}
                  fill={zone.color}
                  opacity={0.08}
                  rx={0}
                />
              );
            })}

            {/* Center line */}
            <line x1={0} y1={25} x2={100} y2={25} stroke="hsl(var(--border))" strokeWidth={0.3} />

            {/* Average marker */}
            <line
              x1={toX(data.avg)}
              y1={8}
              x2={toX(data.avg)}
              y2={42}
              stroke="hsl(var(--muted-foreground))"
              strokeWidth={0.4}
              strokeDasharray="1 1"
            />

            {/* Dots */}
            {data.dots.map((dot, i) => {
              const cx = toX(dot.x);
              const cy = 25 + (dot.y / (maxYOffset + 0.5)) * 10;
              return (
                <circle
                  key={i}
                  cx={cx}
                  cy={cy}
                  r={2.2}
                  fill={dot.color}
                  stroke="hsl(var(--card))"
                  strokeWidth={0.5}
                  opacity={0.9}
                >
                  <title>{dot.x}%</title>
                </circle>
              );
            })}
          </svg>

          {/* Tick labels */}
          <div className="absolute bottom-0 left-0 right-0 flex justify-between px-0">
            {ticks.map((t) => (
              <span
                key={t}
                className="text-[9px] text-muted-foreground"
                style={{ position: 'absolute', left: `${toX(t)}%`, transform: 'translateX(-50%)' }}
              >
                {t}%
              </span>
            ))}
          </div>
        </div>

        <p className="text-[10px] text-muted-foreground mt-1 text-center">
          {data.count} pitchers · each dot is one pitcher's season strike %
        </p>
      </CardContent>
    </Card>
  );
}
