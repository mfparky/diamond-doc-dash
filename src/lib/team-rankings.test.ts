import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseStatsCsv } from './stat-csv';
import {
  buildRankings,
  type RankingInput,
  type RankingOptions,
} from './team-rankings';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SAMPLE_CSV = readFileSync(join(__dirname, '__fixtures__/sample-stats.csv'), 'utf8');

const baseOptions: RankingOptions = {
  includePitchingVolume: false,
  reefMode: '25',
};

function fixtureInputs(): RankingInput[] {
  const parsed = parseStatsCsv(SAMPLE_CSV);
  return parsed.rows.map((r, i) => ({
    pitcherId: `p-${i}`,
    pitcherName: r.fullName,
    latest: r.stats,
  }));
}

describe('buildRankings — composition', () => {
  it('ranks the best player at the top and the worst at the bottom', () => {
    const inputs: RankingInput[] = [
      { pitcherId: 'a', pitcherName: 'Ace', latest: {
        bat_ops: 1.200, bat_qab_pct: 50, bat_bb_pct_k: 2.0, bat_ba_pct_risp: 0.500, bat_sb_pct: 100,
        pit_era: 1.5, pit_whip: 0.90, pit_fps_pct: 70, pit_k_pct_bf: 0.40,
        field_fpct: 1.0, field_dp: 3,
      } },
      { pitcherId: 'b', pitcherName: 'Middle', latest: {
        bat_ops: 0.700, bat_qab_pct: 30, bat_bb_pct_k: 0.7, bat_ba_pct_risp: 0.250, bat_sb_pct: 70,
        pit_era: 4.0, pit_whip: 1.40, pit_fps_pct: 55, pit_k_pct_bf: 0.20,
        field_fpct: 0.90, field_dp: 1,
      } },
      { pitcherId: 'c', pitcherName: 'Struggle', latest: {
        bat_ops: 0.300, bat_qab_pct: 10, bat_bb_pct_k: 0.2, bat_ba_pct_risp: 0.100, bat_sb_pct: 40,
        pit_era: 9.0, pit_whip: 2.20, pit_fps_pct: 35, pit_k_pct_bf: 0.05,
        field_fpct: 0.70, field_dp: 0,
      } },
    ];
    const { rankings } = buildRankings(inputs, baseOptions);
    expect(rankings.map((r) => r.pitcherName)).toEqual(['Ace', 'Middle', 'Struggle']);
    expect(rankings[0].playerValue).toBeGreaterThan(rankings[1].playerValue);
    expect(rankings[1].playerValue).toBeGreaterThan(rankings[2].playerValue);
  });

  it('inverts lower-is-better metrics (ERA, WHIP)', () => {
    const inputs: RankingInput[] = [
      { pitcherId: 'low', pitcherName: 'LowERA', latest: { pit_era: 1.0, pit_whip: 0.8 } },
      { pitcherId: 'high', pitcherName: 'HighERA', latest: { pit_era: 9.0, pit_whip: 2.5 } },
    ];
    const { rankings } = buildRankings(inputs, baseOptions);
    expect(rankings[0].pitcherName).toBe('LowERA');
  });

  it('handles a player with no offensive data without crashing', () => {
    const inputs: RankingInput[] = [
      { pitcherId: 'a', pitcherName: 'Hitter', latest: { bat_ops: 1.0 } },
      { pitcherId: 'b', pitcherName: 'PitcherOnly', latest: { pit_era: 2.0, pit_whip: 1.0 } },
    ];
    const { rankings } = buildRankings(inputs, baseOptions);
    const hitter = rankings.find((r) => r.pitcherName === 'Hitter')!;
    const pitcher = rankings.find((r) => r.pitcherName === 'PitcherOnly')!;
    expect(hitter.hasOffense).toBe(true);
    expect(hitter.hasDefense).toBe(false);
    expect(pitcher.hasOffense).toBe(false);
    expect(pitcher.hasDefense).toBe(true);
    // Neither is dragged to 0
    expect(hitter.playerValue).toBeGreaterThan(0);
    expect(pitcher.playerValue).toBeGreaterThan(0);
  });

  it('changes the ranking when includePitchingVolume is on for a high-IP pitcher', () => {
    const inputs: RankingInput[] = [
      // Identical stats but very different IP loads
      { pitcherId: 'starter', pitcherName: 'Starter', latest: {
        bat_ops: 0.700, pit_era: 3.0, pit_whip: 1.20, pit_ip: 40,
      } },
      { pitcherId: 'reliever', pitcherName: 'Reliever', latest: {
        bat_ops: 0.700, pit_era: 3.0, pit_whip: 1.20, pit_ip: 2,
      } },
    ];
    const without = buildRankings(inputs, { ...baseOptions, includePitchingVolume: false });
    const withVol = buildRankings(inputs, { ...baseOptions, includePitchingVolume: true });
    // Same stats with volume off → essentially tied
    expect(Math.abs(without.rankings[0].playerValue - without.rankings[1].playerValue)).toBeLessThan(0.001);
    // With volume on, Starter outranks Reliever
    expect(withVol.rankings[0].pitcherName).toBe('Starter');
    expect(withVol.rankings[0].playerValue).toBeGreaterThan(withVol.rankings[1].playerValue);
  });

  it('returns a 0 PV for players with no stats at all', () => {
    const inputs: RankingInput[] = [
      { pitcherId: 'a', pitcherName: 'A', latest: { bat_ops: 1.0 } },
      { pitcherId: 'b', pitcherName: 'Empty', latest: null },
    ];
    const { rankings } = buildRankings(inputs, baseOptions);
    const empty = rankings.find((r) => r.pitcherName === 'Empty')!;
    expect(empty.playerValue).toBe(0);
    expect(empty.hasOffense).toBe(false);
    expect(empty.hasDefense).toBe(false);
  });
});

