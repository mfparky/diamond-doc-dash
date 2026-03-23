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

const BUCKETS = [
  { label: '<45%', min: 0, max: 45, color: 'hsl(var(--destructive))' },
  { label: '45-50%', min: 45, max: 50, color: 'hsl(var(--warning))' },
  { label: '50-55%', min: 50, max: 55, color: 'hsl(38, 92%, 50%)' },
  { label: '55-60%', min: 55, max: 60, color: 'hsl(var(--primary))' },
  { label: '60-65%', min: 60, max: 65, color: 'hsl(142, 50%, 45%)' },
  { label: '65%+', min: 65, max: 101, color: 'hsl(142, 70%, 38%)' },
];

export function StrikePercentBar({ pitcherSeasons }: StrikePercentBarProps) {
  const distribution = useMemo(() => {
    const eligible = pitcherSeasons.filter((p) => p.strikePitches >= 10);
    if (eligible.length === 0) return null;

    const counts = BUCKETS.map((bucket) => ({
      ...bucket,
      count: eligible.filter((p) => p.strikePercent >= bucket.min && p.strikePercent < bucket.max).length,
    }));

    const total = eligible.length;
    const avg = Math.round((eligible.reduce((s, p) => s + p.strikePercent, 0) / total) * 10) / 10;

    return { counts, total, avg };
  }, [pitcherSeasons]);

  if (!distribution || distribution.total < 2) return null;

  const maxCount = Math.max(...distribution.counts.map((c) => c.count));

  return (
    <Card className="glass-card">
      <CardHeader className="pb-2 px-3 sm:px-6">
        <div className="flex items-center justify-between">
          <CardTitle className="font-display text-base sm:text-lg flex items-center gap-2">
            <Target className="w-4 h-4 sm:w-5 sm:h-5 text-accent" />
            Team Strike %
          </CardTitle>
          <span className="text-xs text-muted-foreground">
            Avg: <span className="font-semibold text-foreground">{distribution.avg}%</span>
          </span>
        </div>
      </CardHeader>
      <CardContent className="px-3 sm:px-6">
        <div className="space-y-2">
          {distribution.counts.map((bucket) => (
            <div key={bucket.label} className="flex items-center gap-2">
              <span className="text-[10px] sm:text-xs text-muted-foreground w-12 text-right shrink-0">
                {bucket.label}
              </span>
              <div className="flex-1 h-5 bg-secondary rounded overflow-hidden">
                {bucket.count > 0 && (
                  <div
                    className="h-full rounded transition-all duration-500"
                    style={{
                      width: `${(bucket.count / maxCount) * 100}%`,
                      backgroundColor: bucket.color,
                      minWidth: '20px',
                    }}
                  />
                )}
              </div>
              <span className="text-xs font-medium text-foreground w-6 text-right shrink-0">
                {bucket.count}
              </span>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground mt-3 text-center">
          {distribution.total} pitchers · distribution of season strike %
        </p>
      </CardContent>
    </Card>
  );
}
