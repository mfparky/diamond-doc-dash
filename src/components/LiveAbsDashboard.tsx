import { useMemo } from 'react';
import { Outing } from '@/types/pitcher';
import { parseLiveAbsData, AB_OUTCOME_COLOR, AB_OUTCOME_LABELS, AbOutcome } from '@/types/at-bats';
import { PitchLocation } from '@/types/pitch-location';
import { LiveAbsSummary } from './LiveAbsSummary';
import { LiveAbsSessionZone } from './LiveAbsSessionZone';

interface LiveAbsDashboardProps {
  outings: Outing[];
  pitchLocations: PitchLocation[];
  /** Pass formatDate from the parent so we don't duplicate it */
  formatDate: (d: string) => string;
}

const OUTCOME_GROUPS: { label: string; outcomes: AbOutcome[] }[] = [
  { label: 'Strikeouts', outcomes: ['K', 'K-L'] },
  { label: 'Walks / HBP', outcomes: ['BB', 'HBP'] },
  { label: 'Hits', outcomes: ['1B', '2B', '3B', 'HR'] },
  { label: 'Outs in play', outcomes: ['GO', 'FO', 'LO', 'FC', 'E'] },
];

export function LiveAbsDashboard({ outings, pitchLocations, formatDate }: LiveAbsDashboardProps) {
  const liveAbOutings = useMemo(
    () => outings.filter((o) => o.eventType === 'Live ABs').sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    ),
    [outings]
  );

  const stats = useMemo(() => {
    let batters = 0;
    let pitches = 0;
    let strikePitches = 0;
    let strikeTotal = 0;
    const outcomeCounts: Partial<Record<AbOutcome, number>> = {};

    for (const outing of liveAbOutings) {
      const data = parseLiveAbsData(outing.notes);
      if (data) {
        batters += data.atBats.length;
        for (const ab of data.atBats) {
          if (ab.outcome) outcomeCounts[ab.outcome] = (outcomeCounts[ab.outcome] ?? 0) + 1;
        }
      }
      pitches += outing.pitchCount;
      if (outing.strikes !== null) {
        strikePitches += outing.pitchCount;
        strikeTotal += outing.strikes;
      }
    }

    const strikePct = strikePitches > 0 ? (strikeTotal / strikePitches) * 100 : null;
    return { batters, pitches, strikePct, outcomeCounts };
  }, [liveAbOutings]);

  const totalOutcomes = Object.values(stats.outcomeCounts).reduce((s, n) => s + (n ?? 0), 0);

  if (liveAbOutings.length === 0) {
    return (
      <p className="text-muted-foreground text-center py-8">No Live ABs sessions recorded yet.</p>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary stat tiles */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-lg bg-secondary/50 border border-border/30 p-3 text-center">
          <p className="text-2xl font-bold text-foreground">{stats.batters}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Batters Faced</p>
        </div>
        <div className="rounded-lg bg-secondary/50 border border-border/30 p-3 text-center">
          <p className="text-2xl font-bold text-foreground">{stats.pitches}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Pitches</p>
        </div>
        <div className="rounded-lg bg-secondary/50 border border-border/30 p-3 text-center">
          <p className="text-2xl font-bold text-foreground">
            {stats.strikePct !== null ? `${stats.strikePct.toFixed(0)}%` : '—'}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">Strike %</p>
        </div>
      </div>

      {/* Outcome distribution */}
      {totalOutcomes > 0 && (
        <div className="rounded-lg bg-secondary/50 border border-border/30 p-3 space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Outcome Breakdown</p>

          {/* Stacked bar */}
          <div className="flex h-3 rounded-full overflow-hidden gap-px">
            {OUTCOME_GROUPS.flatMap(({ outcomes }) =>
              outcomes.map((oc) => {
                const count = stats.outcomeCounts[oc] ?? 0;
                if (!count) return null;
                return (
                  <div
                    key={oc}
                    title={`${AB_OUTCOME_LABELS[oc]}: ${count}`}
                    style={{ flex: count, backgroundColor: AB_OUTCOME_COLOR[oc] }}
                  />
                );
              })
            )}
          </div>

          {/* Legend chips */}
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {OUTCOME_GROUPS.map(({ label, outcomes }) => {
              const groupCount = outcomes.reduce((s, oc) => s + (stats.outcomeCounts[oc] ?? 0), 0);
              if (!groupCount) return null;
              const color = AB_OUTCOME_COLOR[outcomes[0]];
              return (
                <span key={label} className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: color }} />
                  {label}: <span className="font-semibold text-foreground">{groupCount}</span>
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Per-session list */}
      <div className="space-y-4">
        {liveAbOutings.map((outing) => {
          const data = parseLiveAbsData(outing.notes);
          const strikePct = outing.strikes !== null && outing.pitchCount > 0
            ? ((outing.strikes / outing.pitchCount) * 100).toFixed(0)
            : null;
          const sessionPitches = pitchLocations.filter((p) => p.outingId === outing.id);

          return (
            <div key={outing.id} className="rounded-lg bg-secondary/50 border border-border/30 p-4 space-y-3">
              {/* Session header */}
              <div className="flex items-center justify-between">
                <p className="font-semibold text-foreground">{formatDate(outing.date)}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{data ? data.atBats.length : 0} batters</span>
                  <span>·</span>
                  <span>{outing.pitchCount} pitches</span>
                  {strikePct && <><span>·</span><span>{strikePct}% strikes</span></>}
                </div>
              </div>

              {/* Outcome chips */}
              <LiveAbsSummary notes={outing.notes} />

              {/* Strike zone with batter selector */}
              <LiveAbsSessionZone notes={outing.notes} pitchLocations={sessionPitches} />

              {outing.focus && (
                <p className="text-xs text-primary border-t border-border/20 pt-2">
                  <span className="font-medium">Focus:</span> {outing.focus}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
