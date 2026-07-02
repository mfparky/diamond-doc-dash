import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseStatsCsv } from './stat-csv';
import {
  buildBattingOrder,
  applyManualOrder,
  type LineupCandidate,
} from './lineup-builder';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SAMPLE_CSV = readFileSync(join(__dirname, '__fixtures__/sample-stats.csv'), 'utf8');

function fixtureCandidates(): LineupCandidate[] {
  const parsed = parseStatsCsv(SAMPLE_CSV);
  return parsed.rows.map((r, i) => ({
    pitcherId: `p-${i}`,
    pitcherName: r.fullName,
    stats: r.stats,
  }));
}

describe('buildBattingOrder — slot rules', () => {
  it('picks the highest-OBP hitter to lead off', () => {
    const players: LineupCandidate[] = [
      { pitcherId: 'a', pitcherName: 'Grinder', stats: { bat_obp: 0.520, bat_ops: 0.700, bat_qab_pct: 20, bat_so: 4, bat_pa: 40 } },
      { pitcherId: 'b', pitcherName: 'Slugger', stats: { bat_obp: 0.320, bat_ops: 1.100, bat_qab_pct: 15, bat_so: 12, bat_pa: 40 } },
    ];
    const order = buildBattingOrder(players);
    expect(order[0].candidateName).toBe('Grinder');
    expect(order[0].archetype).toBe('leadoff');
  });

  it('uses OPS to fill the 3-hole and cleanup', () => {
    const players: LineupCandidate[] = [
      { pitcherId: 'a', pitcherName: 'Grinder', stats: { bat_obp: 0.520, bat_ops: 0.700, bat_qab_pct: 55, bat_so: 4, bat_pa: 40 } },
      { pitcherId: 'b', pitcherName: 'Contact', stats: { bat_obp: 0.400, bat_ops: 0.800, bat_qab_pct: 60, bat_so: 3, bat_pa: 40 } },
      { pitcherId: 'c', pitcherName: 'BigBat',  stats: { bat_obp: 0.410, bat_ops: 1.200, bat_qab_pct: 25, bat_so: 8, bat_pa: 40 } },
      { pitcherId: 'd', pitcherName: 'Slugger', stats: { bat_obp: 0.390, bat_ops: 1.100, bat_qab_pct: 22, bat_so: 9, bat_pa: 40 } },
    ];
    const order = buildBattingOrder(players);
    // Grinder leads off, Contact hits 2nd, then OPS leaders fill 3 and 4.
    expect(order[0].candidateName).toBe('Grinder');
    expect(order[1].candidateName).toBe('Contact');
    expect(order[2].candidateName).toBe('BigBat');
    expect(order[2].archetype).toBe('best-bat-3');
    expect(order[3].candidateName).toBe('Slugger');
    expect(order[3].archetype).toBe('cleanup-4');
  });

  it('places the RBI/PA leader in the 5-hole', () => {
    // 4 players so we get to the 5-hole after picks.
    const players: LineupCandidate[] = [
      { pitcherId: 'a', pitcherName: 'Filler', stats: { bat_obp: 0.500, bat_ops: 0.700, bat_qab_pct: 40, bat_so: 4, bat_pa: 40, bat_rbi: 5 } },
      { pitcherId: 'b', pitcherName: 'Filler2', stats: { bat_obp: 0.400, bat_ops: 0.800, bat_qab_pct: 30, bat_so: 5, bat_pa: 40, bat_rbi: 6 } },
      { pitcherId: 'c', pitcherName: 'Filler3', stats: { bat_obp: 0.410, bat_ops: 0.900, bat_qab_pct: 32, bat_so: 6, bat_pa: 40, bat_rbi: 7 } },
      { pitcherId: 'd', pitcherName: 'Filler4', stats: { bat_obp: 0.395, bat_ops: 0.850, bat_qab_pct: 28, bat_so: 7, bat_pa: 40, bat_rbi: 4 } },
      { pitcherId: 'e', pitcherName: 'RBIStar', stats: { bat_obp: 0.360, bat_ops: 0.700, bat_qab_pct: 20, bat_so: 8, bat_pa: 40, bat_rbi: 25 } },
    ];
    const order = buildBattingOrder(players);
    const fifthSpot = order.find((s) => s.order === 5);
    expect(fifthSpot?.candidateName).toBe('RBIStar');
    expect(fifthSpot?.archetype).toBe('rbi-5');
  });

  it('does not assign the same player to two slots', () => {
    const players = fixtureCandidates();
    const order = buildBattingOrder(players);
    const ids = order.map((s) => s.candidateId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('respects spotCount when fewer than the available pool', () => {
    const players = fixtureCandidates();
    const order = buildBattingOrder(players, 9);
    expect(order.length).toBe(9);
  });

  it('handles empty input gracefully', () => {
    expect(buildBattingOrder([])).toEqual([]);
  });

  it('handles zero spotCount', () => {
    expect(buildBattingOrder(fixtureCandidates(), 0)).toEqual([]);
  });
});

describe('buildBattingOrder — fixture smoke', () => {
  it('produces rationales that mention the driving metric', () => {
    const order = buildBattingOrder(fixtureCandidates(), 9);
    for (const spot of order) {
      expect(spot.rationale.length).toBeGreaterThan(0);
      // At least one of the known metric labels should appear
      expect(/OBP|OPS|QAB%|RBI/.test(spot.rationale)).toBe(true);
    }
  });

  it('driver key matches the archetype expectation', () => {
    const order = buildBattingOrder(fixtureCandidates(), 9);
    expect(order[0].driver.key).toBe('bat_obp');
    expect(order[2].driver.key).toBe('bat_ops');
    const fifthSpot = order.find((s) => s.order === 5)!;
    expect(fifthSpot.driver.key).toBe('bat_rbi_per_pa');
  });
});

describe('applyManualOrder', () => {
  it('preserves the caller-provided order and re-labels archetypes 1..N', () => {
    const players = fixtureCandidates().slice(0, 5).reverse(); // pick 5 in some order
    const order = applyManualOrder(players);
    expect(order.map((s) => s.candidateId)).toEqual(players.map((p) => p.pitcherId));
    expect(order[0].archetype).toBe('leadoff');
    expect(order[4].archetype).toBe('rbi-5');
  });

  it('falls back to depth beyond slot 9', () => {
    const players = fixtureCandidates().slice(0, 13);
    const order = applyManualOrder(players);
    expect(order[9].archetype).toBe('depth');
    expect(order[12].archetype).toBe('depth');
  });
});
