import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { PlayerRanking } from '@/lib/team-rankings';

interface TierListProps {
  rankings: PlayerRanking[];
}

interface TierConfig {
  letter: string;
  label: string;
  topPercentile: number; // upper bound (inclusive) of this tier as a percentile
  className: string;
  rowClassName: string;
}

// Esports-style tiers. Cutoffs by team percentile so the buckets are
// balanced on any roster size: S = top 10%, A = next 20%, B = next 30%,
// C = next 25%, D = bottom 15%.
const TIERS: TierConfig[] = [
  { letter: 'S', label: 'Star', topPercentile: 100, className: 'bg-amber-500 text-amber-950', rowClassName: 'bg-amber-500/10 border-amber-500/40' },
  { letter: 'A', label: 'Excellent', topPercentile: 90, className: 'bg-emerald-500 text-emerald-950', rowClassName: 'bg-emerald-500/10 border-emerald-500/30' },
  { letter: 'B', label: 'Good', topPercentile: 70, className: 'bg-sky-500 text-sky-950', rowClassName: 'bg-sky-500/10 border-sky-500/30' },
  { letter: 'C', label: 'Developing', topPercentile: 40, className: 'bg-slate-500 text-slate-50', rowClassName: 'bg-slate-500/10 border-slate-500/30' },
  { letter: 'D', label: 'Focus', topPercentile: 15, className: 'bg-rose-500 text-rose-50', rowClassName: 'bg-rose-500/10 border-rose-500/30' },
];

export function TierList({ rankings }: TierListProps) {
  const buckets = useMemo(() => {
    const total = rankings.length;
    if (total === 0) return [];
    // Players are already sorted high -> low by PV in the rankings input.
    // Walk top-to-bottom and assign tiers by index percentile.
    const assigned = rankings.map((r, idx) => {
      const positionFromTop = idx + 1;
      // percentileRank: 100 = top, 0 = bottom-most
      const percentileRank = 100 - ((positionFromTop - 1) / total) * 100;
      let tier = TIERS[TIERS.length - 1];
      // First (highest topPercentile) tier the player's percentile falls under.
      // TIERS is declared top-down; we find the first tier whose threshold is >= rank.
      for (let i = TIERS.length - 1; i >= 0; i -= 1) {
        // bottom of this tier = previous tier's topPercentile (or 0)
        const bottom = i === TIERS.length - 1 ? 0 : TIERS[i + 1].topPercentile;
        const top = TIERS[i].topPercentile;
        if (percentileRank > bottom && percentileRank <= top) {
          tier = TIERS[i];
          break;
        }
      }
      return { ranking: r, tier };
    });
    // Group by tier in TIERS order (S first).
    return TIERS.map((t) => ({
      tier: t,
      players: assigned.filter((a) => a.tier.letter === t.letter).map((a) => a.ranking),
    }));
  }, [rankings]);

  if (rankings.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">No players to rank yet.</p>
    );
  }

  return (
    <div className="space-y-2">
      {buckets.map(({ tier, players }) => (
        <div
          key={tier.letter}
          className={cn(
            'flex items-stretch rounded-lg border overflow-hidden',
            tier.rowClassName,
          )}
        >
          <div
            className={cn(
              'flex items-center justify-center font-display font-black text-3xl w-16 sm:w-20 shrink-0',
              tier.className,
            )}
          >
            {tier.letter}
          </div>
          <div className="flex-1 p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
              {tier.label} · {players.length} player{players.length === 1 ? '' : 's'}
            </p>
            {players.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">No one in this tier</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {players.map((p) => (
                  <span
                    key={p.pitcherId}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-background/70 border border-border/40 text-sm font-medium text-foreground"
                  >
                    {p.pitcherName}
                    <span className="text-[10px] text-muted-foreground">{p.playerValue.toFixed(0)}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
