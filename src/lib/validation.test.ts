import { describe, it, expect } from 'vitest';
import { validateOuting, validatePitcher } from './validation';

const baseOuting = {
  pitcherName: 'Test Pitcher',
  date: '2026-05-01',
  eventType: 'Bullpen' as const,
  pitchCount: 30,
  strikes: 18,
  maxVelo: 70,
  notes: '',
  videoUrl1: '',
  focus: '',
};

describe('validateOuting', () => {
  it('accepts a well-formed bullpen outing', () => {
    const result = validateOuting(baseOuting);
    expect(result.success).toBe(true);
  });

  it('rejects empty pitcher name', () => {
    const result = validateOuting({ ...baseOuting, pitcherName: '   ' });
    expect(result.success).toBe(false);
  });

  it('rejects malformed date', () => {
    const result = validateOuting({ ...baseOuting, date: '5/1/2026' });
    expect(result.success).toBe(false);
  });

  it('rejects an unknown event type', () => {
    const result = validateOuting({ ...baseOuting, eventType: 'Scrimmage' });
    expect(result.success).toBe(false);
  });

  it('rejects negative pitch counts', () => {
    const result = validateOuting({ ...baseOuting, pitchCount: -1 });
    expect(result.success).toBe(false);
  });

  it('rejects unrealistic pitch counts', () => {
    const result = validateOuting({ ...baseOuting, pitchCount: 500 });
    expect(result.success).toBe(false);
  });

  it('allows null strikes (not tracked)', () => {
    const result = validateOuting({ ...baseOuting, strikes: null });
    expect(result.success).toBe(true);
  });

  it('rejects unrealistic velocities', () => {
    const result = validateOuting({ ...baseOuting, maxVelo: 150 });
    expect(result.success).toBe(false);
  });

  it('rejects bad video URLs', () => {
    const result = validateOuting({ ...baseOuting, videoUrl1: 'not-a-url' });
    expect(result.success).toBe(false);
  });

  it('accepts an empty video URL', () => {
    const result = validateOuting({ ...baseOuting, videoUrl1: '' });
    expect(result.success).toBe(true);
  });
});

describe('validatePitcher', () => {
  it('accepts a typical pitcher payload', () => {
    const result = validatePitcher({ name: 'A. Pitcher', maxWeeklyPitches: 120 });
    expect(result.success).toBe(true);
  });

  it('trims and rejects whitespace-only names', () => {
    const result = validatePitcher({ name: '   ', maxWeeklyPitches: 120 });
    expect(result.success).toBe(false);
  });

  it('rejects zero or negative weekly pitch caps', () => {
    expect(validatePitcher({ name: 'X', maxWeeklyPitches: 0 }).success).toBe(false);
    expect(validatePitcher({ name: 'X', maxWeeklyPitches: -10 }).success).toBe(false);
  });

  it('rejects implausibly high weekly pitch caps', () => {
    const result = validatePitcher({ name: 'X', maxWeeklyPitches: 10_000 });
    expect(result.success).toBe(false);
  });

  it('rejects non-integer weekly pitch caps', () => {
    const result = validatePitcher({ name: 'X', maxWeeklyPitches: 100.5 });
    expect(result.success).toBe(false);
  });
});
