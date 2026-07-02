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
export type CeilingMode = '10' | '15' | '20' | 'off';

export interface RankingOptions {
  /** Reef cut-off as a team percentile (15th / 25th / 50th). */
  reefMode: ReefMode;
  /**
   * Ceiling cut-off as a team percentile from the top — 10 = top 10%,
   * 15 = top 15% (default), 20 = top 20%. Set to 'off' to hide.
   * Players above the ceiling render with a highlighted color and get an
   * `aboveCeiling: true` flag on their PlayerRanking.
   */
  ceilingMode?: CeilingMode;
  /**
   * Hard sample-size floor on plate appearances. Players below this PA count
   * are excluded from the ranking and surfaced separately so a 5-PA outlier
   * can't out-rank an 80-PA regular. 0 disables.
   */
  minPlateAppearances?: number;
  /**
   * Pitching participation floor in innings. A player's defense score is
   * scaled by min(1, IP / floor) — semi-regular pitchers (5+ IP) are
   * unaffected, but kids who barely or never pitch can't lean on FPCT alone
   * to inflate their defense bucket. Set to 0 to disable.
   */
  pitchingParticipationFloor?: number;
  /** Limit ranking to one side of the ball. Defaults to 'all'. */
  filter?: RankingFilter;
}

/** Default participation threshold — coaches can override per-call later. */
export const DEFAULT_PITCHING_PARTICIPATION_FLOOR = 5;

// --- Output shapes ---

export interface MetricContribution {
  key: string;
  label: string;
  /** Verb phrase like "limiting earned runs" — UI prepends "Owen excels at". */
  narration: string;
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
  /** Defense after participation factor applied (so non-pitchers can't lean on FPCT). */
  defenseScore: number | null;
  /** Pre-factor defense — useful for tooltips so coaches can see the raw read. */
  defenseScoreRaw: number | null;
  intangiblesScore: number | null;
  /** Min-max-normalized IP across the team — informational, drives the Radar axis. */
  pitchingVolumeScore: number | null;
  /** 0-1 multiplier applied to the defense score (1 = no penalty). */
  participationFactor: number;
  /** True when participationFactor < 1 — surface as a "Limited pitching" badge. */
  belowParticipationFloor: boolean;
  /** Raw IP from the latest snapshot (or 0 when no data). */
  inningsPitched: number;
  /** Composite, 0-100. Always defined (defaults to 0 with no data). */
  playerValue: number;
  belowReef: boolean;
  /**
   * True when the player's Player Value is at or above the ceiling — top
   * N% of the team. Renders as a highlighted color / badge in the UI.
   */
  aboveCeiling: boolean;
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
  /** PV at the ceiling cut-off — players at/above are `aboveCeiling`. */
  ceilingThreshold: number | null;
  /** Percentile from the top used for the ceiling (10 / 15 / 20), null when off. */
  ceilingPercentile: number | null;
}

// --- Metric configuration ---

export type MetricBucket = 'offense' | 'defense' | 'intangibles';

