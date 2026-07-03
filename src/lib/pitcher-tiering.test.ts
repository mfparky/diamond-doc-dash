import { describe, it, expect } from 'vitest';
import { scorePitcher, suggestGroups, suggestPitchBudget } from './pitcher-tiering';

const stats = (over: Record<string, number> = {}) => ({
  pit_ip: 10,
  pit_era: 4,
  pit_whip: 1.5,
  pit_s_pct: 60,
  pit_k_pct_bf: 0.25,
  pit_fps_pct: 55,
  ...over,
});

describe('scorePitcher', () => {
  it('returns null with no snapshot at all', () => {
    expect(scorePitcher(null)).toBeNull();
  });

  it('returns null when the pitcher has never taken the mound', () => {
    // No IP AND no rate stats populated.
    expect(scorePitcher({ pit_ip: 0 })).toBeNull();
  });

  it('ranks a top-tier line higher than a bottom-tier line', () => {
    const top = scorePitcher(stats({ pit_era: 1.5, pit_whip: 0.9, pit_s_pct: 72, pit_k_pct_bf: 0.35 }))!;
    const bottom = scorePitcher(stats({ pit_era: 7, pit_whip: 3, pit_s_pct: 45, pit_k_pct_bf: 0.08 }))!;
    expect(top).toBeGreaterThan(bottom);
  });

  it('produces scores between 0 and 100', () => {
    const s = scorePitcher(stats())!;
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(100);
  });
});

describe('suggestGroups', () => {
  it('puts the highest-scoring pitchers in Group A', () => {
    const inputs = [
      { pitcherId: 'a', name: 'Ace', stats: stats({ pit_era: 1, pit_s_pct: 75, pit_ip: 20 }) },
      { pitcherId: 'b', name: 'Second', stats: stats({ pit_era: 3, pit_s_pct: 62, pit_ip: 15 }) },
      { pitcherId: 'c', name: 'Third', stats: stats({ pit_era: 4, pit_s_pct: 55, pit_ip: 8 }) },
    ];
    const out = suggestGroups(inputs, { groupASize: 2 });
    const byId = new Map(out.map((x) => [x.pitcherId, x]));
    expect(byId.get('a')!.suggestedGroup).toBe('A');
    expect(byId.get('b')!.suggestedGroup).toBe('A');
    expect(byId.get('c')!.suggestedGroup).toBe('B');
  });

  it('leaves pitchers with no pitching data unassigned', () => {
    const inputs = [
      { pitcherId: 'a', name: 'Ace', stats: stats({ pit_ip: 20 }) },
      { pitcherId: 'no-arm', name: 'Newbie', stats: { bat_avg: 0.4 } },
      { pitcherId: 'null', name: 'No Stats', stats: null },
    ];
    const out = suggestGroups(inputs);
    const byId = new Map(out.map((x) => [x.pitcherId, x]));
    expect(byId.get('a')!.suggestedGroup).toBe('A');
    expect(byId.get('no-arm')!.suggestedGroup).toBeNull();
    expect(byId.get('null')!.suggestedGroup).toBeNull();
  });

  it('demotes a pitcher below IP floor to unassigned even with good rate stats', () => {
    const inputs = [
      { pitcherId: 'starter', name: 'Starter', stats: stats({ pit_ip: 12 }) },
      { pitcherId: 'small-sample', name: 'Small', stats: stats({ pit_ip: 0.5 }) },
    ];
    const out = suggestGroups(inputs, { groupASize: 1, minIpForB: 2 });
    const byId = new Map(out.map((x) => [x.pitcherId, x]));
    expect(byId.get('starter')!.suggestedGroup).toBe('A');
    expect(byId.get('small-sample')!.suggestedGroup).toBeNull();
    expect(byId.get('small-sample')!.reason).toMatch(/needs live reps/i);
  });

  it('respects groupASize when there are more pitchers than slots', () => {
    const inputs = Array.from({ length: 8 }, (_, i) => ({
      pitcherId: `p${i}`,
      name: `P${i}`,
      stats: stats({ pit_era: 3 + i * 0.5 }),
    }));
    const out = suggestGroups(inputs, { groupASize: 3 });
    const aCount = out.filter((x) => x.suggestedGroup === 'A').length;
    expect(aCount).toBe(3);
  });
});

describe('suggestPitchBudget', () => {
  it('caps Group A at 45', () => {
    expect(suggestPitchBudget('A', 25, 100)).toBe(45);
  });

  it('caps Group B at 30', () => {
    expect(suggestPitchBudget('B', 25, 100)).toBe(30);
  });

  it('caps unassigned at 25', () => {
    expect(suggestPitchBudget(null, 25, 100)).toBe(25);
  });

  it('never drops below 15', () => {
    expect(suggestPitchBudget('B', 0, 5)).toBeGreaterThanOrEqual(15);
  });

  it('shrinks the budget for a low-IP arm', () => {
    const highIp = suggestPitchBudget('B', 20, 30);
    const lowIp = suggestPitchBudget('B', 2, 30);
    expect(lowIp).toBeLessThan(highIp);
  });

  it('rounds to the nearest 5', () => {
    const budget = suggestPitchBudget('A', 15, 33);
    expect(budget % 5).toBe(0);
  });
});
