import type { StatValue } from './stat-csv';

export type InsightKind = 'good' | 'attention' | 'heads-up';

export interface Insight {
  /**
   * 'good' = trending well; 'attention' = needs work; 'heads-up' = arm-load
   * or safety signal that warrants action.
   */
  kind: InsightKind;
  message: string;
  /** Optional stat key for grouping / linking in the UI. */
  metric?: string;
}

export type StatRecord = Record<string, StatValue>;

export interface TrackerContext {
  /** Avg pitches per outing across the last ~30 days. null if no data. */
  avgPitchesPerOuting: number | null;
  /** Avg days between outings (proxy for rest compliance). null if <2 outings. */
  avgDaysBetweenOutings: number | null;
  /** Number of outings tracked in the report window. */
  recentOutingCount: number;
}

const SEVERITY_ORDER: Record<InsightKind, number> = {
  'heads-up': 0,
  attention: 1,
  good: 2,
};

/** Safe numeric read — returns null when the cell isn't numeric. */
function num(stats: StatRecord | null, key: string): number | null {
  if (!stats) return null;
  const v = stats[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/** Percent change as a signed decimal (0.25 = +25%). null if previous is 0 / missing. */
function pctChange(latest: number | null, previous: number | null): number | null {
  if (latest === null || previous === null) return null;
  if (previous === 0) return null;
  return (latest - previous) / previous;
}

function fmt(value: number, digits = 2): string {
  return value.toFixed(digits);
}

function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

// Each rule returns 0 or 1 insight. Adding new ones is just appending to RULES.
type Rule = (
  latest: StatRecord,
  previous: StatRecord | null,
  ctx: TrackerContext,
) => Insight | null;

const RULES: Rule[] = [
  // --- Volume / arm load ---
  (latest, _prev, ctx) => {
    const pBf = num(latest, 'pit_p_pct_bf');
    if (pBf === null || pBf < 4.5) return null;
    return {
      kind: 'heads-up',
      metric: 'pit_p_pct_bf',
      message: `Long at-bats (${fmt(pBf, 1)} pitches per batter) — high arm load per inning.`,
    };
  },
  (latest, _prev, _ctx) => {
    const pIp = num(latest, 'pit_p_pct_ip');
    if (pIp === null || pIp < 25) return null;
    return {
      kind: 'heads-up',
      metric: 'pit_p_pct_ip',
      message: `Throwing ${fmt(pIp, 1)} pitches per inning — consider mechanical efficiency work.`,
    };
  },
  (_latest, _prev, ctx) => {
    if (ctx.avgDaysBetweenOutings === null) return null;
    if (ctx.avgDaysBetweenOutings >= 3) return null;
    return {
      kind: 'heads-up',
      message: `Averaging ${fmt(ctx.avgDaysBetweenOutings, 1)} days between outings — below Pitch Smart 3-day guidance.`,
    };
  },

  // --- Effectiveness ---
  (latest, _prev, _ctx) => {
    const era = num(latest, 'pit_era');
    if (era === null) return null;
    if (era < 3.0) {
      return {
        kind: 'good',
        metric: 'pit_era',
        message: `ERA at ${fmt(era)} — strong run prevention.`,
      };
    }
    if (era > 6.0) {
      return {
        kind: 'attention',
        metric: 'pit_era',
        message: `ERA at ${fmt(era)} — runs allowed are above league average.`,
      };
    }
    return null;
  },
  (latest, previous, _ctx) => {
    const whipL = num(latest, 'pit_whip');
    const whipP = num(previous, 'pit_whip');
    if (whipL === null) return null;
    if (whipP !== null && whipL - whipP > 0.3) {
      return {
        kind: 'attention',
        metric: 'pit_whip',
        message: `WHIP up to ${fmt(whipL)} (was ${fmt(whipP)}) — baserunners trending up.`,
      };
    }
    if (whipL < 1.2) {
      return {
        kind: 'good',
        metric: 'pit_whip',
        message: `WHIP at ${fmt(whipL)} — limiting baserunners.`,
      };
    }
    return null;
  },

  // --- Dominance ---
  (latest, previous, _ctx) => {
    const kBfL = num(latest, 'pit_k_pct_bf');
    const kBfP = num(previous, 'pit_k_pct_bf');
    if (kBfL === null) return null;
    const delta = pctChange(kBfL, kBfP);
    if (delta !== null && delta >= 0.15) {
      return {
        kind: 'good',
        metric: 'pit_k_pct_bf',
        message: `Strikeouts per batter up ${pct(delta)} since last snapshot — dominance trending up.`,
      };
    }
    if (delta !== null && delta <= -0.2) {
      return {
        kind: 'attention',
        metric: 'pit_k_pct_bf',
        message: `Strikeouts per batter down ${pct(Math.abs(delta))} since last snapshot.`,
      };
    }
    return null;
  },
  (latest, _prev, _ctx) => {
    const sm = num(latest, 'pit_sm_pct');
    if (sm === null) return null;
    if (sm >= 15) {
      return {
        kind: 'good',
        metric: 'pit_sm_pct',
        message: `Swing-and-miss at ${fmt(sm, 1)}% — pitch shapes are missing bats.`,
      };
    }
    return null;
  },

  // --- Control ---
  (latest, _prev, _ctx) => {
    const fps = num(latest, 'pit_fps_pct');
    if (fps === null) return null;
    if (fps >= 60) {
      return {
        kind: 'good',
        metric: 'pit_fps_pct',
        message: `First-pitch strikes at ${fmt(fps, 1)}% — efficient ahead in the count.`,
      };
    }
    if (fps < 45) {
      return {
        kind: 'attention',
        metric: 'pit_fps_pct',
        message: `First-pitch strikes at ${fmt(fps, 1)}% — falling behind too often.`,
      };
    }
    return null;
  },
  (latest, _prev, _ctx) => {
    const bbInn = num(latest, 'pit_bb_pct_inn');
    if (bbInn === null) return null;
    if (bbInn > 1.5) {
      return {
        kind: 'attention',
        metric: 'pit_bb_pct_inn',
        message: `Walks per inning at ${fmt(bbInn, 2)} — strike-zone work needed.`,
      };
    }
    if (bbInn <= 0.5) {
      return {
        kind: 'good',
        metric: 'pit_bb_pct_inn',
        message: `Walks per inning at ${fmt(bbInn, 2)} — control is locked in.`,
      };
    }
    return null;
  },

  // --- Pitch mix balance ---
  (latest, _prev, _ctx) => {
    const fb = num(latest, 'pit_fb');
    const ct = num(latest, 'pit_ct') ?? 0;
    const cb = num(latest, 'pit_cb') ?? 0;
    const sl = num(latest, 'pit_sl') ?? 0;
    const ch = num(latest, 'pit_ch') ?? 0;
    const os = num(latest, 'pit_os') ?? 0;
    if (fb === null) return null;
    const total = fb + ct + cb + sl + ch + os;
    if (total < 30) return null;
    const fbShare = fb / total;
    if (fbShare >= 0.85) {
      return {
        kind: 'attention',
        metric: 'pit_fb',
        message: `Fastball used on ${pct(fbShare)} of pitches — consider mixing secondary offerings.`,
      };
    }
    return null;
  },
];

/**
 * Run every rule against the latest snapshot (with optional previous + tracker context)
 * and return insights ordered by severity (heads-up first, good last).
 */
export function generateInsights(
  latest: StatRecord,
  previous: StatRecord | null,
  ctx: TrackerContext,
  maxResults = 8,
): Insight[] {
  const insights: Insight[] = [];
  for (const rule of RULES) {
    const insight = rule(latest, previous, ctx);
    if (insight) insights.push(insight);
  }
  insights.sort((a, b) => SEVERITY_ORDER[a.kind] - SEVERITY_ORDER[b.kind]);
  return insights.slice(0, maxResults);
}
