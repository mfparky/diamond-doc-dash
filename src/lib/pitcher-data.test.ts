import { describe, expect, it } from 'vitest';
import { calculatePitcherStats } from './pitcher-data';
import type { Outing, Pitcher } from '@/types/pitcher';

const basePitcher: Pitcher = {
  id: 'p1',
  name: 'Test Pitcher',
  sevenDayPulse: 0,
  strikePercentage: 0,
  maxVelo: 0,
  lastOuting: '',
  lastPitchCount: 0,
  restStatus: { type: 'no-data' },
  notes: '',
  outings: [],
};

function outing(overrides: Partial<Outing> & Pick<Outing, 'date' | 'timestamp'>): Outing {
  return {
    id: overrides.date,
    pitcherName: 'Test Pitcher',
    pitcherId: 'p1',
    eventType: 'Bullpen',
    pitchCount: 20,
    strikes: null,
    maxVelo: 0,
    notes: '',
    ...overrides,
  };
}

describe('calculatePitcherStats notes/focus/coachNotes', () => {
  it('shows blank notes for the most recent outing rather than backfilling an older note', () => {
    const outings: Outing[] = [
      outing({ date: '2026-08-01', timestamp: '2026-08-01T12:00:00Z', notes: 'Cooperstown game 3 — great curveball' }),
      outing({ date: '2026-08-10', timestamp: '2026-08-10T12:00:00Z', notes: '' }),
    ];
    const result = calculatePitcherStats(basePitcher, outings);
    expect(result.lastOuting).toBe('2026-08-10');
    expect(result.notes).toBe('');
  });

  it('shows the most recent outing note when one is present', () => {
    const outings: Outing[] = [
      outing({ date: '2026-08-01', timestamp: '2026-08-01T12:00:00Z', notes: 'Old note' }),
      outing({ date: '2026-08-10', timestamp: '2026-08-10T12:00:00Z', notes: 'Fresh note from last outing' }),
    ];
    const result = calculatePitcherStats(basePitcher, outings);
    expect(result.notes).toBe('Fresh note from last outing');
  });

  it('does not skip past a blank non-Live-ABs outing to find an older non-blank one', () => {
    const outings: Outing[] = [
      outing({ date: '2026-08-01', timestamp: '2026-08-01T12:00:00Z', notes: 'Very old note' }),
      outing({ date: '2026-08-05', timestamp: '2026-08-05T12:00:00Z', notes: '' }),
      outing({ date: '2026-08-10', timestamp: '2026-08-10T12:00:00Z', notes: '' }),
    ];
    const result = calculatePitcherStats(basePitcher, outings);
    expect(result.notes).toBe('');
  });

  it('excludes Live ABs outings when picking the reference outing for notes/focus/coachNotes', () => {
    const outings: Outing[] = [
      outing({
        date: '2026-08-05',
        timestamp: '2026-08-05T12:00:00Z',
        notes: 'Bullpen note',
        focus: 'Command',
        coachNotes: 'Looked sharp',
      }),
      outing({ date: '2026-08-10', timestamp: '2026-08-10T12:00:00Z', eventType: 'Live ABs', notes: '{"abs":[]}' }),
    ];
    const result = calculatePitcherStats(basePitcher, outings);
    expect(result.lastOuting).toBe('2026-08-10'); // overall most recent outing is still the Live ABs one
    expect(result.notes).toBe('Bullpen note');
    expect(result.focus).toBe('Command');
    expect(result.coachNotes).toBe('Looked sharp');
  });

  it('focus and coachNotes are blank when the most recent relevant outing has none, even if an older one does', () => {
    const outings: Outing[] = [
      outing({ date: '2026-08-01', timestamp: '2026-08-01T12:00:00Z', focus: 'Old focus', coachNotes: 'Old coach note' }),
      outing({ date: '2026-08-10', timestamp: '2026-08-10T12:00:00Z' }),
    ];
    const result = calculatePitcherStats(basePitcher, outings);
    expect(result.focus).toBeUndefined();
    expect(result.coachNotes).toBeUndefined();
  });
});
