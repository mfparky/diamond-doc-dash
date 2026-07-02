/**
 * OBA 12U / 13U pitch count rules — pure functions.
 *
 * The math here is load-bearing (a bad answer here = an ineligible pitcher on
 * the mound = a forfeit). Every rule is unit-tested in the sibling test file.
 *
 * All "day" values are integer offsets from the tournament start day (0 = day
 * one of the tournament). The rules are calendar-day based, so a coach who
 * needs to override a game's day (game crossed midnight, suspended game
 * resumed the next day) can do so at the schedule layer.
 */

export interface TierConfig {
  min: number;
  max: number;
  restDays: number;
  label: string;
}

export const TIERS: TierConfig[] = [
  { min: 1, max: 30, restDays: 0, label: 'No rest' },
  { min: 31, max: 45, restDays: 1, label: '1 day rest' },
  { min: 46, max: 60, restDays: 2, label: '2 days rest' },
  { min: 61, max: 75, restDays: 3, label: '3 days rest' },
  { min: 76, max: 85, restDays: 4, label: '4 days rest' },
];

export const DAILY_MAX = 85;
export const NO_REST_MAX = 30; // pitches at or below this require no calendar-day rest
export const MAX_GAMES_IN_TWO_DAY_WINDOW = 2;
export const TWO_DAY_COMBINED_MAX = 85;
export const THREE_DAY_COMBINED_MAX_NO_REST = 30;

/** Rest tier for a given single-day pitch count. Returns null when pitches === 0. */
export function getTier(pitches: number): TierConfig | null {
  if (pitches <= 0) return null;
  if (pitches > DAILY_MAX) {
    // Over the daily max shouldn't happen but is handled gracefully.
    return { min: DAILY_MAX + 1, max: Infinity, restDays: 5, label: 'Exceeded daily max' };
  }
  return TIERS.find((t) => pitches >= t.min && pitches <= t.max) ?? null;
}

export interface PitchEntry {
  /** 0-indexed day within the tournament. */
  day: number;
  /** 0-indexed game slot within that day. */
  gameIndex: number;
  /** Pitches thrown in this appearance. */
  pitches: number;
}

export interface EligibilityCheck {
  eligible: boolean;
  /** Human-readable reason. When eligible, describes availability. */
  reason: string;
  /**
   * Additional pitches the player can throw *this* game before hitting one
   * of the caps (daily 85, two-day combined 85, three-day combined 30 when on
   * a three-day streak). Null when the player is ineligible. Zero when
   * eligible but capped by a rolling limit.
   */
  remaining: number | null;
}

interface EligibilityContext {
  /** Every entry across the tournament, planned + actual merged. */
  entries: PitchEntry[];
  /** Day the coach is checking. */
  targetDay: number;
  /** Game slot within that day. */
  targetGameIndex: number;
}

/**
 * Is this player eligible to pitch in the given game slot?
 *
 * The player's OWN pitches in the target slot are excluded from the
 * pre-game totals — otherwise "planning to pitch 40" makes them ineligible
 * because 40 > 30 for a three-day check, etc.
 */
