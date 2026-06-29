import type { StatValue } from './stat-csv';

// --- Inputs / options ---

export interface RankingInput {
  pitcherId: string;
  pitcherName: string;
  /** Most recent uploaded snapshot. Pass null for players with no snapshot. */
  latest: Record<string, StatValue> | null;
}

export type ReefMode = '15' | '25' | '50';

export interface RankingOptions {
  /**
   * When true, adds a 3rd component (pitching IP volume) to Player Value so
   * innings-eaters get credit beyond their pitching rate stats. Toggleable
   * because dominant 12U fastballs don't always translate forward.
   */
  includePitchingVolume: boolean;
  /** Reef cut-off as a team percentile (10th / 25th / 50th). */
  reefMode: ReefMode;
}

// --- Output shapes ---

export interface PlayerRanking {
  pitcherId: string;
  pitcherName: string;
  /** 0-100 within the team — null when no offensive metric data exists. */
  offenseScore: number | null;
  defenseScore: number | null;
  pitchingVolumeScore: number | null;
  /** Composite, 0-100. Always defined (defaults to 0 with no data). */
  playerValue: number;
  belowReef: boolean;
  hasOffense: boolean;
  hasDefense: boolean;
  hasPitching: boolean;
  /** Per-metric normalized contributions (0-100) — drives the breakdown table. */
  metricBreakdown: Record<string, number | null>;
}

export interface RankingResult {
  /** Players sorted high → low by Player Value. */
  rankings: PlayerRanking[];
  reefThreshold: number;
  reefPercentile: number;
}

// --- Metric configuration ---

interface MetricConfig {
  key: string;
  label: string;
  /** Long-form name shown in the legend below the table. */
  description: string;
  /** Whether a higher raw value is better (e.g. OPS) or worse (e.g. ERA). */
  higherIsBetter: boolean;
  /** Bucket the metric contributes to. */
  bucket: 'offense' | 'defense';
  /**
   * Relative weight within its bucket. Defaults to 1 for "standard" metrics.
   * Raise for headline metrics (OPS, R, RBI, ERA, WHIP); lower for noisy
   * ones that depend heavily on opportunity (FPCT — some kids barely see
   * the ball).
   */
  weight: number;
}

const METRICS: MetricConfig[] = [
  // Offense
  { key: 'bat_ops', label: 'OPS', description: 'On-base + slugging', higherIsBetter: true, bucket: 'offense', weight: 2 },
  { key: 'bat_r', label: 'R', description: 'Runs scored', higherIsBetter: true, bucket: 'offense', weight: 2 },
  { key: 'bat_rbi', label: 'RBI', description: 'Runs batted in', higherIsBetter: true, bucket: 'offense', weight: 2 },
  { key: 'bat_qab_pct', label: 'QAB%', description: 'Quality at-bats per plate appearance', higherIsBetter: true, bucket: 'offense', weight: 1 },
  { key: 'bat_bb_pct_k', label: 'BB/K', description: 'Walks per strikeout', higherIsBetter: true, bucket: 'offense', weight: 1 },
  { key: 'bat_ba_pct_risp', label: 'BA/RISP', description: 'Batting average with runners in scoring position', higherIsBetter: true, bucket: 'offense', weight: 1 },
  { key: 'bat_sb_pct', label: 'SB%', description: 'Stolen-base success rate', higherIsBetter: true, bucket: 'offense', weight: 1 },

  // Defense (pitching rates)
  { key: 'pit_era', label: 'ERA', description: 'Earned run average', higherIsBetter: false, bucket: 'defense', weight: 2 },
  { key: 'pit_whip', label: 'WHIP', description: 'Walks + hits per inning pitched', higherIsBetter: false, bucket: 'defense', weight: 2 },
  { key: 'pit_fps_pct', label: 'FPS%', description: 'First-pitch strike percentage', higherIsBetter: true, bucket: 'defense', weight: 1 },
  { key: 'pit_k_pct_bf', label: 'K/BF', description: 'Strikeouts per batter faced', higherIsBetter: true, bucket: 'defense', weight: 1 },
  // Defense (fielding) — minimal weight because the metric depends heavily on
  // how often the ball reaches the player at all.
  { key: 'field_fpct', label: 'FPCT', description: 'Fielding percentage', higherIsBetter: true, bucket: 'defense', weight: 0.25 },
];

const PITCHING_VOLUME_METRIC = { key: 'pit_ip', label: 'IP' };

// --- Helpers ---

