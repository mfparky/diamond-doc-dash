import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { buildWeightingBreakdown, type MetricBucket } from '@/lib/team-rankings';
import { cn } from '@/lib/utils';

const BUCKET_LABEL: Record<MetricBucket, string> = {
  offense: 'Offense',
  defense: 'Defense',
  intangibles: 'Intangibles',
};

const BUCKET_COLOR: Record<MetricBucket, string> = {
  offense: 'bg-primary',
  defense: 'bg-sky-500',
  intangibles: 'bg-amber-500',
};

const BUCKET_TINT: Record<MetricBucket, string> = {
  offense: 'bg-primary/15 text-primary',
  defense: 'bg-sky-500/15 text-sky-600 dark:text-sky-300',
  intangibles: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
};

export function WeightingChart() {
  const { rows, bucketShares } = useMemo(() => buildWeightingBreakdown(), []);

  // Sort by descending PV share so the heaviest metrics surface first.
  const sortedRows = useMemo(
    () => [...rows].sort((a, b) => b.shareOfPv - a.shareOfPv),
    [rows],
  );

  const bucketOrder: MetricBucket[] = ['offense', 'defense', 'intangibles'];

  const maxShareOfPv = Math.max(...rows.map((r) => r.shareOfPv));

  return (
    <Card className="glass-card">
      <CardHeader className="pb-2">
        <CardTitle className="font-display text-lg">Weighting</CardTitle>
        <p className="text-xs text-muted-foreground">
          How each metric contributes to a player's composite Player Value. A separate
          participation factor (not shown here) damps the defense score for kids who
          barely pitch — see the "Pitching participation" note in the controls above.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Bucket allocation — stacked bar */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Bucket allocation
          </p>
          <div className="flex w-full h-8 rounded-md overflow-hidden border border-border/40">
            {bucketOrder.map((b) => {
              const share = bucketShares[b];
              if (share <= 0) return null;
              return (
                <div
                  key={b}
                  className={cn('flex items-center justify-center text-[10px] font-bold text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.45)]', BUCKET_COLOR[b])}
                  style={{ width: `${share * 100}%` }}
                  title={`${BUCKET_LABEL[b]} — ${Math.round(share * 100)}%`}
                >
                  {share >= 0.08 ? `${Math.round(share * 100)}%` : ''}
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-2 text-[11px]">
            {bucketOrder.map((b) => {
              const share = bucketShares[b];
              if (share <= 0) return null;
              return (
                <span key={b} className={cn('px-2 py-0.5 rounded-md', BUCKET_TINT[b])}>
                  {BUCKET_LABEL[b]} {Math.round(share * 100)}%
                </span>
              );
            })}
          </div>
        </div>

        {/* Per-metric contribution — sorted by PV share */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Metric contributions
          </p>
          <p className="text-[11px] text-muted-foreground">
            <span className="font-medium text-foreground">Share of bucket</span> is the metric's
            weight relative to the other metrics in its bucket.
            <span className="font-medium text-foreground"> Share of PV</span> is its slice of the
            final composite (when all components are present).
          </p>
          <ul className="space-y-1.5">
            {sortedRows.map((row) => (
              <li key={row.key} className="flex items-center gap-3">
                <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider shrink-0 w-20 text-center', BUCKET_TINT[row.bucket])}>
                  {BUCKET_LABEL[row.bucket]}
                </span>
                <span className="font-medium text-sm text-foreground shrink-0 w-20">
                  {row.label}
                </span>
                <div className="flex-1 flex items-center gap-2">
                  <div className="flex-1 h-2 rounded-full bg-secondary/60 overflow-hidden">
                    <div
                      className={cn('h-full', BUCKET_COLOR[row.bucket])}
                      style={{ width: `${(row.shareOfPv / maxShareOfPv) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground tabular-nums shrink-0 w-24 text-right">
                    {(row.shareOfPv * 100).toFixed(1)}% of PV
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
