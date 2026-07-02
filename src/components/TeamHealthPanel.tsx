import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, Upload, Users, Trophy, AlertTriangle, Target, TrendingUp, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAllStatSnapshots } from '@/hooks/use-stat-snapshots';
import {
  buildTeamHealthReport,
  type PitcherSnapshotInput,
  type TeamInsightKind,
} from '@/lib/team-health';
import { cn } from '@/lib/utils';

const TEAM_INSIGHT_STYLES: Record<TeamInsightKind, { bg: string; ring: string; text: string; icon: JSX.Element }> = {
  focus: {
    bg: 'bg-amber-500/10',
    ring: 'ring-amber-500/30',
    text: 'text-amber-700 dark:text-amber-300',
    icon: <AlertTriangle className="w-4 h-4" />,
  },
  momentum: {
    bg: 'bg-sky-500/10',
    ring: 'ring-sky-500/30',
    text: 'text-sky-700 dark:text-sky-300',
    icon: <TrendingUp className="w-4 h-4" />,
  },
  strength: {
    bg: 'bg-emerald-500/10',
    ring: 'ring-emerald-500/30',
    text: 'text-emerald-700 dark:text-emerald-300',
    icon: <CheckCircle2 className="w-4 h-4" />,
  },
};
import type { PitcherRecord } from '@/hooks/use-pitchers';
import type { Outing } from '@/types/pitcher';

interface TeamHealthPanelProps {
  pitchers: PitcherRecord[];
  outings: Outing[];
  /** Optional CTA target so the empty state can punt back to the upload sheet. */
  onRequestUpload?: () => void;
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;
  const diffMs = Date.now() - then;
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

/**
 * Pre-compute per-pitcher avg-days-between-outings from the full outings list.
 * Done once per (outings, pitcherIds) pair rather than per-pitcher.
 */
function buildTrackerByPitcher(
  outings: Outing[],
  pitchersByName: Map<string, string>,
): Map<string, { avgDaysBetweenOutings: number | null; recentOutingCount: number }> {
  const groups = new Map<string, Outing[]>();
  for (const o of outings) {
    const id = pitchersByName.get(o.pitcherName);
    if (!id) continue;
    const arr = groups.get(id) ?? [];
    arr.push(o);
    groups.set(id, arr);
  }
  const result = new Map<string, { avgDaysBetweenOutings: number | null; recentOutingCount: number }>();
  for (const [id, list] of groups) {
    const sorted = [...list].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );
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
    result.set(id, {
      avgDaysBetweenOutings: avgGap,
      recentOutingCount: sorted.length,
    });
  }
  return result;
}

