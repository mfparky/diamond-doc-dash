/**
 * Cooperstown Tournament 2026 schedule for Newmarket Hawks 13U.
 *
 * `dayIndex` is the 0-indexed tournament day used by the pitch-count rules.
 * Same-day games get sequential `gameIndex` (0, 1, ...) — the rules use both.
 *
 * Bracket games (Day 4+) start unknown; coach edits the label and time once
 * the bracket is set. The row still exists so eligibility math applies.
 */

export interface TournamentGameSlot {
  /** Stable ID (used as a React key + storage key). */
  id: string;
  /** 0-indexed day within the tournament. */
  dayIndex: number;
  /** 0-indexed game slot within that day. */
  gameIndex: number;
  /** ISO date (YYYY-MM-DD). Empty string when TBD. */
  date: string;
  /** Display time (e.g. '5:30 PM') or 'TBD'. */
  time: string;
  /** Game code (e.g. 'F8') or freeform. */
  code: string;
  /** Opponent name or 'TBD'. */
  opponent: string;
}

export const COOPERSTOWN_2026: TournamentGameSlot[] = [
  { id: 'day1-g1', dayIndex: 0, gameIndex: 0, date: '2026-07-07', time: '5:30 PM', code: 'F8', opponent: 'TBD' },
  { id: 'day2-g1', dayIndex: 1, gameIndex: 0, date: '2026-07-08', time: '11:30 AM', code: 'F19', opponent: 'TBD' },
  { id: 'day2-g2', dayIndex: 1, gameIndex: 1, date: '2026-07-08', time: '7:00 PM', code: 'F17', opponent: 'TBD' },
  { id: 'day3-g1', dayIndex: 2, gameIndex: 0, date: '2026-07-09', time: '9:00 AM', code: 'F6', opponent: 'TBD' },
  { id: 'day3-g2', dayIndex: 2, gameIndex: 1, date: '2026-07-09', time: '4:30 PM', code: 'F16', opponent: 'TBD' },
  { id: 'day4-bracket', dayIndex: 3, gameIndex: 0, date: '2026-07-10', time: 'TBD', code: 'Bracket', opponent: 'TBD' },
];

/** Back-compat alias — prefer `COOPERSTOWN_2026`. */
export const COOPERSTOWN_2025 = COOPERSTOWN_2026;

export const COOPERSTOWN_TOURNAMENT_SLUG = 'cooperstown-2026';
export const COOPERSTOWN_TOURNAMENT_NAME = 'Cooperstown Tournament 2026';

export function dayLabel(dayIndex: number): string {
  return `Day ${dayIndex + 1}`;
}
