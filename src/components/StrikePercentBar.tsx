import { useMemo, useState, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Target } from 'lucide-react';

interface PitcherSeasonSummary {
  strikePercent: number;
  strikePitches: number;
  totalStrikes?: number;
}

interface OutingForTrend {
  date: string;
  strikes: number | null;
  pitch_count: number;
}

interface StrikePercentBarProps {
  pitcherSeasons: PitcherSeasonSummary[];
  outings?: OutingForTrend[];
}

export function StrikePercentBar({ pitcherSeasons, outings }: StrikePercentBarProps) {
  const data = useMemo(() => {
    const eligible = pitcherSeasons
      .filter((p) => p.strikePitches >= 10);

    if (eligible.length < 2) return null;

    const perPitcher = eligible
      .map((p) => Math.round(p.strikePercent * 10) / 10)
      .sort((a, b) => a - b);

    const totalStrikesAll = eligible.reduce((s, p) => s + (p.totalStrikes ?? Math.round(p.strikePercent / 100 * p.strikePitches)), 0);
    const totalPitchesAll = eligible.reduce((s, p) => s + p.strikePitches, 0);
    const avg = totalPitchesAll > 0 ? Math.round((totalStrikesAll / totalPitchesAll) * 1000) / 10 : 0;

    const min = perPitcher[0];
    const max = perPitcher[perPitcher.length - 1];

    return { avg, min, max, count: eligible.length };
  }, [pitcherSeasons]);

  // Compute trend line data: rolling strike % by date
  const trendData = useMemo(() => {
    if (!outings || outings.length < 2) return null;

    // Group by date, only outings with tracked strikes
    const byDate = new Map<string, { strikes: number; pitches: number }>();
    outings
      .filter((o) => o.strikes !== null && o.pitch_count > 0)
      .forEach((o) => {
        const existing = byDate.get(o.date) || { strikes: 0, pitches: 0 };
        existing.strikes += o.strikes!;
        existing.pitches += o.pitch_count;
        byDate.set(o.date, existing);
      });

    const sorted = Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, { strikes, pitches }]) => ({
        date,
        pct: pitches > 0 ? (strikes / pitches) * 100 : 0,
      }));

    if (sorted.length < 2) return null;
    return sorted;
  }, [outings]);

  if (!data) return null;

  // Ring geometry
  const size = 160;
  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const fillPercent = data.avg / 100;
  const dashOffset = circumference * (1 - fillPercent);

  const avgColor =
    data.avg >= 60 ? 'hsl(142, 60%, 42%)' : data.avg >= 50 ? 'hsl(38, 92%, 50%)' : 'hsl(var(--destructive))';

  const pctToXY = (pct: number) => {
    const angle = (pct / 100) * 360 - 90;
    const rad = (angle * Math.PI) / 180;
    return {
      x: size / 2 + (radius) * Math.cos(rad),
      y: size / 2 + (radius) * Math.sin(rad),
    };
  };

  const minPos = pctToXY(data.min);
  const maxPos = pctToXY(data.max);

  // Sparkline geometry
  const sparkW = 220;
  const sparkH = 40;
  const sparkPad = 4;

  const buildSparkPath = () => {
    if (!trendData || trendData.length < 2) return null;

    const minPct = Math.min(...trendData.map((d) => d.pct), 30);
    const maxPct = Math.max(...trendData.map((d) => d.pct), 70);
    const range = maxPct - minPct || 1;

    const points = trendData.map((d, i) => {
      const x = sparkPad + (i / (trendData.length - 1)) * (sparkW - sparkPad * 2);
      const y = sparkH - sparkPad - ((d.pct - minPct) / range) * (sparkH - sparkPad * 2);
      return { x, y };
    });

    const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

    // 50% reference line y position
    const refY = sparkH - sparkPad - ((50 - minPct) / range) * (sparkH - sparkPad * 2);

    return { path, refY, points };
  };

  const spark = buildSparkPath();

  return (
    <Card className="glass-card">
      <CardHeader className="pb-1 px-3 sm:px-6">
        <CardTitle className="font-display text-base sm:text-lg flex items-center gap-2">
          <Target className="w-4 h-4 sm:w-5 sm:h-5 text-accent" />
          Team Strike %
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 sm:px-6 flex flex-col items-center">
        {/* Ring */}
        <div className="relative" style={{ width: size, height: size }}>
          <svg width={size} height={size} className="transform -rotate-90">
            <defs>
              <linearGradient id="strikeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="hsl(var(--destructive))" />
                <stop offset="40%" stopColor="hsl(38, 92%, 50%)" />
                <stop offset="70%" stopColor="hsl(var(--primary))" />
                <stop offset="100%" stopColor="hsl(142, 60%, 42%)" />
              </linearGradient>
            </defs>

            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="hsl(var(--secondary))"
              strokeWidth={strokeWidth}
            />

            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="url(#strikeGradient)"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              className="transition-all duration-1000 ease-out"
            />

            <circle
              cx={minPos.x}
              cy={minPos.y}
              r={4}
              fill="hsl(var(--card))"
              stroke="hsl(var(--muted-foreground))"
              strokeWidth={1.5}
              className="rotate-90 origin-center"
              style={{ transformOrigin: `${size / 2}px ${size / 2}px` }}
            />

            <circle
              cx={maxPos.x}
              cy={maxPos.y}
              r={4}
              fill="hsl(var(--card))"
              stroke={avgColor}
              strokeWidth={1.5}
              className="rotate-90 origin-center"
              style={{ transformOrigin: `${size / 2}px ${size / 2}px` }}
            />
          </svg>

          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-bold text-foreground leading-none">{data.avg}%</span>
            <span className="text-[10px] text-muted-foreground mt-1">Team Avg</span>
          </div>
        </div>

        {/* Min / Max labels */}
        <div className="flex justify-between w-full mt-3 text-xs text-muted-foreground">
          <div className="text-center">
            <span className="block text-[10px] uppercase tracking-wider">Low</span>
            <span className="font-semibold text-foreground">{data.min}%</span>
          </div>
          <div className="text-center">
            <span className="block text-[10px] uppercase tracking-wider">{data.count} Pitchers</span>
          </div>
          <div className="text-center">
            <span className="block text-[10px] uppercase tracking-wider">High</span>
            <span className="font-semibold text-foreground">{data.max}%</span>
          </div>
        </div>

        {/* Trend sparkline */}
        {spark && (
          <SparklineWithTooltip spark={spark} sparkW={sparkW} sparkH={sparkH} sparkPad={sparkPad} trendData={trendData!} />
        )}
      </CardContent>
    </Card>
  );
}

