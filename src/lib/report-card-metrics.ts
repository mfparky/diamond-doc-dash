import type { StatValue } from './stat-csv';
import type { CoachRating } from '@/hooks/use-pitchers';

/**
 * Core Metrics for the report card.
 *
 * Team-relative percentile → 4-band gradient. We deliberately do NOT use
 * absolute cutoffs (a 12U .400 hitter could be average or elite depending
 * on the league). The rankings module already normalizes team-wide, so
 * we reuse the same min-max approach here on a focused metric subset.
 *
 * Coaches can then ±nudge any metric if they see something the numbers
 * don't (a player carrying an injury, a kid who took a leadership role,
 * etc.). Nudges are clamped to [-2, +2] bands.
 */

export type MetricBand = 'needs-work' | 'developing' | 'strong' | 'excelling';

export interface CoreMetricInput {
  pitcherId: string;
  stats: Record<string, StatValue> | null;
  effortRating: CoachRating;
  coachabilityRating: CoachRating;
  baseballIqRating: CoachRating;
}

export interface CoreMetricDef {
  key: string;
  label: string;
  description: string;
  bucket: 'batting' | 'pitching' | 'fielding' | 'intangibles';
  higherIsBetter: boolean;
  /**
   * How to pull the raw value from a player's inputs. Returns NaN when the
   * player has no data for this metric (skipped from the normalization pool
   * rather than dragging the mean down).
   */
  read: (input: CoreMetricInput) => number;
}

export interface CoreMetric {
  def: CoreMetricDef;
  rawValue: number;
  /** 0..100, higher = better. NaN when the player has no data or team is too small. */
  percentile: number;
  /** Band chosen from the *auto* percentile — before coach adjustment. */
  autoBand: MetricBand | null;
  /** Coach ±nudge, clamped to [-2, +2]. 0 means no override. */
  adjustment: number;
  /** Band after applying the adjustment. */
  band: MetricBand | null;
}

const RATING_TO_SCORE: Record<Exclude<CoachRating, null>, number> = {
  minus: 0,
  even: 50,
  plus: 100,
};

function readStat(input: CoreMetricInput, key: string): number {
  const v = input.stats?.[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : NaN;
}

function ratingScore(rating: CoachRating): number {
  if (!rating) return NaN;
  return RATING_TO_SCORE[rating];
}

/**
 * Focused subset of the full rankings metric list. Kept small so the
 * report card stays scannable and the print layout doesn't overflow.
 */
export const CORE_METRIC_DEFS: CoreMetricDef[] = [
  {
    key: 'bat_ops',
    label: 'OPS',
    description: 'Producing at the plate (on-base + power)',
    bucket: 'batting',
    higherIsBetter: true,
    read: (i) => readStat(i, 'bat_ops'),
  },
  {
    key: 'bat_k_pct',
    label: 'Contact (K%)',
    description: 'Putting the ball in play — lower strikeout rate is better',
    bucket: 'batting',
    higherIsBetter: false,
    read: (i) => {
      const so = readStat(i, 'bat_so');
      const pa = readStat(i, 'bat_pa');
      if (!Number.isFinite(so) || !Number.isFinite(pa) || pa === 0) return NaN;
      return (so / pa) * 100;
    },
  },
  {
    key: 'bat_ba_pct_risp',
    label: 'Clutch (BA/RISP)',
    description: 'Delivering with runners in scoring position',
    bucket: 'batting',
    higherIsBetter: true,
    read: (i) => readStat(i, 'bat_ba_pct_risp'),
  },
  {
    key: 'pit_s_pct',
    label: 'Strike %',
    description: 'Pounding the strike zone',
    bucket: 'pitching',
    higherIsBetter: true,
    read: (i) => readStat(i, 'pit_s_pct'),
  },
  {
    key: 'pit_era',
    label: 'ERA',
    description: 'Limiting earned runs — lower is better',
    bucket: 'pitching',
    higherIsBetter: false,
    read: (i) => readStat(i, 'pit_era'),
  },
  {
    key: 'field_fpct',
    label: 'Fielding %',
    description: 'Handling the ball cleanly',
    bucket: 'fielding',
    higherIsBetter: true,
    read: (i) => readStat(i, 'field_fpct'),
  },
  {
    key: 'intangibles_effort',
    label: 'Effort',
    description: 'Coach rating — hustle and intensity',
    bucket: 'intangibles',
    higherIsBetter: true,
    read: (i) => ratingScore(i.effortRating),
  },
  {
    key: 'intangibles_coachability',
    label: 'Coachability',
    description: 'Coach rating — takes instruction, applies feedback',
    bucket: 'intangibles',
    higherIsBetter: true,
    read: (i) => ratingScore(i.coachabilityRating),
  },
  {
    key: 'intangibles_baseball_iq',
    label: 'Baseball IQ',
    description: 'Coach rating — situational awareness',
    bucket: 'intangibles',
    higherIsBetter: true,
    read: (i) => ratingScore(i.baseballIqRating),
  },
];

/**
 * Min-max normalize the values within the team. Skips NaN players and
 * gives everyone 50 when the team has too little data to compare.
 */
export function normalizeToPercentile(values: number[], higherIsBetter: boolean): number[] {
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

const BAND_ORDER: MetricBand[] = ['needs-work', 'developing', 'strong', 'excelling'];

export function percentileToBand(percentile: number): MetricBand | null {
  if (!Number.isFinite(percentile)) return null;
  if (percentile < 25) return 'needs-work';
  if (percentile < 50) return 'developing';
  if (percentile < 75) return 'strong';
  return 'excelling';
}

/** Shift a band by `n` steps, clamped to the ends of the scale. */
export function shiftBand(band: MetricBand | null, n: number): MetricBand | null {
  if (!band) return null;
  const idx = BAND_ORDER.indexOf(band);
  const next = Math.max(0, Math.min(BAND_ORDER.length - 1, idx + n));
  return BAND_ORDER[next];
}

export function clampAdjustment(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(-2, Math.min(2, Math.trunc(n)));
}

export const MAX_ADJUSTMENT = 2;

export interface ComputeCoreMetricsArgs {
  targetPitcherId: string;
  teamInputs: CoreMetricInput[];
  adjustments: Record<string, number>;
  defs?: CoreMetricDef[];
}

/**
 * Compute the core metrics for one player, using every teammate's snapshot
 * as the normalization pool.
 */
export function computeCoreMetrics(args: ComputeCoreMetricsArgs): CoreMetric[] {
  const defs = args.defs ?? CORE_METRIC_DEFS;
  const targetIdx = args.teamInputs.findIndex((i) => i.pitcherId === args.targetPitcherId);
  if (targetIdx < 0) return [];

  return defs.map((def) => {
    const values = args.teamInputs.map((i) => def.read(i));
    const percentiles = normalizeToPercentile(values, def.higherIsBetter);
    const rawValue = values[targetIdx];
    const percentile = percentiles[targetIdx];
    const autoBand = percentileToBand(percentile);
    const adjustment = clampAdjustment(args.adjustments[def.key] ?? 0);
    const band = shiftBand(autoBand, adjustment);
    return { def, rawValue, percentile, autoBand, adjustment, band };
  });
}

export function bandLabel(band: MetricBand | null): string {
  if (!band) return 'No data';
  switch (band) {
    case 'needs-work': return 'Needs work';
    case 'developing': return 'Developing';
    case 'strong': return 'Strong';
    case 'excelling': return 'Excelling';
  }
}