export function isEligibleForGame(ctx: EligibilityContext): EligibilityCheck {
  const { entries, targetDay, targetGameIndex } = ctx;

  // Everything except the slot we're planning for.
  const other = entries.filter(
    (e) => !(e.day === targetDay && e.gameIndex === targetGameIndex),
  );

  const byDay = tallyByDay(other);
  const pitchedDays = Object.keys(byDay).map(Number).sort((a, b) => a - b);

  // Rule: no 4 consecutive days regardless of pitch count.
  if ([targetDay - 3, targetDay - 2, targetDay - 1].every((d) => (byDay[d] ?? 0) > 0)) {
    return { eligible: false, reason: 'Cannot pitch 4 consecutive days', remaining: null };
  }

  // Rule: no 3 consecutive days unless the prior 2-day total is small enough
  // to keep a 3-day rolling total ≤ 30 for the streak.
  const prev1 = byDay[targetDay - 1] ?? 0;
  const prev2 = byDay[targetDay - 2] ?? 0;
  if (prev1 > 0 && prev2 > 0) {
    const streakBudget = THREE_DAY_COMBINED_MAX_NO_REST - (prev1 + prev2);
    if (streakBudget <= 0) {
      return {
        eligible: false,
        reason: `3rd straight day — prior 2 days already at ${prev1 + prev2} pitches (cap ${THREE_DAY_COMBINED_MAX_NO_REST})`,
        remaining: null,
      };
    }
  }

  // Rule: rest required by the tier of the most recent pitching day.
  if (pitchedDays.length > 0) {
    const lastPitchedDay = Math.max(...pitchedDays.filter((d) => d < targetDay));
    if (Number.isFinite(lastPitchedDay)) {
      const lastDayPitches = byDay[lastPitchedDay] ?? 0;
      const tier = getTier(lastDayPitches);
      if (tier && targetDay < lastPitchedDay + tier.restDays + 1) {
        const eligibleOn = lastPitchedDay + tier.restDays + 1;
        return {
          eligible: false,
          reason: `Needs ${tier.restDays} day(s) rest after ${lastDayPitches} pitches — eligible day ${eligibleOn + 1}`,
          remaining: null,
        };
      }
    }
  }

  // Rule: max 2 games in any two-consecutive-day window.
  const gamesPrevDay = countGamesOnDay(other, targetDay - 1);
  const gamesTargetDayAlready = countGamesOnDay(other, targetDay);
  if (gamesPrevDay + gamesTargetDayAlready >= MAX_GAMES_IN_TWO_DAY_WINDOW) {
    return {
      eligible: false,
      reason: `Already pitched ${gamesPrevDay + gamesTargetDayAlready} game(s) across this 2-day window (cap ${MAX_GAMES_IN_TWO_DAY_WINDOW})`,
      remaining: null,
    };
  }

  // Rule: same-day second game requires the first game to be ≤ NO_REST_MAX.
  if (gamesTargetDayAlready > 0) {
    const firstGamePitches = byDay[targetDay] ?? 0;
    if (firstGamePitches > NO_REST_MAX) {
      return {
        eligible: false,
        reason: `First game today was ${firstGamePitches} (must be ≤ ${NO_REST_MAX} to pitch again same day)`,
        remaining: null,
      };
    }
  }

  // Compute the remaining pitch budget from the tightest rolling cap.
  const targetDayPitchesSoFar = byDay[targetDay] ?? 0;
  const dailyRemaining = DAILY_MAX - targetDayPitchesSoFar;
  const twoDayRemaining = TWO_DAY_COMBINED_MAX - prev1 - targetDayPitchesSoFar;
  let remaining = Math.min(dailyRemaining, twoDayRemaining);
  let cappedBy: string | null = null;
  if (twoDayRemaining < dailyRemaining) cappedBy = `2-day combined cap ${TWO_DAY_COMBINED_MAX}`;

  // 3-day streak cap — if pitching today would make it a 3-day streak
  // (yesterday AND day before both had appearances), the total across those
  // three days must stay ≤ 30 for the streak to be legal.
  if (prev1 > 0 && prev2 > 0) {
    const streakRemaining =
      THREE_DAY_COMBINED_MAX_NO_REST - prev1 - prev2 - targetDayPitchesSoFar;
    if (streakRemaining < remaining) {
      remaining = streakRemaining;
      cappedBy = `3-day streak cap ${THREE_DAY_COMBINED_MAX_NO_REST}`;
    }
  }

  // Note: for a same-day second game, the entry gate (first game ≤ 30) is
  // enforced above. The second game itself is only bound by the daily 85
  // cap, the 2-day combined 85 cap, and the 3-day streak cap — the same
  // rolling limits any single-game appearance faces. Combined day total
  // dictates the rest tier for the following day; it is not capped at 30.

  remaining = Math.max(0, remaining);

  return {
    eligible: true,
    reason: cappedBy ? `Available — capped by ${cappedBy}` : `Available — up to ${remaining} pitches`,
    remaining,
  };
}

export interface DailyStatus {
  day: number;
  pitches: number;
  games: number;
  restDays: number;
}

/** Per-day roll-up used by the UI. */
export function summarizeByDay(entries: PitchEntry[]): DailyStatus[] {
  const byDay = tallyByDay(entries);
  const gamesByDay: Record<number, number> = {};
  for (const e of entries) {
    if (e.pitches > 0) gamesByDay[e.day] = (gamesByDay[e.day] ?? 0) + 1;
  }
  return Object.keys(byDay)
    .map(Number)
    .sort((a, b) => a - b)
    .map((day) => ({
      day,
      pitches: byDay[day],
      games: gamesByDay[day] ?? 0,
      restDays: getTier(byDay[day])?.restDays ?? 0,
    }));
}

/**
 * Bin every pitch entry into a per-day tally. Ignores zero-pitch entries so
 * empty planning cells don't count as an "appearance".
 */
function tallyByDay(entries: PitchEntry[]): Record<number, number> {
  const out: Record<number, number> = {};
  for (const e of entries) {
    if (e.pitches > 0) {
      out[e.day] = (out[e.day] ?? 0) + e.pitches;
    }
  }
  return out;
}

function countGamesOnDay(entries: PitchEntry[], day: number): number {
  return entries.filter((e) => e.day === day && e.pitches > 0).length;
}
