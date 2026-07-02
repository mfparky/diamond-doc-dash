import type { StatValue } from './stat-csv';

export interface PitcherSnapshotInput {
  pitcherId: string;
  pitcherName: string;
  latest: Record<string, StatValue> | null;
  previous: Record<string, StatValue> | null;
  /** Optional tracker context per pitcher — enables arm-load cohort. */
  avgDaysBetweenOutings?: number | null;
  recentOutingCount?: number;
}

// --- Aggregates ---

export interface TeamAggregates {
  totalIp: number | null;
  totalBf: number | null;
  totalPitches: number | null;
  era: number | null;
  whip: number | null;
  strikePct: number | null;
  kBfRate: number | null;
  pitchersWithStats: number;
}

function num(stats: Record<string, StatValue> | null | undefined, key: string): number | null {
  if (!stats) return null;
  const v = stats[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/** Sum a stat across all pitchers' latest snapshots. Returns null if every value is null. */
function sumStat(snapshots: PitcherSnapshotInput[], key: string): number | null {
  let total = 0;
  let any = false;
  for (const s of snapshots) {
    const v = num(s.latest, key);
    if (v !== null) {
      total += v;
      any = true;
    }
  }
  return any ? total : null;
}

export function aggregateTeamStats(snapshots: PitcherSnapshotInput[]): TeamAggregates {
  const withLatest = snapshots.filter((s) => s.latest !== null);
  const totalIp = sumStat(snapshots, 'pit_ip');
  const totalBf = sumStat(snapshots, 'pit_bf');
  const totalPitches = sumStat(snapshots, 'pit_p');
  const totalH = sumStat(snapshots, 'pit_h');
  const totalBb = sumStat(snapshots, 'pit_bb');
  const totalEr = sumStat(snapshots, 'pit_er');
  const totalSo = sumStat(snapshots, 'pit_so');

  const era = totalIp !== null && totalIp > 0 && totalEr !== null
    ? (totalEr * 9) / totalIp
    : null;

  const whip = totalIp !== null && totalIp > 0 && totalH !== null && totalBb !== null
    ? (totalH + totalBb) / totalIp
    : null;

  // Strike% derived from per-pitcher S% weighted by pitch count.
  // (S% in the CSV is already a percentage of total pitches.)
  let strikePctNumerator = 0;
  let strikePctDenominator = 0;
  for (const s of withLatest) {
    const sPct = num(s.latest, 'pit_s_pct');
    const pCount = num(s.latest, 'pit_p');
    if (sPct !== null && pCount !== null && pCount > 0) {
      strikePctNumerator += sPct * pCount;
      strikePctDenominator += pCount;
    }
  }
  const strikePct = strikePctDenominator > 0 ? strikePctNumerator / strikePctDenominator : null;

  const kBfRate = totalBf !== null && totalBf > 0 && totalSo !== null
    ? totalSo / totalBf
    : null;

  return {
    totalIp,
    totalBf,
    totalPitches,
    era,
    whip,
    strikePct,
    kBfRate,
    pitchersWithStats: withLatest.length,
  };
}

// --- Leaderboards ---

export type LeaderDirection = 'min' | 'max';

export interface LeaderboardEntry {
  id: string;
  label: string;
  metricKey: string;
  direction: LeaderDirection;
  /** Minimum IP a pitcher needs to qualify (avoids noise from tiny samples). */
  minIp?: number;
  format: (value: number) => string;
  leader: { pitcherId: string; pitcherName: string; value: number } | null;
}

const LEADERBOARD_SPECS: Array<Omit<LeaderboardEntry, 'leader'>> = [
  { id: 'whip', label: 'Lowest WHIP', metricKey: 'pit_whip', direction: 'min', minIp: 3, format: (v) => v.toFixed(2) },
  { id: 'era', label: 'Lowest ERA', metricKey: 'pit_era', direction: 'min', minIp: 3, format: (v) => v.toFixed(2) },
  { id: 'k-bf', label: 'Highest K / BF', metricKey: 'pit_k_pct_bf', direction: 'max', minIp: 3, format: (v) => v.toFixed(3) },
  { id: 'fps', label: 'Best first-pitch K %', metricKey: 'pit_fps_pct', direction: 'max', minIp: 3, format: (v) => `${v.toFixed(1)}%` },
  { id: 'ip', label: 'Most innings (IP)', metricKey: 'pit_ip', direction: 'max', format: (v) => v.toFixed(1) },
  { id: 'bf', label: 'Most batters faced (BF)', metricKey: 'pit_bf', direction: 'max', format: (v) => v.toFixed(0) },
];

export function computeLeaderboards(snapshots: PitcherSnapshotInput[]): LeaderboardEntry[] {
  return LEADERBOARD_SPECS.map((spec) => {
    const candidates = snapshots
      .map((s) => {
        const v = num(s.latest, spec.metricKey);
        const ip = num(s.latest, 'pit_ip');
        if (v === null) return null;
        if (spec.minIp !== undefined && (ip ?? 0) < spec.minIp) return null;
        return { pitcherId: s.pitcherId, pitcherName: s.pitcherName, value: v };
      })
      .filter((x): x is { pitcherId: string; pitcherName: string; value: number } => x !== null);

    if (candidates.length === 0) return { ...spec, leader: null };

    const sorted = candidates.sort((a, b) =>
      spec.direction === 'min' ? a.value - b.value : b.value - a.value,
    );
    return { ...spec, leader: sorted[0] };
  });
}

// --- Cohorts ---

export interface CohortMember {
  pitcherId: string;
  pitcherName: string;
  drivingValue: string;
}

export interface Cohort {
  id: string;
  label: string;
  description: string;
  members: CohortMember[];
}

function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function findCohorts(snapshots: PitcherSnapshotInput[]): Cohort[] {
  const cohorts: Cohort[] = [];

  // --- Strike-zone work ---
  const strikeZoneMembers: CohortMember[] = [];
  for (const s of snapshots) {
    const fps = num(s.latest, 'pit_fps_pct');
    const bbInn = num(s.latest, 'pit_bb_pct_inn');
    const reasons: string[] = [];
    if (fps !== null && fps < 50) reasons.push(`FPS ${fps.toFixed(0)}%`);
    if (bbInn !== null && bbInn > 1.5) reasons.push(`BB/INN ${bbInn.toFixed(2)}`);
    if (reasons.length > 0) {
      strikeZoneMembers.push({
        pitcherId: s.pitcherId,
        pitcherName: s.pitcherName,
        drivingValue: reasons.join(' · '),
      });
    }
  }
  if (strikeZoneMembers.length > 0) {
    cohorts.push({
      id: 'strike-zone-work',
      label: 'Strike-zone work',
      description: 'FPS% below 50 or BB/INN above 1.5 — candidates for control bullpen.',
      members: strikeZoneMembers,
    });
  }

  // --- Arm-load watch ---
  const armLoadMembers: CohortMember[] = [];
  for (const s of snapshots) {
    const pIp = num(s.latest, 'pit_p_pct_ip');
    const rest = s.avgDaysBetweenOutings;
    if (pIp !== null && pIp > 18 && rest !== undefined && rest !== null && rest < 3) {
      armLoadMembers.push({
        pitcherId: s.pitcherId,
        pitcherName: s.pitcherName,
        drivingValue: `${pIp.toFixed(1)} P/IP · ${rest.toFixed(1)} days rest`,
      });
    }
  }
  if (armLoadMembers.length > 0) {
    cohorts.push({
      id: 'arm-load-watch',
      label: 'Arm-load watch',
      description: 'High pitches per inning combined with short rest — review workload.',
      members: armLoadMembers,
    });
  }

  // --- Mix imbalance ---
  const mixMembers: CohortMember[] = [];
  for (const s of snapshots) {
    const fb = num(s.latest, 'pit_fb');
    const ct = num(s.latest, 'pit_ct') ?? 0;
    const cb = num(s.latest, 'pit_cb') ?? 0;
    const sl = num(s.latest, 'pit_sl') ?? 0;
    const ch = num(s.latest, 'pit_ch') ?? 0;
    const os = num(s.latest, 'pit_os') ?? 0;
    if (fb === null) continue;
    const total = fb + ct + cb + sl + ch + os;
    if (total < 30) continue;
    const buckets: Array<{ label: string; share: number }> = [
      { label: 'FB', share: fb / total },
      { label: 'CT', share: ct / total },
      { label: 'CB', share: cb / total },
      { label: 'SL', share: sl / total },
      { label: 'CH', share: ch / total },
      { label: 'OS', share: os / total },
    ];
    const dominant = buckets.sort((a, b) => b.share - a.share)[0];
    if (dominant.share >= 0.85) {
      mixMembers.push({
        pitcherId: s.pitcherId,
        pitcherName: s.pitcherName,
        drivingValue: `${dominant.label} ${pct(dominant.share)} of mix`,
      });
    }
  }
  if (mixMembers.length > 0) {
    cohorts.push({
      id: 'mix-imbalance',
      label: 'Mix imbalance',
      description: 'One pitch type is 85%+ of the arsenal — bullpen focus on a secondary.',
      members: mixMembers,
    });
  }

  // --- Dominance trending down (needs previous snapshot) ---
  const decliningMembers: CohortMember[] = [];
  for (const s of snapshots) {
    const latest = num(s.latest, 'pit_k_pct_bf');
    const prev = num(s.previous, 'pit_k_pct_bf');
    if (latest === null || prev === null || prev === 0) continue;
    const delta = (latest - prev) / prev;
    if (delta <= -0.2) {
      decliningMembers.push({
        pitcherId: s.pitcherId,
        pitcherName: s.pitcherName,
        drivingValue: `K/BF ${pct(Math.abs(delta))} lower`,
      });
    }
  }
  if (decliningMembers.length > 0) {
    cohorts.push({
      id: 'dominance-down',
      label: 'Dominance trending down',
      description: 'K/BF dropped 20%+ since last snapshot — check pitch shapes or mechanics.',
      members: decliningMembers,
    });
  }

  return cohorts;
}

// --- Team rate stats + insights ---

/**
 * Team-wide rate stats derived from summing raw counts across pitchers.
 * Used by generateTeamInsights to fire group-level rules — think "what
 * should we drill in practice this week."
 */
export interface TeamRateStats {
  // Pitching
  pit_era: number | null;
  pit_whip: number | null;
  pit_fps_pct: number | null;
  pit_bb_pct_inn: number | null;
  pit_k_pct_bf: number | null;
  // Hitting
  bat_ops: number | null;
  bat_k_pct: number | null;
  bat_qab_pct: number | null;
  bat_ba_pct_risp: number | null;
}

function weightedMean(
  snapshots: PitcherSnapshotInput[],
  valueKey: string,
  weightKey: string,
): number | null {
  let num = 0;
  let denom = 0;
  for (const s of snapshots) {
    const v = num_(s.latest, valueKey);
    const w = num_(s.latest, weightKey);
    if (v !== null && w !== null && w > 0) {
      num += v * w;
      denom += w;
    }
  }
  return denom > 0 ? num / denom : null;
}

// Renamed alias to avoid shadowing the module-local `num` helper below.
function num_(stats: Record<string, StatValue> | null | undefined, key: string): number | null {
  return num(stats, key);
}

/**
 * Compute the team-wide rate stats used by the insight rules. Uses proper
 * baseball math (weighted by the correct denominator) instead of naive
 * averages across pitchers.
 */
export function computeTeamRateStats(snapshots: PitcherSnapshotInput[]): TeamRateStats {
  const agg = aggregateTeamStats(snapshots);

  // Pitching-side counting stats we need beyond the aggregate:
  const totalIp = sumStat(snapshots, 'pit_ip');
  const totalBb = sumStat(snapshots, 'pit_bb');
  const totalBf = sumStat(snapshots, 'pit_bf');
  const totalSoPitching = sumStat(snapshots, 'pit_so');

  const bb_pct_inn = totalIp !== null && totalIp > 0 && totalBb !== null ? totalBb / totalIp : null;
  const k_pct_bf = totalBf !== null && totalBf > 0 && totalSoPitching !== null ? totalSoPitching / totalBf : null;

  // FPS% is a per-pitcher rate — weight by BF so control-heavy starters count
  // proportional to their exposure.
  const fps_pct = weightedMean(snapshots, 'pit_fps_pct', 'pit_bf');

  // Hitting-side.
  const totalBatSo = sumStat(snapshots, 'bat_so');
  const totalBatPa = sumStat(snapshots, 'bat_pa');
  const bat_k_pct = totalBatPa !== null && totalBatPa > 0 && totalBatSo !== null
    ? (totalBatSo / totalBatPa) * 100
    : null;

  // OPS, QAB%, BA/RISP: weighted mean by PA. Falls back to null if PA missing.
  const bat_ops = weightedMean(snapshots, 'bat_ops', 'bat_pa');
  const bat_qab_pct = weightedMean(snapshots, 'bat_qab_pct', 'bat_pa');
  const bat_ba_pct_risp = weightedMean(snapshots, 'bat_ba_pct_risp', 'bat_pa');

  return {
    pit_era: agg.era,
    pit_whip: agg.whip,
    pit_fps_pct: fps_pct,
    pit_bb_pct_inn: bb_pct_inn,
    pit_k_pct_bf: k_pct_bf,
    bat_ops,
    bat_k_pct,
    bat_qab_pct,
    bat_ba_pct_risp,
  };
}

export type TeamInsightKind = 'focus' | 'momentum' | 'strength';
export type TeamInsightCategory = 'pitching' | 'hitting' | 'general';

export interface TeamInsight {
  kind: TeamInsightKind;
  category: TeamInsightCategory;
  message: string;
  /** Metric key that drives this insight — useful for grouping in the UI. */
  metric?: string;
}

const INSIGHT_ORDER: Record<TeamInsightKind, number> = {
  focus: 0,
  momentum: 1,
  strength: 2,
};

/**
 * Rule-based team focus areas. Runs against team rate stats (and optionally a
 * previous snapshot for trend rules) and returns an ordered list of concrete
 * things the group should work on, celebrate, or notice.
 */
export function generateTeamInsights(
  current: TeamRateStats,
  previous: TeamRateStats | null,
): TeamInsight[] {
  const insights: TeamInsight[] = [];
  const push = (i: TeamInsight) => insights.push(i);

  // --- Pitching focus ---
  if (current.pit_fps_pct !== null) {
    if (current.pit_fps_pct < 50) {
      push({ kind: 'focus', category: 'pitching', metric: 'pit_fps_pct',
        message: `First-pitch strikes at ${current.pit_fps_pct.toFixed(0)}% — team-wide focus on getting ahead in the count.` });
    } else if (current.pit_fps_pct >= 60) {
      push({ kind: 'strength', category: 'pitching', metric: 'pit_fps_pct',
        message: `First-pitch strikes at ${current.pit_fps_pct.toFixed(0)}% — team is consistently ahead.` });
    }
  }

  if (current.pit_bb_pct_inn !== null && current.pit_bb_pct_inn > 1.0) {
    push({ kind: 'focus', category: 'pitching', metric: 'pit_bb_pct_inn',
      message: `Team walking ${current.pit_bb_pct_inn.toFixed(2)} per inning — strike-zone bullpen this week.` });
  }

  if (current.pit_era !== null && current.pit_era < 3.5) {
    push({ kind: 'strength', category: 'pitching', metric: 'pit_era',
      message: `Team ERA at ${current.pit_era.toFixed(2)} — run prevention is a real strength.` });
  } else if (current.pit_era !== null && current.pit_era > 6.0) {
    push({ kind: 'focus', category: 'pitching', metric: 'pit_era',
      message: `Team ERA at ${current.pit_era.toFixed(2)} — pitching is giving up too many runs.` });
  }

  if (current.pit_whip !== null && current.pit_whip < 1.2) {
    push({ kind: 'strength', category: 'pitching', metric: 'pit_whip',
      message: `Team WHIP at ${current.pit_whip.toFixed(2)} — limiting baserunners.` });
  }

  // --- Hitting focus ---
  if (current.bat_k_pct !== null && current.bat_k_pct > 25) {
    push({ kind: 'focus', category: 'hitting', metric: 'bat_k_pct',
      message: `Team striking out on ${current.bat_k_pct.toFixed(0)}% of PAs — two-strike approach drill.` });
  }

  if (current.bat_qab_pct !== null && current.bat_qab_pct < 30) {
    push({ kind: 'focus', category: 'hitting', metric: 'bat_qab_pct',
      message: `Team QAB% at ${current.bat_qab_pct.toFixed(0)}% — grinding out at-bats needs work.` });
  } else if (current.bat_qab_pct !== null && current.bat_qab_pct >= 40) {
    push({ kind: 'strength', category: 'hitting', metric: 'bat_qab_pct',
      message: `Team QAB% at ${current.bat_qab_pct.toFixed(0)}% — hitters are competing.` });
  }

  if (current.bat_ba_pct_risp !== null && current.bat_ba_pct_risp < 0.200) {
    push({ kind: 'focus', category: 'hitting', metric: 'bat_ba_pct_risp',
      message: `Team hitting ${current.bat_ba_pct_risp.toFixed(3)} with RISP — clutch AB reps in practice.` });
  } else if (current.bat_ba_pct_risp !== null && current.bat_ba_pct_risp >= 0.300) {
    push({ kind: 'strength', category: 'hitting', metric: 'bat_ba_pct_risp',
      message: `Team hitting ${current.bat_ba_pct_risp.toFixed(3)} with RISP — clutch is a strength.` });
  }

  if (current.bat_ops !== null && current.bat_ops >= 0.800) {
    push({ kind: 'strength', category: 'hitting', metric: 'bat_ops',
      message: `Team OPS at ${current.bat_ops.toFixed(3)} — bats producing across the board.` });
  }

  // --- Trend / momentum ---
  if (previous) {
    if (current.pit_whip !== null && previous.pit_whip !== null) {
      const delta = current.pit_whip - previous.pit_whip;
      if (delta <= -0.2) {
        push({ kind: 'momentum', category: 'pitching', metric: 'pit_whip',
          message: `Team WHIP down from ${previous.pit_whip.toFixed(2)} to ${current.pit_whip.toFixed(2)} — pitching trending up.` });
      } else if (delta >= 0.2) {
        push({ kind: 'focus', category: 'pitching', metric: 'pit_whip',
          message: `Team WHIP up from ${previous.pit_whip.toFixed(2)} to ${current.pit_whip.toFixed(2)} — recent slippage.` });
      }
    }
    if (current.bat_ops !== null && previous.bat_ops !== null) {
      const delta = current.bat_ops - previous.bat_ops;
      if (delta >= 0.050) {
        push({ kind: 'momentum', category: 'hitting', metric: 'bat_ops',
          message: `Team OPS up from ${previous.bat_ops.toFixed(3)} to ${current.bat_ops.toFixed(3)} — bats are heating up.` });
      } else if (delta <= -0.050) {
        push({ kind: 'focus', category: 'hitting', metric: 'bat_ops',
          message: `Team OPS down from ${previous.bat_ops.toFixed(3)} to ${current.bat_ops.toFixed(3)} — offense needs a jolt.` });
      }
    }
  }

  insights.sort((a, b) => INSIGHT_ORDER[a.kind] - INSIGHT_ORDER[b.kind]);
  return insights;
}

// --- Top-level convenience ---

export interface TeamHealthReport {
  aggregates: TeamAggregates;
  leaderboards: LeaderboardEntry[];
  cohorts: Cohort[];
  teamInsights: TeamInsight[];
  teamRateStats: TeamRateStats;
}

export function buildTeamHealthReport(
  snapshots: PitcherSnapshotInput[],
  previousSnapshots?: PitcherSnapshotInput[],
): TeamHealthReport {
  const teamRateStats = computeTeamRateStats(snapshots);
  const previousRateStats = previousSnapshots
    ? computeTeamRateStats(previousSnapshots)
    : null;
  return {
    aggregates: aggregateTeamStats(snapshots),
    leaderboards: computeLeaderboards(snapshots),
    cohorts: findCohorts(snapshots),
    teamRateStats,
    teamInsights: generateTeamInsights(teamRateStats, previousRateStats),
  };
}
