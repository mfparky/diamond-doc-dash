import { describe, it, expect } from 'vitest';
import {
  getTier,
  isEligibleForGame,
  summarizeByDay,
  TIERS,
  DAILY_MAX,
  NO_REST_MAX,
  type PitchEntry,
} from './tournament-pitch-rules';

const P = (day: number, gameIndex: number, pitches: number): PitchEntry => ({ day, gameIndex, pitches });

describe('getTier', () => {
  it('returns null for zero pitches', () => {
    expect(getTier(0)).toBeNull();
  });

  it('picks the correct tier at every boundary', () => {
    expect(getTier(1)?.restDays).toBe(0);
    expect(getTier(30)?.restDays).toBe(0);
    expect(getTier(31)?.restDays).toBe(1);
    expect(getTier(45)?.restDays).toBe(1);
    expect(getTier(46)?.restDays).toBe(2);
    expect(getTier(60)?.restDays).toBe(2);
    expect(getTier(61)?.restDays).toBe(3);
    expect(getTier(75)?.restDays).toBe(3);
    expect(getTier(76)?.restDays).toBe(4);
    expect(getTier(85)?.restDays).toBe(4);
  });

  it('flags over-max pitches with 5 days rest', () => {
    expect(getTier(86)?.restDays).toBe(5);
  });

  it('every tier is contiguous and covers 1..85 without gaps', () => {
    for (let n = 1; n <= DAILY_MAX; n++) {
      expect(getTier(n), `tier for ${n}`).not.toBeNull();
    }
  });
});

describe('isEligibleForGame — rest requirements', () => {
  it('is available on day 0 with no prior entries', () => {
    const r = isEligibleForGame({ entries: [], targetDay: 0, targetGameIndex: 0 });
    expect(r.eligible).toBe(true);
    expect(r.remaining).toBe(DAILY_MAX);
  });

  it('throwing 30 (no-rest tier) allows same or next day', () => {
    const entries = [P(0, 0, 30)];
    // Day 0 second game — entry gate is met (game 1 = 30 ≤ 30). Remaining
    // for game 2 is bound only by the daily 85 cap and 2-day combined 85 cap.
    // remaining = 85 - 30 = 55.
    const same = isEligibleForGame({ entries, targetDay: 0, targetGameIndex: 1 });
    expect(same.eligible).toBe(true);
    expect(same.remaining).toBe(55);
    // Day 1 fully eligible (2-day combined cap trims to 55 here too).
    const next = isEligibleForGame({ entries, targetDay: 1, targetGameIndex: 0 });
    expect(next.eligible).toBe(true);
  });

  it('throwing 45 (1-day rest) blocks the next day', () => {
    const entries = [P(0, 0, 45)];
    const r = isEligibleForGame({ entries, targetDay: 1, targetGameIndex: 0 });
    expect(r.eligible).toBe(false);
    expect(r.reason).toMatch(/1 day\(s\) rest after 45/);
  });

  it('throwing 45 clears by day 2', () => {
    const entries = [P(0, 0, 45)];
    const r = isEligibleForGame({ entries, targetDay: 2, targetGameIndex: 0 });
    expect(r.eligible).toBe(true);
  });

  it('throwing 60 (2-day rest) blocks days 1 and 2, clears on day 3', () => {
    const entries = [P(0, 0, 60)];
    expect(isEligibleForGame({ entries, targetDay: 1, targetGameIndex: 0 }).eligible).toBe(false);
    expect(isEligibleForGame({ entries, targetDay: 2, targetGameIndex: 0 }).eligible).toBe(false);
    expect(isEligibleForGame({ entries, targetDay: 3, targetGameIndex: 0 }).eligible).toBe(true);
  });

  it('throwing 85 (4-day rest) blocks days 1-4, clears on day 5', () => {
    const entries = [P(0, 0, 85)];
    for (let d = 1; d <= 4; d++) {
      expect(isEligibleForGame({ entries, targetDay: d, targetGameIndex: 0 }).eligible).toBe(false);
    }
    expect(isEligibleForGame({ entries, targetDay: 5, targetGameIndex: 0 }).eligible).toBe(true);
  });
});

describe('isEligibleForGame — same-day second game', () => {
  it('allows a second game when first was ≤ 30', () => {
    const entries = [P(0, 0, 25)];
    const r = isEligibleForGame({ entries, targetDay: 0, targetGameIndex: 1 });
    expect(r.eligible).toBe(true);
    // Second game is NOT capped at 30 — combined day total dictates the
    // next-day rest tier. Only the daily 85 max limits game 2, so
    // remaining = 85 - 25 = 60.
    expect(r.remaining).toBe(60);
  });

  it('allows the second-game total to push past 30 (triggering higher rest tier next day)', () => {
    // Coach entered 25 in game 1 (0-rest eligible). Now planning 40 in game 2.
    // Combined 65 puts the DAY total in the 61-75 tier (3 days rest after).
    // That's legal — the rest tier calc uses the combined total, not per-appearance.
    const entries = [P(0, 0, 25)];
    const r = isEligibleForGame({ entries, targetDay: 0, targetGameIndex: 1 });
    expect(r.eligible).toBe(true);
    expect(r.remaining).toBeGreaterThanOrEqual(40);
  });

  it('blocks a second game when first was > 30', () => {
    const entries = [P(0, 0, 40)];
    const r = isEligibleForGame({ entries, targetDay: 0, targetGameIndex: 1 });
    expect(r.eligible).toBe(false);
    expect(r.reason).toMatch(/must be ≤ 30/);
  });
});