interface SparklineProps {
  spark: { path: string; refY: number; points: { x: number; y: number }[] };
  sparkW: number;
  sparkH: number;
  sparkPad: number;
  trendData: { date: string; pct: number }[];
}

function SparklineWithTooltip({ spark, sparkW, sparkH, sparkPad, trendData }: SparklineProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg || spark.points.length < 2) return;
    const rect = svg.getBoundingClientRect();
    const relX = (e.clientX - rect.left) / rect.width * sparkW;
    // Find nearest point
    let closest = 0;
    let closestDist = Infinity;
    for (let i = 0; i < spark.points.length; i++) {
      const d = Math.abs(spark.points[i].x - relX);
      if (d < closestDist) { closestDist = d; closest = i; }
    }
    setHoverIndex(closest);
  }, [spark.points, sparkW]);

  const hp = hoverIndex !== null ? spark.points[hoverIndex] : null;
  const hd = hoverIndex !== null ? trendData[hoverIndex] : null;

  return (
    <div className="w-full mt-4 pt-3 border-t border-border/40">
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Strike % Trend</p>
        <p className="text-[10px] text-muted-foreground opacity-50">50%</p>
      </div>
      <svg
        ref={svgRef}
        width="100%"
        height={sparkH}
        viewBox={`0 0 ${sparkW} ${sparkH}`}
        preserveAspectRatio="none"
        className="overflow-visible cursor-crosshair"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoverIndex(null)}
      >
        {/* 50% reference line */}
        <line
          x1={sparkPad}
          x2={sparkW - sparkPad}
          y1={spark.refY}
          y2={spark.refY}
          stroke="hsl(var(--muted-foreground))"
          strokeWidth={0.5}
          strokeDasharray="3 3"
          opacity={0.3}
        />

        {/* Trend line */}
        <path
          d={spark.path}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* End dot (when not hovering) */}
        {hoverIndex === null && spark.points.length > 0 && (
          <circle
            cx={spark.points[spark.points.length - 1].x}
            cy={spark.points[spark.points.length - 1].y}
            r={2.5}
            fill="hsl(var(--primary))"
          />
        )}

        {/* Hover indicator */}
        {hp && hd && (
          <>
            <line
              x1={hp.x}
              x2={hp.x}
              y1={0}
              y2={sparkH}
              stroke="hsl(var(--muted-foreground))"
              strokeWidth={0.5}
              opacity={0.4}
            />
            <circle cx={hp.x} cy={hp.y} r={3} fill="hsl(var(--primary))" />
            <rect
              x={Math.min(hp.x - 18, sparkW - 40)}
              y={Math.max(hp.y - 18, 0)}
              width={36}
              height={14}
              rx={3}
              fill="hsl(var(--popover))"
              stroke="hsl(var(--border))"
              strokeWidth={0.5}
            />
            <text
              x={Math.min(hp.x, sparkW - 22)}
              y={Math.max(hp.y - 8, 10)}
              fontSize={8}
              fontWeight={600}
              fill="hsl(var(--foreground))"
              textAnchor="middle"
            >
              {Math.round(hd.pct * 10) / 10}%
            </text>
          </>
        )}
      </svg>
    </div>
  );
}