export function TeamHealthPanel({ pitchers, outings, onRequestUpload }: TeamHealthPanelProps) {
  const pitcherIds = useMemo(() => pitchers.map((p) => p.id), [pitchers]);
  const { byPitcher, mostRecentUploadedAt, isLoading } = useAllStatSnapshots(pitcherIds);

  const snapshotInputs = useMemo<PitcherSnapshotInput[]>(() => {
    const pitchersByName = new Map<string, string>();
    for (const p of pitchers) pitchersByName.set(p.name, p.id);
    const trackerByPitcher = buildTrackerByPitcher(outings, pitchersByName);

    return pitchers.map((p) => {
      const snaps = byPitcher.get(p.id) ?? [];
      const tracker = trackerByPitcher.get(p.id);
      return {
        pitcherId: p.id,
        pitcherName: p.name,
        latest: snaps[0]?.stats ?? null,
        previous: snaps[1]?.stats ?? null,
        avgDaysBetweenOutings: tracker?.avgDaysBetweenOutings ?? null,
        recentOutingCount: tracker?.recentOutingCount ?? 0,
      };
    });
  }, [pitchers, outings, byPitcher]);

  // Build a "previous" snapshot set from each pitcher's prior upload so team
  // insights can fire trend rules (WHIP down, OPS up, etc.).
  const previousSnapshotInputs = useMemo<PitcherSnapshotInput[]>(() => {
    return pitchers.map((p) => {
      const snaps = byPitcher.get(p.id) ?? [];
      return {
        pitcherId: p.id,
        pitcherName: p.name,
        latest: snaps[1]?.stats ?? null, // "latest" for the previous window = index 1
        previous: null,
      };
    });
  }, [pitchers, byPitcher]);

  const report = useMemo(
    () => buildTeamHealthReport(snapshotInputs, previousSnapshotInputs),
    [snapshotInputs, previousSnapshotInputs],
  );

  if (isLoading) {
    return (
      <Card className="glass-card">
        <CardHeader className="pb-2">
          <CardTitle className="font-display text-lg flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            Team Health
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">Loading…</CardContent>
      </Card>
    );
  }

  if (report.aggregates.pitchersWithStats === 0) {
    return (
      <Card className="glass-card">
        <CardHeader className="pb-2">
          <CardTitle className="font-display text-lg flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            Team Health
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            No season stats uploaded yet. Drop a GameChanger CSV to power team-wide trends,
            leaderboards, and opportunity cohorts.
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
            Team Health
          </CardTitle>
          <span className="text-xs text-muted-foreground">
            {report.aggregates.pitchersWithStats} pitcher{report.aggregates.pitchersWithStats === 1 ? '' : 's'}
            {mostRecentUploadedAt && ` · updated ${formatRelative(mostRecentUploadedAt)}`}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Section 0: Team focus — group-level insights derived from team rate stats */}
        {report.teamInsights.length > 0 && (
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Target className="w-4 h-4 text-primary" />
              What to work on as a group
            </h3>
            <ul className="space-y-2">
              {report.teamInsights.map((insight, idx) => {
                const style = TEAM_INSIGHT_STYLES[insight.kind];
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
          </section>
        )}

        {/* Section 1: Opportunity cohorts */}
        {report.cohorts.length > 0 && (
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Opportunities
            </h3>
            <ul className="space-y-2">
              {report.cohorts.map((cohort) => (
                <li
                  key={cohort.id}
                  className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3"
                >
                  <p className="font-medium text-sm text-foreground">{cohort.label}</p>
                  <p className="text-xs text-muted-foreground mb-2">{cohort.description}</p>
                  <ul className="space-y-1">
                    {cohort.members.map((m) => (
                      <li key={m.pitcherId} className="text-sm flex items-baseline justify-between gap-2">
                        <span className="text-foreground">{m.pitcherName}</span>
                        <span className="text-xs text-muted-foreground">{m.drivingValue}</span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Section 2: Leaderboards */}
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-500" />
            Leaderboards
          </h3>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {report.leaderboards.map((entry) => (
              <li
                key={entry.id}
                className="rounded-md border border-border/60 bg-secondary/30 p-3 flex items-baseline justify-between gap-2"
              >
                <span className="text-xs text-muted-foreground">{entry.label}</span>
                {entry.leader ? (
                  <span className="text-sm">
                    <span className="font-semibold text-foreground">{entry.leader.pitcherName}</span>
                    <span className="text-muted-foreground ml-2">{entry.format(entry.leader.value)}</span>
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </li>
            ))}
          </ul>
        </section>

        {/* Section 3: Team aggregates */}
        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            Season aggregate
          </h3>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center">
            <AggregateCell label="ERA" value={report.aggregates.era} format={(v) => v.toFixed(2)} />
            <AggregateCell label="WHIP" value={report.aggregates.whip} format={(v) => v.toFixed(2)} />
            <AggregateCell label="Strike %" value={report.aggregates.strikePct} format={(v) => `${v.toFixed(1)}%`} />
            <AggregateCell label="K / BF" value={report.aggregates.kBfRate} format={(v) => v.toFixed(3)} />
            <AggregateCell label="Total IP" value={report.aggregates.totalIp} format={(v) => v.toFixed(1)} />
            <AggregateCell label="Total BF" value={report.aggregates.totalBf} format={(v) => v.toFixed(0)} />
          </div>
        </section>
      </CardContent>
    </Card>
  );
}

function AggregateCell({
  label,
  value,
  format,
}: {
  label: string;
  value: number | null;
  format: (v: number) => string;
}) {
  return (
    <div className="rounded-md border border-border/60 bg-secondary/30 p-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold text-foreground">{value === null ? '—' : format(value)}</div>
    </div>
  );
}
