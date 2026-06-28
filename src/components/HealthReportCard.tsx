import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Activity, TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle2, AlertCircle, Upload } from 'lucide-react';
import { useStatSnapshots } from '@/hooks/use-stat-snapshots';
import { generateInsights, type InsightKind, type TrackerContext } from '@/lib/health-insights';
import type { StatValue } from '@/lib/stat-csv';
import type { Outing } from '@/types/pitcher';
import { cn } from '@/lib/utils';

interface HealthReportCardProps {
  pitcherId: string;
  pitcherName: string;
  outings: Outing[];
  /** Called when the user taps the upload CTA on the empty state. */
  onRequestUpload?: () => void;
}

/** Stats surfaced in the grid, in the order coaches expect to read them. */
const STAT_GRID: Array<{ key: string; label: string; format: (v: number) => string; betterDirection: 'up' | 'down' | 'neutral' }> = [
  { key: 'pit_era', label: 'ERA', format: (v) => v.toFixed(2), betterDirection: 'down' },
  { key: 'pit_whip', label: 'WHIP', format: (v) => v.toFixed(2), betterDirection: 'down' },
  { key: 'pit_baa', label: 'Opp AVG', format: (v) => v.toFixed(3), betterDirection: 'down' },
  { key: 'pit_fip', label: 'FIP', format: (v) => v.toFixed(2), betterDirection: 'down' },
  { key: 'pit_k_pct_bf', label: 'K / BF', format: (v) => v.toFixed(3), betterDirection: 'up' },
  { key: 'pit_sm_pct', label: 'Swing & Miss %', format: (v) => `${v.toFixed(1)}%`, betterDirection: 'up' },
  { key: 'pit_fps_pct', label: 'First-pitch K %', format: (v) => `${v.toFixed(1)}%`, betterDirection: 'up' },
  { key: 'pit_bb_pct_inn', label: 'BB / IP', format: (v) => v.toFixed(2), betterDirection: 'down' },
  { key: 'pit_ip', label: 'IP (season)', format: (v) => v.toFixed(1), betterDirection: 'neutral' },
  { key: 'pit_bf', label: 'BF (season)', format: (v) => v.toFixed(0), betterDirection: 'neutral' },
  { key: 'pit_p_pct_bf', label: 'Pitches / BF', format: (v) => v.toFixed(2), betterDirection: 'down' },
  { key: 'pit_p_pct_ip', label: 'Pitches / IP', format: (v) => v.toFixed(1), betterDirection: 'down' },
];

const INSIGHT_STYLES: Record<InsightKind, { bg: string; ring: string; text: string; icon: JSX.Element }> = {
  good: {
    bg: 'bg-emerald-500/10',
    ring: 'ring-emerald-500/30',
    text: 'text-emerald-700 dark:text-emerald-300',
    icon: <CheckCircle2 className="w-4 h-4" />,
  },
  attention: {
    bg: 'bg-amber-500/10',
    ring: 'ring-amber-500/30',
    text: 'text-amber-700 dark:text-amber-300',
    icon: <AlertCircle className="w-4 h-4" />,
  },
  'heads-up': {
    bg: 'bg-red-500/10',
    ring: 'ring-red-500/30',
    text: 'text-red-700 dark:text-red-300',
    icon: <AlertTriangle className="w-4 h-4" />,
  },
};

