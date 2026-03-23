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

    return { avg, min, max, count: eligible.length };
  }, [pitcherSeasons]);

  if (!data) return null;

  // Ring geometry
  const size = 160;
  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const fillPercent = data.avg / 100;
  const dashOffset = circumference * (1 - fillPercent);

  // Color based on avg
  const avgColor =
    data.avg >= 60 ? 'hsl(142, 60%, 42%)' : data.avg >= 50 ? 'hsl(38, 92%, 50%)' : 'hsl(var(--destructive))';

  // Marker positions on the ring (angle in degrees, 0 = top, clockwise)
  const pctToAngle = (pct: number) => (pct / 100) * 360 - 90; // -90 to start from top
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

            {/* Background track */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="hsl(var(--secondary))"
              strokeWidth={strokeWidth}
            />

            {/* Filled arc */}
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

            {/* Min marker */}
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

            {/* Max marker */}
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

          {/* Center text */}
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
      </CardContent>
    </Card>
  );
}