interface MetricConfig {
  key: string;
  label: string;
  /** Long-form name shown in the legend below the table. */
  description: string;
  /**
   * Verb-phrase used in the "Why ranked here?" popover. Reads as
   *   "Owen excels at <narration>."
   * Should be short, action-oriented, no leading article.
   */
  narration: string;
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
  { key: 'bat_ops', label: 'OPS', description: 'On-base + slugging', narration: 'producing at the plate (on-base + power)', higherIsBetter: true, bucket: 'offense', weight: 2 },
  { key: 'bat_r', label: 'R', description: 'Runs scored', narration: 'scoring runs', higherIsBetter: true, bucket: 'offense', weight: 1 },
  { key: 'bat_rbi', label: 'RBI', description: 'Runs batted in', narration: 'driving in runs', higherIsBetter: true, bucket: 'offense', weight: 1 },
  // QAB% counts walks + sac bunts + sac flies as quality at-bats, which
  // double-credits patient hitters who already get BB/K. Halved to 0.5 so
  // a kid who walks a lot but never swings doesn't get a second bump.
  { key: 'bat_qab_pct', label: 'QAB%', description: 'Quality at-bats per plate appearance', narration: 'grinding out quality at-bats', higherIsBetter: true, bucket: 'offense', weight: 0.5 },
  { key: 'bat_bb_pct_k', label: 'BB/K', description: 'Walks per strikeout', narration: 'controlling the strike zone (more walks than strikeouts)', higherIsBetter: true, bucket: 'offense', weight: 1 },
  { key: 'bat_ba_pct_risp', label: 'BA/RISP', description: 'Batting average with runners in scoring position', narration: 'delivering with runners in scoring position', higherIsBetter: true, bucket: 'offense', weight: 1 },
  // K% derived from SO / PA. Lower is better — at 12U, putting the ball in
  // play matters more than at any other level because defenses make errors.
  {
    key: 'bat_k_pct_derived',
    label: 'K%',
    description: 'Strikeout rate (SO / PA) — lower is better',
    narration: 'putting the ball in play (rarely strikes out)',
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
  { key: 'pit_era', label: 'ERA', description: 'Earned run average', narration: 'limiting earned runs', higherIsBetter: false, bucket: 'defense', weight: 2 },
  { key: 'pit_whip', label: 'WHIP', description: 'Walks + hits per inning pitched', narration: 'limiting baserunners', higherIsBetter: false, bucket: 'defense', weight: 2 },
  { key: 'pit_fps_pct', label: 'FPS%', description: 'First-pitch strike percentage', narration: 'getting ahead in the count', higherIsBetter: true, bucket: 'defense', weight: 1 },
  { key: 'pit_k_pct_bf', label: 'K/BF', description: 'Strikeouts per batter faced', narration: 'punching out hitters', higherIsBetter: true, bucket: 'defense', weight: 1 },
  { key: 'pit_s_pct', label: 'Strike %', description: 'Pitches thrown for strikes', narration: 'pounding the strike zone', higherIsBetter: true, bucket: 'defense', weight: 1 },
  // Defense (fielding) — minimal weight because the metric depends heavily on
  // how often the ball reaches the player at all.
  { key: 'field_fpct', label: 'FPCT', description: 'Fielding percentage', narration: 'fielding cleanly when the ball comes', higherIsBetter: true, bucket: 'defense', weight: 0.25 },

  // Intangibles — coach-assigned subjective ratings. Each one becomes
  // 0 / 50 / 100 (minus / even / plus). Null when not rated.
  { key: 'intangibles_effort', label: 'Effort', description: 'Coach rating: hustle and intensity', narration: 'bringing effort and intensity', higherIsBetter: true, bucket: 'intangibles', weight: 1 },
  { key: 'intangibles_coachability', label: 'Coach', description: 'Coach rating: takes instruction, applies feedback', narration: 'applying coaching feedback', higherIsBetter: true, bucket: 'intangibles', weight: 1 },
  { key: 'intangibles_baseball_iq', label: 'BB IQ', description: 'Coach rating: situational awareness, baseball decisions', narration: 'reading the game and making smart decisions', higherIsBetter: true, bucket: 'intangibles', weight: 1 },
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
  const participationFloor = options.pitchingParticipationFloor ?? DEFAULT_PITCHING_PARTICIPATION_FLOOR;

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
        contributions.push({
          key: m.key,
          label: m.label,
          narration: m.narration,
          bucket: m.bucket,
          score: v,
          weight: m.weight,
        });
      }
    }
    const offenseScore = weightedMeanIgnoringNaN(
      offenseMetrics.map((m) => ({ value: normalizedByKey.get(m.key)?.[idx] ?? NaN, weight: m.weight })),
    );
    const defenseScoreRaw = weightedMeanIgnoringNaN(
      defenseMetrics.map((m) => ({ value: normalizedByKey.get(m.key)?.[idx] ?? NaN, weight: m.weight })),
    );
    const intangiblesScore = weightedMeanIgnoringNaN(
      intangiblesMetrics.map((m) => ({ value: normalizedByKey.get(m.key)?.[idx] ?? NaN, weight: m.weight })),
    );
    const pitchingVolumeScore = Number.isFinite(ipNormalized[idx]) ? ipNormalized[idx] : null;

    // Pitching participation. Scales the defense score down for kids who
    // barely or never pitch (so they can't ride a great FPCT to a high
    // defense bucket). Semi-regular pitchers (>= floor IP) are unaffected.
    const ipRaw = Number.isFinite(rawIp[idx]) ? rawIp[idx] : 0;
    const participationFactor = participationFloor <= 0
      ? 1
      : Math.min(1, ipRaw / participationFloor);
    const defenseScore = defenseScoreRaw === null ? null : defenseScoreRaw * participationFactor;

    // Bucket weights. Offense + Defense split 50/50; Intangibles 0.1 when
    // any rating exists. No separate IP-volume bucket — participation is
    // baked into the defense score above.
    // Bucket weights — kept in sync with BUCKET_WEIGHTS so the runtime
    // math matches the auditable weighting chart. Intangibles drops to 0
    // for unrated players so their PV is offense + defense alone.
    const wOff = BUCKET_WEIGHTS.offense;
    const wDef = BUCKET_WEIGHTS.defense;
    const wIntangibles = intangiblesScore !== null ? BUCKET_WEIGHTS.intangibles : 0;
    // Active weights re-normalize automatically because we only count
    // components that are present.
    const wPairs: Array<[number | null, number]> = [
      [offenseScore, wOff],
      [defenseScore, wDef],
      [intangiblesScore, wIntangibles],
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
      defenseScoreRaw,
      intangiblesScore,
      pitchingVolumeScore,
      participationFactor,
      belowParticipationFloor: participationFactor < 1,
      inningsPitched: ipRaw,
      playerValue,
      belowReef: false,
      belowMinPa: !eligibleMask[idx],
      hasOffense: offenseScore !== null,
      hasDefense: defenseScore !== null,
      hasIntangibles: intangiblesScore !== null,
      hasPitching: rawIp[idx] > 0,
      aboveCeiling: false,
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

  // 8) Ceiling — top N% of eligible players (inverse of the reef). PV at
  //    OR above the threshold flags aboveCeiling. 'off' hides the flag.
  const ceilingMode: CeilingMode = options.ceilingMode ?? '15';
  let ceilingThreshold: number | null = null;
  let ceilingPercentile: number | null = null;
  if (ceilingMode !== 'off' && sortedAsc.length > 0) {
    ceilingPercentile = ceilingMode === '10' ? 10 : ceilingMode === '15' ? 15 : 20;
    // 100 − ceilingPercentile gives the ASC-side cut. E.g., top 15% -> the
    // 85th-percentile PV; anyone at or above becomes aboveCeiling.
    ceilingThreshold = percentileThreshold(sortedAsc, 100 - ceilingPercentile);
    for (const p of eligible) {
      p.aboveCeiling = p.playerValue >= ceilingThreshold;
    }
  }

  return {
    rankings: eligible,
    excluded,
    reefThreshold,
    reefPercentile,
    ceilingThreshold,
    ceilingPercentile,
  };
}