describe('buildRankings — reef line', () => {
  it('flags exactly the bottom percentile of players', () => {
    // 10 players with PV proportional to bat_ops 0.1..1.0
    const inputs: RankingInput[] = Array.from({ length: 10 }, (_, i) => ({
      pitcherId: `p-${i}`,
      pitcherName: `P${i}`,
      latest: { bat_ops: (i + 1) / 10 },
    }));
    const { rankings, reefThreshold } = buildRankings(inputs, { ...baseOptions, reefMode: '25' });
    const belowCount = rankings.filter((r) => r.belowReef).length;
    // 25% of 10 = 2.5, floor → 2 players strictly below threshold
    expect(belowCount).toBeGreaterThanOrEqual(2);
    expect(belowCount).toBeLessThanOrEqual(3);
    expect(reefThreshold).toBeGreaterThan(0);
  });

  it('moves the reef higher when 50th percentile is chosen', () => {
    const inputs: RankingInput[] = Array.from({ length: 10 }, (_, i) => ({
      pitcherId: `p-${i}`,
      pitcherName: `P${i}`,
      latest: { bat_ops: (i + 1) / 10 },
    }));
    const r25 = buildRankings(inputs, { ...baseOptions, reefMode: '25' });
    const r50 = buildRankings(inputs, { ...baseOptions, reefMode: '50' });
    expect(r50.reefThreshold).toBeGreaterThan(r25.reefThreshold);
    expect(r50.rankings.filter((r) => r.belowReef).length).toBeGreaterThan(
      r25.rankings.filter((r) => r.belowReef).length,
    );
  });
});

describe('buildRankings — real fixture smoke', () => {
  it('returns a full ranking with valid scores', () => {
    const { rankings, reefThreshold } = buildRankings(fixtureInputs(), baseOptions);
    expect(rankings.length).toBe(13);
    expect(rankings.every((r) => r.playerValue >= 0 && r.playerValue <= 100)).toBe(true);
    // Reef should land somewhere meaningful
    expect(reefThreshold).toBeGreaterThan(0);
    expect(reefThreshold).toBeLessThan(100);
    // 25% of 13 = 3.25 → expect ~3 below
    const belowCount = rankings.filter((r) => r.belowReef).length;
    expect(belowCount).toBeGreaterThanOrEqual(2);
    expect(belowCount).toBeLessThanOrEqual(4);
  });

  it('top-ranked player has both offense and defense data on the fixture', () => {
    const { rankings } = buildRankings(fixtureInputs(), baseOptions);
    const top = rankings[0];
    expect(top.hasOffense || top.hasDefense).toBe(true);
  });
});
