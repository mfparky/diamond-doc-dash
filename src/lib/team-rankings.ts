import type { StatValue } from './stat-csv';

// --- Inputs / options ---

export type CoachRating = 'minus' | 'even' | 'plus' | null;

export interface RankingInput {
  pitcherId: string;
  pitcherName: string;
  /** Most recent uploaded snapshot. Pass null for players with no snapshot. */
  latest: Record<string, StatValue> | null;
  /** Subjective coach ratings (null = not rated). */
  effortRating?: CoachRating;
  coachabilityRating?: CoachRating;
  baseballIqRating?: CoachRating;
}

export type RankingFilter = 'all' | 'hitters' | 'pitchers';

export type ReefMode = '15' | '25' | '50';

export interface RankingOptions {
  /**
   * When true, adds a 3rd component (pitching IP volume) to Player Value so
   * innings-eaters get credit beyond their pitching rate stats. Toggleable
   * because dominant 12U fastballs don't always translate forward.
   */
  includePitchingVolume: boolean;
  /** Reef cut-off as a team percentile (15th / 25th / 50th). */
  reefMode: ReefMode;
  /**
   * Hard sample-size floor on plate appearances. Players below this PA count
   * are excluded from the ranking and surfaced separately so a 5-PA outlier
   * can't out-rank an 80-PA regular. 0 disables.
   */
  minPlateAppearances?: number;
  /** Limit ranking to one side of the ball. Defaults to 'all'. */
  filter?: RankingFilter;
}

// --- Output shapes ---

export interface MetricContribution {
  key: string;
  label: string;
  bucket: MetricBucket;
  /** 0-100 normalized score for this metric. */
  score: number;
  /** Weight within its bucket — used to surface the top drivers. */
  weight: number;
}

export interface PlayerRanking {
  pitcherId: string;
  pitcherName: string;
  /** 0-100 within the team — null when no metric data in this bucket exists. */
  offenseScore: number | null;
  defenseScore: number | null;
  intangiblesScore: number | null;
  pitchingVolumeScore: number | null;
  /** Composite, 0-100. Always defined (defaults to 0 with no data). */
  playerValue: number;
  belowReef: boolean;
  /** True when the player's PA count is below the configured minimum. */
  belowMinPa: boolean;
  hasOffense: boolean;
  hasDefense: boolean;
  hasIntangibles: boolean;
  hasPitching: boolean;
  /** Per-metric normalized contributions (0-100) — drives the breakdown table. */
  metricBreakdown: Record<string, number | null>;
  /** Top metric drivers (weighted) — drives the "Why ranked here?" tooltip. */
  topDrivers: MetricContribution[];
}

export interface RankingResult {
  /** Players sorted high → low by Player Value (excluded ones at bottom, muted). */
  rankings: PlayerRanking[];
  /** Players filtered out for low sample size — surface separately in the UI. */
  excluded: PlayerRanking[];
  reefThreshold: number;
  reefPercentile: number;
}

// --- Metric configuration ---

export type MetricBucket = 'offense' | 'defense' | 'intangibles';

interface MetricConfig {
  key: string;
  label: string;
  /** Long-form name shown in the legend below the table. */
  description: string;
  /** Whether a higher raw value is better (e.g. OPS) or worse (e.g. ERA). */
  higherIsBetter: boolean;
  /** Bucket the metric contributes to. */
  bucket: MetricBucket;
  /**
   * Relative weight within its bucket. Defaults to 1 for "standard" metrics.
   * Raise for headline metrics (OPS, R, RBI, ERA, WHIP); lower for noisy
   * ones that depend heavily on opportunity (FPCT — some kids barely see
   * the ball).
   */
  weight: number;
  /**
   * Optional derived-value function. When present, called per-player with
   * the player's snapshot and the result is used as the raw metric value
   * (e.g., bat_k_pct is computed from bat_so / bat_pa rather than read
   * directly).
   */
  derive?: (stats: Record<string, StatValue> | null) => number;
}

