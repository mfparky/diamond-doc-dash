import type { StatValue } from './stat-csv';

/**
 * Pure scoring + tier-assignment for the tournament-planner A/B rotation.
 *
 * The idea: coach wants "who's my Group A (best arms who open the tournament,
 * can push to 45 pitches) and who's my Group B (depth who slot in on lighter
 * days, capped at 30 to preserve rest eligibility)". Rather than eyeball it
 * from CSV stats every tournament, this module reads the latest
 * pitcher_stat_snapshots and ranks.
 *
 * A pitcher without an IP history stays unassigned — no arm data, no tier.
 * Coach fills those in manually.
 */

export interface PitcherTieringInput {
  pitcherId: string;
  name: string;
  /** Latest stat snapshot for the pitcher — usually the one used in rankings. */
  stats: Record<string, StatValue> | null;
}

export interface PitcherTierAssignment {
  pitcherId: string;
  name: string;
  suggestedGroup: 'A' | 'B' | null;
  /** 0..100 composite score. null when the pitcher has no usable stats. */
  score: number | null;
  /** IP from the snapshot. Coach uses this to decide budgets. */
  ip: number;
  /** Short human-readable reason line for the preview dialog. */
  reason: string;
}

export interface SuggestGroupsOptions {
  /** How many pitchers to place in Group A. Default 5 (spec's best-arms guidance). */
  groupASize?: number;
  /** Minimum IP a pitcher needs to be eligible for Group B. Default 1. */
  minIpForB?: number;
}

// Metric read helpers — identical semantics to team-rankings.ts.
function readNum(stats: Record<string, StatValue> | null, key: string): number | null {
  if (!stats) return null;
  const v = stats[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/**
 * Pitching composite score. Higher is better. Individual components are
 * clamped to plausible youth-baseball ranges so a wild outlier doesn't
 * swamp the ranking.
 *
 * Returns null when we don't have enough data (no IP AND no rate stats
 * simultaneously — a pitcher who's never taken the mound).
 */
export function scorePitcher(stats: Record<string, StatValue> | null): number | null {
  if (!stats) return null;
  const ip = readNum(stats, 'pit_ip') ?? 0;
  const era = readNum(stats, 'pit_era');
  const whip = readNum(stats, 'pit_whip');
  const strikePct = readNum(stats, 'pit_s_pct');
  const kbf = readNum(stats, 'pit_k_pct_bf');
  const fps = readNum(stats, 'pit_fps_pct');

  // Need at least SOME pitching signal.
  if (ip <= 0 && era === null && whip === null && strikePct === null) return null;

  // Component scores each mapped to 0..100 with a plausible ceiling/floor.
  const strikeScore = clamp((strikePct ?? 50) - 40, 0, 40) / 40 * 100; // 40% → 0, 80% → 100
  const eraScore = clamp(8 - (era ?? 6), 0, 8) / 8 * 100;              // ERA 8 → 0, ERA 0 → 100
  const whipScore = clamp(3.5 - (whip ?? 2.5), 0, 3) / 3 * 100;        // WHIP 3.5 → 0, WHIP 0.5 → 100
  const kbfScore = clamp((kbf ?? 0.15) - 0.05, 0, 0.45) / 0.45 * 100;  // K/BF 0.05 → 0, 0.50 → 100
  const fpsScore = clamp((fps ?? 50) - 30, 0, 40) / 40 * 100;          // FPS 30% → 0, 70% → 100
  const ipScore = clamp(ip, 0, 25) / 25 * 100;                        // IP 0 → 0, 25+ → 100

  // Weights: rate stats dominate, IP is a durability signal but not everything.
  return (
    strikeScore * 0.25
    + eraScore * 0.25
    + whipScore * 0.20
    + kbfScore * 0.15
    + fpsScore * 0.10
    + ipScore * 0.05
  );
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/**
 * Rank the pool by pitching composite and assign A / B / null tiers.
 * Coach previews the assignments in a dialog and approves.
 */
export function suggestGroups(
  inputs: PitcherTieringInput[],
  options: SuggestGroupsOptions = {},
): PitcherTierAssignment[] {
  const groupASize = Math.max(1, options.groupASize ?? 5);
  const minIpForB = Math.max(0, options.minIpForB ?? 1);

  // Score everyone.
  const scored = inputs.map((p) => {
    const score = scorePitcher(p.stats);
    const ip = readNum(p.stats, 'pit_ip') ?? 0;
    return { p, score, ip };
  });

  // Rank pitchers with usable scores.
  const ranked = scored
    .filter((s) => s.score !== null)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  const aIds = new Set(ranked.slice(0, groupASize).map((s) => s.p.pitcherId));

  return scored.map(({ p, score, ip }) => {
    if (score === null) {
      return {
        pitcherId: p.pitcherId,
        name: p.name,
        suggestedGroup: null as const,
        score: null,
        ip,
        reason: 'No pitching stats yet — assign manually',
      };
    }
    if (aIds.has(p.pitcherId)) {
      return {
        pitcherId: p.pitcherId,
        name: p.name,
        suggestedGroup: 'A' as const,
        score,
        ip,
        reason: `Score ${Math.round(score)}, ${ip.toFixed(1)} IP — top of the staff`,
      };
    }
    if (ip >= minIpForB) {
      return {
        pitcherId: p.pitcherId,
        name: p.name,
        suggestedGroup: 'B' as const,
        score,
        ip,
        reason: `Score ${Math.round(score)}, ${ip.toFixed(1)} IP — depth arm`,
      };
    }
    return {
      pitcherId: p.pitcherId,
      name: p.name,
      suggestedGroup: null as const,
      score,
      ip,
      reason: `Score ${Math.round(score)} but only ${ip.toFixed(1)} IP — needs live reps first`,
    };
  });
}

/**
 * Smart per-pitcher budget for the auto-populate dialog. Coach picks
 * a base budget; this stretches it up for A / high-IP and shrinks it
 * for B / low-IP so nobody gets asked to do more than they've built up to.
 */
export function suggestPitchBudget(
  group: 'A' | 'B' | null,
  ip: number,
  baseBudget: number,
): number {
  const ceiling = group === 'A' ? 45 : group === 'B' ? 30 : 25;
  const floor = 15;
  // Scale by IP: 20+ IP = full multiplier, 0 IP = 60% of base.
  const ipMultiplier = 0.6 + Math.min(1, ip / 20) * 0.4;
  const scaled = baseBudget * ipMultiplier;
  return Math.round(clamp(scaled, floor, ceiling) / 5) * 5;
}