function num(stats: Record<string, StatValue> | null | undefined, key: string): number | null {
  if (!stats) return null;
  const v = stats[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function deltaArrow(
  current: number | null,
  previous: number | null,
  direction: 'up' | 'down' | 'neutral',
): { node: JSX.Element; tone: string } | null {
  if (current === null || previous === null || direction === 'neutral') return null;
  const diff = current - previous;
  if (Math.abs(diff) < 1e-6) {
    return { node: <Minus className="w-3 h-3" />, tone: 'text-muted-foreground' };
  }
  const improving =
    (direction === 'up' && diff > 0) || (direction === 'down' && diff < 0);
  const Icon = diff > 0 ? TrendingUp : TrendingDown;
  return {
    node: <Icon className="w-3 h-3" />,
    tone: improving ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400',
  };
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;
  const diffMs = Date.now() - then;
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return `${months} month${months === 1 ? '' : 's'} ago`;
}

export function HealthReportCard({ pitcherId, pitcherName, outings, onRequestUpload }: HealthReportCardProps) {
  const { latest, previous, isLoading } = useStatSnapshots(pitcherId);

  const trackerContext = useMemo<TrackerContext>(() => {
    if (outings.length === 0) {
      return { avgPitchesPerOuting: null, avgDaysBetweenOutings: null, recentOutingCount: 0 };
    }
    const sorted = [...outings].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );
    const counts = sorted.map((o) => o.pitchCount).filter((n) => n > 0);
    const avgPitches = counts.length ? counts.reduce((a, b) => a + b, 0) / counts.length : null;

    let avgGap: number | null = null;
    if (sorted.length >= 2) {
      const gaps: number[] = [];
      for (let i = 1; i < sorted.length; i += 1) {
        const gap =
          (new Date(sorted[i].date).getTime() - new Date(sorted[i - 1].date).getTime()) /
          (1000 * 60 * 60 * 24);
        if (gap > 0) gaps.push(gap);
      }
      if (gaps.length > 0) avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    }

    return {
      avgPitchesPerOuting: avgPitches,
      avgDaysBetweenOutings: avgGap,
      recentOutingCount: sorted.length,
    };
  }, [outings]);

  const insights = useMemo(() => {
    if (!latest) return [];
    return generateInsights(latest.stats, previous?.stats ?? null, trackerContext);
  }, [latest, previous, trackerContext]);

  if (isLoading) {
    return (
      <Card className="glass-card">
        <CardHeader className="pb-2">
          <CardTitle className="font-display text-lg flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            Health Report
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">Loading…</CardContent>
      </Card>
    );
  }

  if (!latest) {
    return (
      <Card className="glass-card">
        <CardHeader className="pb-2">
          <CardTitle className="font-display text-lg flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            Health Report
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-3">
          <p className="text-muted-foreground">
            No season stats uploaded yet for {pitcherName}. Drop a CSV to power the trend report.
          </p>
          {onRequestUpload && (
            <Button size="sm" onClick={onRequestUpload}>
              <Upload className="w-4 h-4 mr-2" />
              Upload season stats
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-card">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="font-display text-lg flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            Health Report
          </CardTitle>
          <span className="text-xs text-muted-foreground">
            Updated {formatRelative(latest.uploadedAt)}
            {previous && ' · trend vs prior snapshot'}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Insights */}
        {insights.length > 0 && (
          <ul className="space-y-2">
            {insights.map((insight, idx) => {
              const style = INSIGHT_STYLES[insight.kind];
              return (
                <li
                  key={idx}
                  className={cn(
                    'flex items-start gap-2 rounded-md ring-1 p-2 text-sm',
                    style.bg,
                    style.ring,
                    style.text,
                  )}
                >
                  <span className="mt-0.5 shrink-0">{style.icon}</span>
                  <span>{insight.message}</span>
                </li>
              );
            })}
          </ul>
        )}

        {/* Stat grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {STAT_GRID.map(({ key, label, format, betterDirection }) => {
            const value = num(latest.stats, key);
            const prev = num(previous?.stats ?? null, key);
            const arrow = deltaArrow(value, prev, betterDirection);
            return (
              <div
                key={key}
                className="rounded-md border border-border/60 bg-secondary/30 p-3"
              >
                <div className="text-xs text-muted-foreground">{label}</div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-lg font-semibold text-foreground">
                    {value === null ? '—' : format(value)}
                  </span>
                  {arrow && (
                    <span className={cn('flex items-center gap-0.5 text-xs', arrow.tone)}>
                      {arrow.node}
                      {prev !== null && value !== null && (
                        <span>{format(Math.abs(value - prev))}</span>
                      )}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Tracker context footer */}
        <div className="text-xs text-muted-foreground border-t border-border/40 pt-3 space-y-0.5">
          <p>
            Tracker: {trackerContext.recentOutingCount} outings logged
            {trackerContext.avgPitchesPerOuting !== null &&
              ` · avg ${trackerContext.avgPitchesPerOuting.toFixed(1)} pitches/outing`}
            {trackerContext.avgDaysBetweenOutings !== null &&
              ` · avg ${trackerContext.avgDaysBetweenOutings.toFixed(1)} days rest`}
          </p>
          {latest.sourceFilename && (
            <p>Source: {latest.sourceFilename}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