function readNumRaw(stats: Record<string, StatValue> | null, key: string): number {
  if (!stats) return NaN;
  const v = stats[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : NaN;
}

const METRICS: MetricConfig[] = [
  // Offense
  // OPS stays the headline rate metric. R + RBI were originally weight 2
  // but they're heavily team-context-dependent (you score more if you bat
  // behind a kid who walks a lot), so dropping them to 1 each puts more
  // weight on individual rate stats than situational counting stats.
  { key: 'bat_ops', label: 'OPS', description: 'On-base + slugging', higherIsBetter: true, bucket: 'offense', weight: 2 },
  { key: 'bat_r', label: 'R', description: 'Runs scored', higherIsBetter: true, bucket: 'offense', weight: 1 },
  { key: 'bat_rbi', label: 'RBI', description: 'Runs batted in', higherIsBetter: true, bucket: 'offense', weight: 1 },
  { key: 'bat_qab_pct', label: 'QAB%', description: 'Quality at-bats per plate appearance', higherIsBetter: true, bucket: 'offense', weight: 1 },
  { key: 'bat_bb_pct_k', label: 'BB/K', description: 'Walks per strikeout', higherIsBetter: true, bucket: 'offense', weight: 1 },
  { key: 'bat_ba_pct_risp', label: 'BA/RISP', description: 'Batting average with runners in scoring position', higherIsBetter: true, bucket: 'offense', weight: 1 },
  // K% derived from SO / PA. Lower is better — at 12U, putting the ball in
  // play matters more than at any other level because defenses make errors.
  {
    key: 'bat_k_pct_derived',
    label: 'K%',
    description: 'Strikeout rate (SO / PA) — lower is better',
    higherIsBetter: false,
    bucket: 'offense',
    weight: 1,
    derive: (stats) => {
      const so = readNumRaw(stats, 'bat_so');
      const pa = readNumRaw(stats, 'bat_pa');
      if (!Number.isFinite(so) || !Number.isFinite(pa) || pa === 0) return NaN;
      return (so / pa) * 100;
    },
  },

  // Defense (pitching rates)
  { key: 'pit_era', label: 'ERA', description: 'Earned run average', higherIsBetter: false, bucket: 'defense', weight: 2 },
  { key: 'pit_whip', label: 'WHIP', description: 'Walks + hits per inning pitched', higherIsBetter: false, bucket: 'defense', weight: 2 },
  { key: 'pit_fps_pct', label: 'FPS%', description: 'First-pitch strike percentage', higherIsBetter: true, bucket: 'defense', weight: 1 },
  { key: 'pit_k_pct_bf', label: 'K/BF', description: 'Strikeouts per batter faced', higherIsBetter: true, bucket: 'defense', weight: 1 },
  { key: 'pit_s_pct', label: 'Strike %', description: 'Pitches thrown for strikes', higherIsBetter: true, bucket: 'defense', weight: 1 },
  // Defense (fielding) — minimal weight because the metric depends heavily on
  // how often the ball reaches the player at all.
  { key: 'field_fpct', label: 'FPCT', description: 'Fielding percentage', higherIsBetter: true, bucket: 'defense', weight: 0.25 },

  // Intangibles — coach-assigned subjective ratings. Each one becomes
  // 0 / 50 / 100 (minus / even / plus). Null when not rated.
  { key: 'intangibles_effort', label: 'Effort', description: 'Coach rating: hustle and intensity', higherIsBetter: true, bucket: 'intangibles', weight: 1 },
  { key: 'intangibles_coachability', label: 'Coach', description: 'Coach rating: takes instruction, applies feedback', higherIsBetter: true, bucket: 'intangibles', weight: 1 },
  { key: 'intangibles_baseball_iq', label: 'BB IQ', description: 'Coach rating: situational awareness, baseball decisions', higherIsBetter: true, bucket: 'intangibles', weight: 1 },
];

const COACH_RATING_TO_SCORE: Record<Exclude<CoachRating, null>, number> = {
  minus: 0,
  even: 50,
  plus: 100,
};

function coachRatingScore(rating: CoachRating | undefined): number {
  if (!rating) return NaN;
  return COACH_RATING_TO_SCORE[rating];
}

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

/** Read a metric's raw value for a player (handles derived + intangible metrics). */
function rawMetricValue(input: RankingInput, m: MetricConfig): number {
  if (m.bucket === 'intangibles') {
    if (m.key === 'intangibles_effort') return coachRatingScore(input.effortRating);
    if (m.key === 'intangibles_coachability') return coachRatingScore(input.coachabilityRating);
    if (m.key === 'intangibles_baseball_iq') return coachRatingScore(input.baseballIqRating);
    return NaN;
  }
  if (m.derive) return m.derive(input.latest);
  return readNum(input.latest, m.key);
}

/** Intangibles are already on a 0-100 scale and shouldn't be team-normalized. */
function intangiblesNormalized(values: number[], higherIsBetter: boolean): number[] {
  return values.map((v) => {
    if (!Number.isFinite(v)) return NaN;
    return higherIsBetter ? v : 100 - v;
  });
}

export function buildRankings(
  inputs: RankingInput[],
  options: RankingOptions,
): RankingResult {
  const filter: RankingFilter = options.filter ?? 'all';
  const minPa = options.minPlateAppearances ?? 0;

  // 1) Split inputs by sample-size floor. Excluded players still get scored
  //    but are surfaced separately so the chart isn't polluted by small samples.
  const eligibleMask = inputs.map((i) => {
    if (minPa <= 0) return true;
    const pa = readNum(i.latest, 'bat_pa');
    if (!Number.isFinite(pa)) return false;
    return pa >= minPa;
  });

  // 2) Filter metric set by 'all' | 'hitters' | 'pitchers'.
  const includeBucket = (b: MetricBucket): boolean => {
    if (filter === 'hitters') return b === 'offense' || b === 'intangibles';
    if (filter === 'pitchers') return b === 'defense' || b === 'intangibles';
    return true;
  };
  const activeMetrics = METRICS.filter((m) => includeBucket(m.bucket));

  // 3) Pre-normalize each ACTIVE metric across the team. For intangibles we
  //    don't team-normalize (raw values are already on a comparable 0-100 scale).
  const normalizedByKey = new Map<string, number[]>();
  for (const m of activeMetrics) {
    const raw = inputs.map((i) => rawMetricValue(i, m));
    const normalized = m.bucket === 'intangibles'
      ? intangiblesNormalized(raw, m.higherIsBetter)
      : minMaxNormalize(raw, m.higherIsBetter);
    normalizedByKey.set(m.key, normalized);
  }
  const rawIp = inputs.map((i) => readNum(i.latest, PITCHING_VOLUME_METRIC.key));
  const ipNormalized = minMaxNormalize(rawIp, true);

  const offenseMetrics = activeMetrics.filter((m) => m.bucket === 'offense');
  const defenseMetrics = activeMetrics.filter((m) => m.bucket === 'defense');
  const intangiblesMetrics = activeMetrics.filter((m) => m.bucket === 'intangibles');

  // 4) Compose per-player scores.
  const allRankings: PlayerRanking[] = inputs.map((input, idx) => {
    const breakdown: Record<string, number | null> = {};
    const contributions: MetricContribution[] = [];
    for (const m of activeMetrics) {
      const v = normalizedByKey.get(m.key)?.[idx] ?? NaN;
      breakdown[m.key] = Number.isFinite(v) ? v : null;
      if (Number.isFinite(v)) {
        contributions.push({ key: m.key, label: m.label, bucket: m.bucket, score: v, weight: m.weight });
      }
    }
    const offenseScore = weightedMeanIgnoringNaN(
      offenseMetrics.map((m) => ({ value: normalizedByKey.get(m.key)?.[idx] ?? NaN, weight: m.weight })),
    );
    const defenseScore = weightedMeanIgnoringNaN(
      defenseMetrics.map((m) => ({ value: normalizedByKey.get(m.key)?.[idx] ?? NaN, weight: m.weight })),
    );
    const intangiblesScore = weightedMeanIgnoringNaN(
      intangiblesMetrics.map((m) => ({ value: normalizedByKey.get(m.key)?.[idx] ?? NaN, weight: m.weight })),
    );
    const pitchingVolumeScore = Number.isFinite(ipNormalized[idx]) ? ipNormalized[idx] : null;

    // Bucket weights. Offense + Defense split 50/50 base. Intangibles get 0.1
    // (small but real). IP volume gets 0.15 when toggled on.
    const wOff = 0.5;
    const wDef = 0.5;
    const wIntangibles = intangiblesScore !== null ? 0.10 : 0;
    const wIp = options.includePitchingVolume ? 0.15 : 0;
    // Scale so the active weights sum to <= 1; missing components re-normalize
    // automatically because we only count what's present.
    const wPairs: Array<[number | null, number]> = [
      [offenseScore, wOff],
      [defenseScore, wDef],
      [intangiblesScore, wIntangibles],
      [options.includePitchingVolume ? pitchingVolumeScore : null, wIp],
    ];
    let pv = 0;
    let totalWeight = 0;
    for (const [score, weight] of wPairs) {
      if (score !== null && weight > 0) {
        pv += score * weight;
        totalWeight += weight;
      }
    }
    const playerValue = totalWeight > 0 ? pv / totalWeight : 0;

    // Top drivers: top 3 contributors by (score * weight).
    const topDrivers = contributions
      .map((c) => ({ ...c, _w: c.score * c.weight }))
      .sort((a, b) => b._w - a._w)
      .slice(0, 3)
      .map(({ _w, ...rest }) => rest);

    return {
      pitcherId: input.pitcherId,
      pitcherName: input.pitcherName,
      offenseScore,
      defenseScore,
      intangiblesScore,
      pitchingVolumeScore,
      playerValue,
      belowReef: false,
      belowMinPa: !eligibleMask[idx],
      hasOffense: offenseScore !== null,
      hasDefense: defenseScore !== null,
      hasIntangibles: intangiblesScore !== null,
      hasPitching: rawIp[idx] > 0,
      metricBreakdown: breakdown,
      topDrivers,
    };
  });

  // 5) Split into ranked (eligible) and excluded (below min PA).
  const eligible = allRankings.filter((r) => !r.belowMinPa);
  const excluded = allRankings.filter((r) => r.belowMinPa);

  // 6) Sort eligible descending by Player Value.
  eligible.sort((a, b) => b.playerValue - a.playerValue);
  excluded.sort((a, b) => b.playerValue - a.playerValue);

  // 7) Reef line at the chosen percentile — computed over the eligible set only.
  const reefPercentile = options.reefMode === '15' ? 15 : options.reefMode === '25' ? 25 : 50;
  const sortedAsc = eligible.map((p) => p.playerValue).sort((a, b) => a - b);
  const reefThreshold = percentileThreshold(sortedAsc, reefPercentile);
  for (const p of eligible) {
    p.belowReef = p.playerValue < reefThreshold;
  }

  return { rankings: eligible, excluded, reefThreshold, reefPercentile };
}

/** Public helper so the UI can label the metric breakdown columns + legend. */
export const METRIC_LABELS: Array<{
  key: string;
  label: string;
  description: string;
  bucket: MetricBucket;
  weight: number;
}> = METRICS.map((m) => ({
  key: m.key,
  label: m.label,
  description: m.description,
  bucket: m.bucket,
  weight: m.weight,
}));