/** Public helper so the UI can label the metric breakdown columns + legend. */
export const METRIC_LABELS: Array<{
  key: string;
  label: string;
  description: string;
  narration: string;
  bucket: MetricBucket;
  weight: number;
}> = METRICS.map((m) => ({
  key: m.key,
  label: m.label,
  description: m.description,
  narration: m.narration,
  bucket: m.bucket,
  weight: m.weight,
}));

/**
 * Auditable bucket-level weights that drive the composite Player Value.
 * Chosen to sum to exactly 1.0 so the Weighting chart displays clean whole
 * numbers (45 + 45 + 10 = 100%) rather than renormalization artifacts.
 */
export const BUCKET_WEIGHTS = {
  offense: 0.45,
  defense: 0.45,
  intangibles: 0.10,
} as const;

export interface MetricContributionBreakdown {
  key: string;
  label: string;
  bucket: MetricBucket;
  /** Raw weight as authored in METRICS. */
  rawWeight: number;
  /** Share of its bucket (raw weight / sum of bucket raw weights). */
  shareOfBucket: number;
  /** Share of total PV when all buckets are present (bucket weight * share). */
  shareOfPv: number;
}

/**
 * Build a per-metric contribution table that shows how each metric flows into
 * the final composite. Both shares are returned so the UI can audit either
 * "what drives this bucket" or "what drives the whole PV."
 */
export function buildWeightingBreakdown(): {
  rows: MetricContributionBreakdown[];
  bucketShares: Record<MetricBucket, number>;
} {
  const bucketRawSum: Record<MetricBucket, number> = { offense: 0, defense: 0, intangibles: 0 };
  for (const m of METRICS) bucketRawSum[m.bucket] += m.weight;

  const sumBuckets = BUCKET_WEIGHTS.offense + BUCKET_WEIGHTS.defense + BUCKET_WEIGHTS.intangibles;

  const bucketShares: Record<MetricBucket, number> = {
    offense: BUCKET_WEIGHTS.offense / sumBuckets,
    defense: BUCKET_WEIGHTS.defense / sumBuckets,
    intangibles: BUCKET_WEIGHTS.intangibles / sumBuckets,
  };

  const rows: MetricContributionBreakdown[] = METRICS.map((m) => {
    const shareOfBucket = bucketRawSum[m.bucket] === 0 ? 0 : m.weight / bucketRawSum[m.bucket];
    const shareOfPv = bucketShares[m.bucket] * shareOfBucket;
    return {
      key: m.key,
      label: m.label,
      bucket: m.bucket,
      rawWeight: m.weight,
      shareOfBucket,
      shareOfPv,
    };
  });

  return { rows, bucketShares };
}
