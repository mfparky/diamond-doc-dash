import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Target } from 'lucide-react';

interface PitcherSeasonSummary {
  strikePercent: number;
  strikePitches: number;
}

interface StrikePercentBeeswarmProps {
  pitcherSeasons: PitcherSeasonSummary[];
}

export function StrikePercentBeeswarm({ pitcherSeasons }: StrikePercentBeeswarmProps) {
  const data = useMemo(() => {
    const eligible = pitcherSeasons
      .filter((p) => p.strikePitches >= 10)
      .map((p) => Math.round(p.strikePercent * 10) / 10)
      .sort((a, b) => a - b);

    if (eligible.length < 2) return null;

    const avg = Math.round((eligible.reduce((s, v) => s + v, 0) / eligible.length) * 10) / 10;

    // Beeswarm layout: place dots along x-axis, stack vertically when overlapping
    const DOT_R = 6; // dot radius in SVG units
    const SPACING = DOT_R * 2.2; // min distance before stacking

    // Chart x range: 0-100%
    const xScale = (pct: number) => (pct / 100) * 280 + 30; // 30px margin, 280px usable

    interface Dot {
      pct: number;
      cx: number;
      cy: number;
    }

    const placed: Dot[] = [];

    eligible.forEach((pct) => {
      const cx = xScale(pct);
      // Find y offset: try cy=0, then alternate ±1, ±2, etc.
      let bestCy = 0;
      for (let attempt = 0; attempt < 20; attempt++) {
        const sign = attempt % 2 === 0 ? -1 : 1;
        const level = Math.ceil(attempt / 2);
        const candidateCy = sign * level * (DOT_R * 2.1);

        const overlaps = placed.some((d) => {
          const dx = d.cx - cx;
          const dy = d.cy - candidateCy;
          return Math.sqrt(dx * dx + dy * dy) < SPACING;
        });

        if (!overlaps) {
          bestCy = candidateCy;
          break;
        }
      }

      placed.push({ pct, cx, cy: bestCy });
    });

    // Calculate svg height needed
    const minCy = Math.min(...placed.map((d) => d.cy));
    const maxCy = Math.max(...placed.map((d) => d.cy));
    const padding = DOT_R + 4;
    const svgHeight = maxCy - minCy + padding * 2;
    const centerY = -minCy + padding;

    return { dots: placed, avg, count: eligible.length, svgHeight, centerY, xScale };
  }, [pitcherSeasons]);

  if (!data) return null;

  // Tick marks
  const ticks = [0, 20, 40, 60, 80, 100];

  return (
    <Card className="glass-card">
      <CardHeader className="pb-1 px-3 sm:px-6">
        <div className="flex items-center justify-between">
          <CardTitle className="font-display text-base sm:text-lg flex items-center gap-2">
            <Target className="w-4 h-4 sm:w-5 sm:h-5 text-accent" />
            Strike % Distribution
          </CardTitle>
          <span className="text-xs text-muted-foreground">
            Avg: <span className="font-semibold text-foreground">{data.avg}%</span>
          </span>
        </div>
      </CardHeader>
      <CardContent className="px-3 sm:px-6">
        <svg
          viewBox={`0 0 340 ${data.svgHeight + 24}`}
          className="w-full"
          style={{ maxHeight: '180px' }}
        >
          {/* Center line / axis */}
          <line
            x1={30}
            y1={data.centerY}
            x2={310}
            y2={data.centerY}
            stroke="hsl(var(--border))"
            strokeWidth={1}
          />

          {/* Average line */}
          <line
            x1={data.xScale(data.avg)}
            y1={0}
            x2={data.xScale(data.avg)}
            y2={data.svgHeight}
            stroke="hsl(var(--muted-foreground))"
            strokeWidth={1}
            strokeDasharray="3 3"
            opacity={0.5}
          />

          {/* Dots */}
          {data.dots.map((dot, i) => (
            <circle
              key={i}
              cx={dot.cx}
              cy={data.centerY + dot.cy}
              r={5.5}
              fill="hsl(var(--primary))"
              opacity={0.75}
              stroke="hsl(var(--card))"
              strokeWidth={1}
            >
              <title>{dot.pct}%</title>
            </circle>
          ))}

          {/* X-axis ticks */}
          {ticks.map((t) => {
            const x = data.xScale(t);
            return (
              <g key={t}>
                <line
                  x1={x}
                  y1={data.svgHeight}
                  x2={x}
                  y2={data.svgHeight + 4}
                  stroke="hsl(var(--muted-foreground))"
                  strokeWidth={0.5}
                />
                <text
                  x={x}
                  y={data.svgHeight + 16}
                  textAnchor="middle"
                  fontSize={10}
                  fill="hsl(var(--muted-foreground))"
                >
                  {t}%
                </text>
              </g>
            );
          })}

          {/* Axis line */}
          <line
            x1={30}
            y1={data.svgHeight}
            x2={310}
            y2={data.svgHeight}
            stroke="hsl(var(--muted-foreground))"
            strokeWidth={0.5}
          />
        </svg>

        <p className="text-[10px] text-muted-foreground mt-1 text-center">
          {data.count} pitchers · each dot is one pitcher's season strike %
        </p>
      </CardContent>
    </Card>
  );
}