function readNum(stats: Record<string, StatValue> | null, key: string): number {
  if (!stats) return NaN;
  const v = stats[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : NaN;
}

/**
 * Min-max scale to 0..100. Players whose value is NaN stay NaN (so they're
 * skipped from category averages without dragging them down). Constant
 * vectors collapse to 50 — no information, give everyone the median.
 */
function minMaxNormalize(values: number[], higherIsBetter: boolean): number[] {
  const valid = values.filter((v) => Number.isFinite(v));
  if (valid.length < 2) {
    return values.map((v) => (Number.isFinite(v) ? 50 : NaN));
  }
  const min = Math.min(...valid);
  const max = Math.max(...valid);
  if (min === max) {
    return values.map((v) => (Number.isFinite(v) ? 50 : NaN));
  }
  return values.map((v) => {
    if (!Number.isFinite(v)) return NaN;
    const scaled = ((v - min) / (max - min)) * 100;
    return higherIsBetter ? scaled : 100 - scaled;
  });
}

function meanIgnoringNaN(arr: number[]): number | null {
  const valid = arr.filter((v) => Number.isFinite(v));
  if (valid.length === 0) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

/**
 * Weighted mean that skips NaN values and re-normalizes weights to the
 * surviving items. So a player missing one metric is scored fairly on what's
 * present (weights for the missing metric drop out of the denominator).
 */
function weightedMeanIgnoringNaN(items: Array<{ value: number; weight: number }>): number | null {
  const valid = items.filter((it) => Number.isFinite(it.value));
  if (valid.length === 0) return null;
  const totalWeight = valid.reduce((sum, it) => sum + it.weight, 0);
  if (totalWeight === 0) return null;
  return valid.reduce((sum, it) => sum + it.value * it.weight, 0) / totalWeight;
}

/**
 * Returns the value at the given percentile of a sorted-ascending array.
 * Floor-index rule keeps the math intuitive: at 25th of 13 players the cutoff
 * is the 4th-lowest score (index 3) so 3 players sit strictly below.
 */
function percentileThreshold(sortedAsc: number[], percentile: number): number {
  if (sortedAsc.length === 0) return 0;
  const idx = Math.min(sortedAsc.length - 1, Math.floor((percentile / 100) * sortedAsc.length));
  return sortedAsc[idx];
}

// --- Public API ---

export function buildRankings(
  inputs: RankingInput[],
  options: RankingOptions,
): RankingResult {
  // 1) Pre-normalize each metric across the team so per-player z-scores are comparable.
  const normalizedByKey = new Map<string, number[]>();
  for (const m of METRICS) {
    const raw = inputs.map((i) => readNum(i.latest, m.key));
    normalizedByKey.set(m.key, minMaxNormalize(raw, m.higherIsBetter));
  }
  const rawIp = inputs.map((i) => readNum(i.latest, PITCHING_VOLUME_METRIC.key));
  const ipNormalized = minMaxNormalize(rawIp, true);

  const offenseMetrics = METRICS.filter((m) => m.bucket === 'offense');
  const defenseMetrics = METRICS.filter((m) => m.bucket === 'defense');

  // 2) Compose per-player scores.
  const playerRankings: PlayerRanking[] = inputs.map((input, idx) => {
    const breakdown: Record<string, number | null> = {};
    for (const m of METRICS) {
      const v = normalizedByKey.get(m.key)?.[idx] ?? NaN;
      breakdown[m.key] = Number.isFinite(v) ? v : null;
    }
    const offenseScore = weightedMeanIgnoringNaN(
      offenseMetrics.map((m) => ({ value: normalizedByKey.get(m.key)?.[idx] ?? NaN, weight: m.weight })),
    );
    const defenseScore = weightedMeanIgnoringNaN(
      defenseMetrics.map((m) => ({ value: normalizedByKey.get(m.key)?.[idx] ?? NaN, weight: m.weight })),
    );
    const pitchingVolumeScore = Number.isFinite(ipNormalized[idx]) ? ipNormalized[idx] : null;

    // Composite. Weights re-normalize if a player is missing one or more components,
    // so a position player with no defensive snapshot isn't dragged to 0.
    const offWeight = 0.5;
    const defWeight = 0.5;
    const ipWeight = options.includePitchingVolume ? 0.15 : 0;
    // When pitching volume is on, scale offense+defense to share the remaining 0.85.
    const baseScale = options.includePitchingVolume ? 0.85 : 1;
    const useOffWeight = offWeight * baseScale;
    const useDefWeight = defWeight * baseScale;

    let pv = 0;
    let totalWeight = 0;
    if (offenseScore !== null) {
      pv += useOffWeight * offenseScore;
      totalWeight += useOffWeight;
    }
    if (defenseScore !== null) {
      pv += useDefWeight * defenseScore;
      totalWeight += useDefWeight;
    }
    if (options.includePitchingVolume && pitchingVolumeScore !== null) {
      pv += ipWeight * pitchingVolumeScore;
      totalWeight += ipWeight;
    }
    const playerValue = totalWeight > 0 ? pv / totalWeight : 0;

    return {
      pitcherId: input.pitcherId,
      pitcherName: input.pitcherName,
      offenseScore,
      defenseScore,
      pitchingVolumeScore,
      playerValue,
      belowReef: false,
      hasOffense: offenseScore !== null,
      hasDefense: defenseScore !== null,
      hasPitching: rawIp[idx] > 0,
      metricBreakdown: breakdown,
    };
  });

  // 3) Sort descending by Player Value.
  playerRankings.sort((a, b) => b.playerValue - a.playerValue);

  // 4) Reef line at the chosen percentile.
  const reefPercentile = options.reefMode === '15' ? 15 : options.reefMode === '25' ? 25 : 50;
  const sortedAsc = playerRankings.map((p) => p.playerValue).sort((a, b) => a - b);
  const reefThreshold = percentileThreshold(sortedAsc, reefPercentile);
  for (const p of playerRankings) {
    p.belowReef = p.playerValue < reefThreshold;
  }

  return { rankings: playerRankings, reefThreshold, reefPercentile };
}

/** Public helper so the UI can label the metric breakdown columns + legend. */
export const METRIC_LABELS: Array<{
  key: string;
  label: string;
  description: string;
  bucket: 'offense' | 'defense';
}> = METRICS.map((m) => ({
  key: m.key,
  label: m.label,
  description: m.description,
  bucket: m.bucket,
}));