describe('isEligibleForGame — two-day rolling caps', () => {
  it('caps day-2 pitches so 2-day combined stays ≤ 85', () => {
    const entries = [P(0, 0, 25)]; // 0-rest tier, allowed
    const r = isEligibleForGame({ entries, targetDay: 1, targetGameIndex: 0 });
    expect(r.eligible).toBe(true);
    expect(r.remaining).toBe(60); // 85 - 25
    expect(r.reason).toMatch(/2-day combined cap/);
  });

  it('flags 2-games-in-2-days cap when already at limit', () => {
    const entries = [P(0, 0, 20), P(1, 0, 20)]; // two appearances, day 0 and day 1
    const r = isEligibleForGame({ entries, targetDay: 1, targetGameIndex: 1 });
    expect(r.eligible).toBe(false);
    expect(r.reason).toMatch(/2-day window/);
  });
});

describe('isEligibleForGame — consecutive-day rules', () => {
  it('allows a 3rd straight day only when prior 2 days combined ≤ 30', () => {
    // Prior 2 days = 20 → streak budget is 10.
    const entries = [P(0, 0, 10), P(1, 0, 10)];
    const r = isEligibleForGame({ entries, targetDay: 2, targetGameIndex: 0 });
    expect(r.eligible).toBe(true);
    expect(r.remaining).toBe(10);
    expect(r.reason).toMatch(/3-day streak cap/);
  });

  it('blocks 3rd straight day when prior 2 days already exceed 30', () => {
    const entries = [P(0, 0, 20), P(1, 0, 15)];
    const r = isEligibleForGame({ entries, targetDay: 2, targetGameIndex: 0 });
    expect(r.eligible).toBe(false);
    expect(r.reason).toMatch(/3rd straight day/);
  });

  it('blocks a 4th consecutive day regardless of totals', () => {
    const entries = [P(0, 0, 5), P(1, 0, 5), P(2, 0, 5)];
    const r = isEligibleForGame({ entries, targetDay: 3, targetGameIndex: 0 });
    expect(r.eligible).toBe(false);
    expect(r.reason).toMatch(/4 consecutive days/);
  });
});

describe('isEligibleForGame — self-exclusion', () => {
  it('excludes the target slot from prior-day calculations', () => {
    // Player is planned for 40 in day 0 slot 0. Checking that slot itself
    // should not treat those 40 pitches as prior history.
    const entries = [P(0, 0, 40)];
    const r = isEligibleForGame({ entries, targetDay: 0, targetGameIndex: 0 });
    expect(r.eligible).toBe(true);
    expect(r.remaining).toBe(DAILY_MAX);
  });
});

describe('isEligibleForGame — catcher conflict', () => {
  it('blocks a catcher from pitching the same day', () => {
    const r = isEligibleForGame({
      entries: [],
      targetDay: 0,
      targetGameIndex: 0,
      isCatchingToday: true,
    });
    expect(r.eligible).toBe(false);
    expect(r.reason).toMatch(/catching today/i);
  });

  it('catcher conflict beats a rest-eligible day', () => {
    // Player is fully rested and has never pitched. Still ineligible if
    // they're behind the plate.
    const r = isEligibleForGame({
      entries: [],
      targetDay: 2,
      targetGameIndex: 0,
      isCatchingToday: true,
    });
    expect(r.eligible).toBe(false);
    expect(r.reason).toMatch(/catching today/i);
  });

  it('catcher can still pitch on a day they are NOT catching', () => {
    const r = isEligibleForGame({
      entries: [],
      targetDay: 1,
      targetGameIndex: 0,
      isCatchingToday: false,
    });
    expect(r.eligible).toBe(true);
  });
});

describe('summarizeByDay', () => {
  it('rolls up pitches, games, and rest tier per day', () => {
    const entries = [P(0, 0, 20), P(0, 1, 10), P(2, 0, 60)];
    const summary = summarizeByDay(entries);
    expect(summary).toEqual([
      { day: 0, pitches: 30, games: 2, restDays: 0 },
      { day: 2, pitches: 60, games: 1, restDays: 2 },
    ]);
  });

  it('ignores zero-pitch entries', () => {
    expect(summarizeByDay([P(0, 0, 0), P(1, 0, 25)])).toEqual([
      { day: 1, pitches: 25, games: 1, restDays: 0 },
    ]);
  });
});

describe('TIERS integrity', () => {
  it('has exactly 5 tiers matching OBA 12U/13U spec', () => {
    expect(TIERS).toHaveLength(5);
  });

  it('caps at 85 daily max', () => {
    expect(TIERS[TIERS.length - 1].max).toBe(DAILY_MAX);
  });

  it('starts at 1 (no-rest tier goes up to 30)', () => {
    expect(TIERS[0].min).toBe(1);
    expect(TIERS[0].max).toBe(NO_REST_MAX);
    expect(TIERS[0].restDays).toBe(0);
  });
});
