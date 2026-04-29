// Consistency score = how stable the player is at what they control.
// Blends two signals:
//   1. Strike % stability — std dev of per-outing strike % around the player's
//      own mean. Tighter spread = higher score.
//   2. Workout regularity — unique active days per week (from workout
//      completions). Throwing/working out more days = higher score.

export interface ConsistencyOuting {
  pitchCount: number;
  strikes: number | null;
}

export interface ConsistencyCompletion {
  weekStart: string; // yyyy-MM-dd (Monday)
  dayOfWeek: number; // 0=Mon..6=Sun
}

export interface ConsistencyResult {
  score: number; // 0-100
  hasData: boolean;
  meanStrikePct: number | null;
  stdDevStrikePct: number | null;
  daysPerWeek: number | null;
  detail: string; // short label for the UI
}

// Score the strike-% spread: 0 σ → 100, 20pp σ → 0
function scoreStrikeSpread(stdDev: number): number {
  return Math.max(0, Math.min(100, (1 - stdDev / 20) * 100));
}

// Score days/week active: 4+ days → 100, 0 days → 0
function scoreDaysPerWeek(d: number): number {
  return Math.max(0, Math.min(100, (d / 4) * 100));
}

export function calculateConsistency(
  outings: ConsistencyOuting[],
  completions: ConsistencyCompletion[]
): ConsistencyResult {
  // --- Strike % stability ---
  const strikePcts = outings
    .filter((o) => o.strikes !== null && o.pitchCount > 0)
    .map((o) => ((o.strikes ?? 0) / o.pitchCount) * 100);

  let meanStrikePct: number | null = null;
  let stdDevStrikePct: number | null = null;
  let strikeScore: number | null = null;

  if (strikePcts.length >= 2) {
    meanStrikePct = strikePcts.reduce((a, b) => a + b, 0) / strikePcts.length;
    const variance =
      strikePcts.reduce((sum, p) => sum + Math.pow(p - meanStrikePct!, 2), 0) /
      strikePcts.length;
    stdDevStrikePct = Math.sqrt(variance);
    strikeScore = scoreStrikeSpread(stdDevStrikePct);
  }

  // --- Workout regularity (unique active days per active week) ---
  let daysPerWeek: number | null = null;
  let workoutScore: number | null = null;

  if (completions.length > 0) {
    const byWeek = new Map<string, Set<number>>();
    for (const c of completions) {
      if (!byWeek.has(c.weekStart)) byWeek.set(c.weekStart, new Set());
      byWeek.get(c.weekStart)!.add(c.dayOfWeek);
    }
    const totalDays = Array.from(byWeek.values()).reduce(
      (sum, days) => sum + days.size,
      0
    );
    daysPerWeek = totalDays / byWeek.size;
    workoutScore = scoreDaysPerWeek(daysPerWeek);
  }

  // --- Blend ---
  // Weight strike stability 60% and workout regularity 40% when both exist.
  // Fall back gracefully when one is missing.
  let score = 0;
  let hasData = false;
  let detail = 'Need data';

  if (strikeScore !== null && workoutScore !== null) {
    score = strikeScore * 0.6 + workoutScore * 0.4;
    hasData = true;
    detail = `±${stdDevStrikePct!.toFixed(0)}pp · ${daysPerWeek!.toFixed(1)} d/wk`;
  } else if (strikeScore !== null) {
    score = strikeScore;
    hasData = true;
    detail = `±${stdDevStrikePct!.toFixed(0)}pp strikes`;
  } else if (workoutScore !== null) {
    score = workoutScore;
    hasData = true;
    detail = `${daysPerWeek!.toFixed(1)} active days/wk`;
  }

  return {
    score: Math.round(score),
    hasData,
    meanStrikePct,
    stdDevStrikePct,
    daysPerWeek,
    detail,
  };
}
