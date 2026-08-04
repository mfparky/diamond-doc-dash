import { describe, it, expect } from 'vitest';
import {
  bandLabel,
  clampAdjustment,
  computeCoreMetrics,
  normalizeToPercentile,
  percentileToBand,
  shiftBand,
  type CoreMetricInput,
} from './report-card-metrics';

const P = (id: string, stats: Record<string, number>, ratings: Partial<CoreMetricInput> = {}): CoreMetricInput => ({
  pitcherId: id,
  stats,
  effortRating: ratings.effortRating ?? null,
  coachabilityRating: ratings.coachabilityRating ?? null,
  baseballIqRating: ratings.baseballIqRating ?? null,
});

describe('normalizeToPercentile', () => {
  it('scales min→0 and max→100 when higher is better', () => {
    expect(normalizeToPercentile([0, 5, 10], true)).toEqual([0, 50, 100]);
  });

  it('inverts when lower is better', () => {
    expect(normalizeToPercentile([0, 5, 10], false)).toEqual([100, 50, 0]);
  });

  it('returns NaN for everyone when the team is too small to compare', () => {
    expect(normalizeToPercentile([5], true).every((v) => Number.isNaN(v))).toBe(true);
  });

  it('returns NaN for everyone when everyone ties', () => {
    expect(normalizeToPercentile([7, 7, 7], true).every((v) => Number.isNaN(v))).toBe(true);
  });

  it('preserves NaN for players missing the stat', () => {
    const out = normalizeToPercentile([0, NaN, 10], true);
    expect(out[0]).toBe(0);
    expect(Number.isNaN(out[1])).toBe(true);
    expect(out[2]).toBe(100);
  });
});

describe('percentileToBand', () => {
  it('maps even quintiles', () => {
    expect(percentileToBand(0)).toBe('needs-work');
    expect(percentileToBand(19.9)).toBe('needs-work');
    expect(percentileToBand(20)).toBe('developing');
    expect(percentileToBand(39.9)).toBe('developing');
    expect(percentileToBand(40)).toBe('on-target');
    expect(percentileToBand(59.9)).toBe('on-target');
    expect(percentileToBand(60)).toBe('strong');
    expect(percentileToBand(79.9)).toBe('strong');
    expect(percentileToBand(80)).toBe('excelling');
    expect(percentileToBand(100)).toBe('excelling');
  });

  it('returns null when the percentile is unknown', () => {
    expect(percentileToBand(NaN)).toBeNull();
  });
});

describe('shiftBand', () => {
  it('nudges up and down', () => {
    expect(shiftBand('developing', 1)).toBe('on-target');
    expect(shiftBand('on-target', 1)).toBe('strong');
    expect(shiftBand('strong', -1)).toBe('on-target');
  });

  it('clamps at the ends of the scale', () => {
    expect(shiftBand('needs-work', -2)).toBe('needs-work');
    expect(shiftBand('excelling', 2)).toBe('excelling');
  });

  it('propagates null input', () => {
    expect(shiftBand(null, 1)).toBeNull();
  });
});

describe('clampAdjustment', () => {
  it('clamps to [-2, +2]', () => {
    expect(clampAdjustment(5)).toBe(2);
    expect(clampAdjustment(-99)).toBe(-2);
    expect(clampAdjustment(1)).toBe(1);
  });

  it('treats non-finite input as 0', () => {
    expect(clampAdjustment(NaN)).toBe(0);
    expect(clampAdjustment(Infinity)).toBe(0);
  });

  it('truncates non-integers', () => {
    expect(clampAdjustment(1.7)).toBe(1);
  });
});

describe('computeCoreMetrics', () => {
  const team = [
    P('a', { bat_ops: 1.100, pit_s_pct: 68, bat_pa: 40, bat_so: 4 }, { effortRating: 'plus', coachabilityRating: 'plus', baseballIqRating: 'plus' }),
    P('b', { bat_ops: 0.800, pit_s_pct: 60, bat_pa: 40, bat_so: 10 }, { effortRating: 'even', coachabilityRating: 'even', baseballIqRating: 'even' }),
    P('c', { bat_ops: 0.500, pit_s_pct: 50, bat_pa: 40, bat_so: 20 }, { effortRating: 'minus', coachabilityRating: 'minus', baseballIqRating: 'minus' }),
  ];

  it('puts the top OPS in the excelling band and the bottom in needs-work', () => {
    const top = computeCoreMetrics({ targetPitcherId: 'a', teamInputs: team, adjustments: {} });
    const bottom = computeCoreMetrics({ targetPitcherId: 'c', teamInputs: team, adjustments: {} });
    const opsTop = top.find((m) => m.def.key === 'bat_ops')!;
    const opsBottom = bottom.find((m) => m.def.key === 'bat_ops')!;
    expect(opsTop.autoBand).toBe('excelling');
    expect(opsBottom.autoBand).toBe('needs-work');
  });

  it('inverts K% so fewer strikeouts is better', () => {
    // Player 'a' has SO=4, PA=40 → K%=10 (best). Player 'c' has 50% (worst).
    const top = computeCoreMetrics({ targetPitcherId: 'a', teamInputs: team, adjustments: {} });
    const bottom = computeCoreMetrics({ targetPitcherId: 'c', teamInputs: team, adjustments: {} });
    expect(top.find((m) => m.def.key === 'bat_k_pct')!.autoBand).toBe('excelling');
    expect(bottom.find((m) => m.def.key === 'bat_k_pct')!.autoBand).toBe('needs-work');
  });

  it('reads coach ratings as percentiles', () => {
    const top = computeCoreMetrics({ targetPitcherId: 'a', teamInputs: team, adjustments: {} });
    expect(top.find((m) => m.def.key === 'intangibles_effort')!.autoBand).toBe('excelling');
  });

  it('returns null band when the player has no data for a metric', () => {
    const missing = P('d', { bat_ops: 0.900 });
    const teamWithMissing = [...team, missing];
    const out = computeCoreMetrics({ targetPitcherId: 'd', teamInputs: teamWithMissing, adjustments: {} });
    expect(out.find((m) => m.def.key === 'pit_era')!.band).toBeNull();
  });

  it('applies coach ±nudges', () => {
    const nudged = computeCoreMetrics({ targetPitcherId: 'c', teamInputs: team, adjustments: { bat_ops: 2 } });
    const auto = computeCoreMetrics({ targetPitcherId: 'c', teamInputs: team, adjustments: {} });
    expect(auto.find((m) => m.def.key === 'bat_ops')!.autoBand).toBe('needs-work');
    // Bumping by +2 from needs-work (index 0) lands on on-target (index 2).
    expect(nudged.find((m) => m.def.key === 'bat_ops')!.band).toBe('on-target');
  });

  it('clamps out-of-range adjustments before applying', () => {
    const wild = computeCoreMetrics({ targetPitcherId: 'c', teamInputs: team, adjustments: { bat_ops: 99 } });
    // +2 from needs-work → on-target (can't go past excelling either).
    expect(wild.find((m) => m.def.key === 'bat_ops')!.band).toBe('on-target');
  });
});

describe('bandLabel', () => {
  it('gives coach-friendly names', () => {
    expect(bandLabel('needs-work')).toBe('Needs work');
    expect(bandLabel('on-target')).toBe('On target');
    expect(bandLabel('excelling')).toBe('Excelling');
    expect(bandLabel(null)).toBe('No data');
  });
});
