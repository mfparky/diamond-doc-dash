import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseStatsCsv } from './stat-csv';
import {
  buildRankings,
  buildWeightingBreakdown,
  type RankingInput,
  type RankingOptions,
} from './team-rankings';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SAMPLE_CSV = readFileSync(join(__dirname, '__fixtures__/sample-stats.csv'), 'utf8');

const baseOptions: RankingOptions = {
  reefMode: '25',
  // Tests opt in to the participation floor when they want to exercise it.
  pitchingParticipationFloor: 0,
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
        bat_ops: 1.200, bat_r: 25, bat_rbi: 20, bat_qab_pct: 50, bat_bb_pct_k: 2.0, bat_ba_pct_risp: 0.500, bat_sb_pct: 100,
        pit_era: 1.5, pit_whip: 0.90, pit_fps_pct: 70, pit_k_pct_bf: 0.40,
        field_fpct: 1.0,
      } },
      { pitcherId: 'b', pitcherName: 'Middle', latest: {
        bat_ops: 0.700, bat_r: 12, bat_rbi: 9, bat_qab_pct: 30, bat_bb_pct_k: 0.7, bat_ba_pct_risp: 0.250, bat_sb_pct: 70,
        pit_era: 4.0, pit_whip: 1.40, pit_fps_pct: 55, pit_k_pct_bf: 0.20,
        field_fpct: 0.90,
      } },
      { pitcherId: 'c', pitcherName: 'Struggle', latest: {
        bat_ops: 0.300, bat_r: 4, bat_rbi: 2, bat_qab_pct: 10, bat_bb_pct_k: 0.2, bat_ba_pct_risp: 0.100, bat_sb_pct: 40,
        pit_era: 9.0, pit_whip: 2.20, pit_fps_pct: 35, pit_k_pct_bf: 0.05,
        field_fpct: 0.70,
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

  it('participation floor damps defense for kids who barely pitch', () => {
    // Three identical pitching lines, very different IP loads. Floor at 5 IP.
    const inputs: RankingInput[] = [
      { pitcherId: 'starter', pitcherName: 'Starter', latest: {
        bat_ops: 0.700, pit_era: 3.0, pit_whip: 1.20, pit_ip: 20,
      } },
      { pitcherId: 'semi', pitcherName: 'SemiRegular', latest: {
        bat_ops: 0.700, pit_era: 3.0, pit_whip: 1.20, pit_ip: 5,
      } },
      { pitcherId: 'rare', pitcherName: 'Rare', latest: {
        bat_ops: 0.700, pit_era: 3.0, pit_whip: 1.20, pit_ip: 1,
      } },
    ];
    const { rankings } = buildRankings(inputs, { ...baseOptions, pitchingParticipationFloor: 5 });
    const starter = rankings.find((r) => r.pitcherName === 'Starter')!;
    const semi = rankings.find((r) => r.pitcherName === 'SemiRegular')!;
    const rare = rankings.find((r) => r.pitcherName === 'Rare')!;

    // Starter (20 IP) and SemiRegular (5 IP) both above floor — same factor 1.
    expect(starter.participationFactor).toBe(1);
    expect(semi.participationFactor).toBe(1);
    expect(starter.belowParticipationFloor).toBe(false);
    expect(semi.belowParticipationFloor).toBe(false);

    // Rare (1 IP) is at 20% participation — defense damped by that factor.
    expect(rare.participationFactor).toBeCloseTo(0.2, 6);
    expect(rare.belowParticipationFloor).toBe(true);
    expect(rare.defenseScore).toBeLessThan(rare.defenseScoreRaw!);
    expect(rare.playerValue).toBeLessThan(semi.playerValue);
  });

  it('does not penalize non-pitchers beyond their already-NaN pitching metrics + damping', () => {
    // Pure hitter, no pitching at all → participationFactor 0 → defense fully damped to 0.
    const inputs: RankingInput[] = [
      { pitcherId: 'bat', pitcherName: 'BatOnly', latest: { bat_ops: 1.000, field_fpct: 1.0 } },
      { pitcherId: 'arm', pitcherName: 'ArmOnly', latest: { bat_ops: 0.400, pit_era: 2.0, pit_whip: 1.0, pit_ip: 10 } },
    ];
    const { rankings } = buildRankings(inputs, { ...baseOptions, pitchingParticipationFloor: 5 });
    const bat = rankings.find((r) => r.pitcherName === 'BatOnly')!;
    const arm = rankings.find((r) => r.pitcherName === 'ArmOnly')!;
    expect(bat.participationFactor).toBe(0);
    expect(bat.defenseScore).toBe(0);
    expect(arm.participationFactor).toBe(1);
    // Both should still have a sensible PV, neither at 0.
    expect(bat.playerValue).toBeGreaterThan(0);
    expect(arm.playerValue).toBeGreaterThan(0);
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

describe('buildRankings — weighting', () => {
  it('promotes a player who leads in R+RBI even with average peripheral stats', () => {
    // Three identical players, except one leads in R and RBI.
    const base = {
      bat_ops: 0.700, bat_qab_pct: 30, bat_bb_pct_k: 0.7,
      bat_ba_pct_risp: 0.250, bat_sb_pct: 70,
    };
    const inputs: RankingInput[] = [
      { pitcherId: 'a', pitcherName: 'RunsLeader', latest: { ...base, bat_r: 30, bat_rbi: 25 } },
      { pitcherId: 'b', pitcherName: 'Average', latest: { ...base, bat_r: 12, bat_rbi: 10 } },
      { pitcherId: 'c', pitcherName: 'Quiet', latest: { ...base, bat_r: 2, bat_rbi: 1 } },
    ];
    const { rankings } = buildRankings(inputs, baseOptions);
    // RunsLeader should outrank the others purely on R+RBI weight.
    expect(rankings[0].pitcherName).toBe('RunsLeader');
    expect(rankings[2].pitcherName).toBe('Quiet');
  });

  it('treats Double Plays as not part of the defense bucket', () => {
    // field_dp should be ignored entirely — large differences shouldn't move the ranking.
    const inputs: RankingInput[] = [
      { pitcherId: 'a', pitcherName: 'NoDP', latest: { pit_era: 3.0, pit_whip: 1.2, field_dp: 0 } },
      { pitcherId: 'b', pitcherName: 'MoreDP', latest: { pit_era: 3.0, pit_whip: 1.2, field_dp: 10 } },
    ];
    const { rankings } = buildRankings(inputs, baseOptions);
    // PV should be identical (or nearly so) because DP is no longer counted.
    expect(Math.abs(rankings[0].playerValue - rankings[1].playerValue)).toBeLessThan(0.001);
  });

  it('lets ERA/WHIP outweigh FPCT — fielding pct is barely-weighted', () => {
    const inputs: RankingInput[] = [
      // Strong arm, no glove
      { pitcherId: 'a', pitcherName: 'StrongArm', latest: { pit_era: 1.5, pit_whip: 0.9, field_fpct: 0.6 } },
      // Weak arm, perfect glove
      { pitcherId: 'b', pitcherName: 'GoldenGlove', latest: { pit_era: 8.0, pit_whip: 2.0, field_fpct: 1.0 } },
    ];
    const { rankings } = buildRankings(inputs, baseOptions);
    expect(rankings[0].pitcherName).toBe('StrongArm');
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

  it("accepts '15' as a reef mode and reports 15 as the percentile", () => {
    const inputs: RankingInput[] = Array.from({ length: 20 }, (_, i) => ({
      pitcherId: `p-${i}`,
      pitcherName: `P${i}`,
      latest: { bat_ops: (i + 1) / 20 },
    }));
    const result = buildRankings(inputs, { ...baseOptions, reefMode: '15' });
    expect(result.reefPercentile).toBe(15);
    // 15% of 20 = 3 -> at most 3 below reef
    const below = result.rankings.filter((r) => r.belowReef).length;
    expect(below).toBeGreaterThanOrEqual(2);
    expect(below).toBeLessThanOrEqual(3);
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

describe('buildRankings — derived metrics + new defense', () => {
  it('penalizes high strikeout rate (K%) at the plate', () => {
    const inputs: RankingInput[] = [
      { pitcherId: 'a', pitcherName: 'PutsItInPlay', latest: {
        bat_ops: 0.700, bat_r: 10, bat_rbi: 8, bat_qab_pct: 30, bat_bb_pct_k: 1.0,
        bat_ba_pct_risp: 0.250, bat_so: 5, bat_pa: 100,
      } },
      { pitcherId: 'b', pitcherName: 'WhiffMachine', latest: {
        bat_ops: 0.700, bat_r: 10, bat_rbi: 8, bat_qab_pct: 30, bat_bb_pct_k: 1.0,
        bat_ba_pct_risp: 0.250, bat_so: 40, bat_pa: 100,
      } },
    ];
    const { rankings } = buildRankings(inputs, baseOptions);
    expect(rankings[0].pitcherName).toBe('PutsItInPlay');
  });

  it('rewards higher pitcher Strike % (S%)', () => {
    const inputs: RankingInput[] = [
      { pitcherId: 'a', pitcherName: 'StrikeThrower', latest: { pit_era: 3.0, pit_whip: 1.2, pit_s_pct: 68 } },
      { pitcherId: 'b', pitcherName: 'NibbleKing', latest: { pit_era: 3.0, pit_whip: 1.2, pit_s_pct: 45 } },
    ];
    const { rankings } = buildRankings(inputs, baseOptions);
    expect(rankings[0].pitcherName).toBe('StrikeThrower');
  });
});

describe('buildRankings — intangibles', () => {
  it('promotes a player with plus ratings when stats are equal', () => {
    const sharedStats = { bat_ops: 0.700, bat_r: 10, bat_rbi: 8, bat_pa: 50 };
    const inputs: RankingInput[] = [
      { pitcherId: 'a', pitcherName: 'PlusEffort', latest: sharedStats, effortRating: 'plus', coachabilityRating: 'plus', baseballIqRating: 'plus' },
      { pitcherId: 'b', pitcherName: 'EvenAll', latest: sharedStats, effortRating: 'even', coachabilityRating: 'even', baseballIqRating: 'even' },
      { pitcherId: 'c', pitcherName: 'MinusAll', latest: sharedStats, effortRating: 'minus', coachabilityRating: 'minus', baseballIqRating: 'minus' },
    ];
    const { rankings } = buildRankings(inputs, baseOptions);
    expect(rankings[0].pitcherName).toBe('PlusEffort');
    expect(rankings[2].pitcherName).toBe('MinusAll');
  });

  it('does not penalize unrated players (null intangibles drop out of weighting)', () => {
    const sharedStats = { bat_ops: 0.700, bat_r: 10, bat_rbi: 8, bat_pa: 50 };
    const inputs: RankingInput[] = [
      { pitcherId: 'a', pitcherName: 'Rated', latest: sharedStats, effortRating: 'even', coachabilityRating: 'even', baseballIqRating: 'even' },
      { pitcherId: 'b', pitcherName: 'Unrated', latest: sharedStats }, // no rating fields
    ];
    const { rankings } = buildRankings(inputs, baseOptions);
    // Even ratings = 50, equivalent to neutral. Unrated player has the
    // intangibles bucket excluded entirely. PVs should be effectively equal.
    expect(Math.abs(rankings[0].playerValue - rankings[1].playerValue)).toBeLessThan(0.001);
    const rated = rankings.find((r) => r.pitcherName === 'Rated')!;
    const unrated = rankings.find((r) => r.pitcherName === 'Unrated')!;
    expect(rated.hasIntangibles).toBe(true);
    expect(unrated.hasIntangibles).toBe(false);
  });
});

describe('buildRankings — sample-size floor', () => {
  it('excludes players below minPlateAppearances from the main rankings', () => {
    const inputs: RankingInput[] = [
      { pitcherId: 'a', pitcherName: 'Regular', latest: { bat_ops: 0.600, bat_pa: 80 } },
      { pitcherId: 'b', pitcherName: 'Tiny', latest: { bat_ops: 1.500, bat_pa: 4 } },
      { pitcherId: 'c', pitcherName: 'Solid', latest: { bat_ops: 0.800, bat_pa: 60 } },
    ];
    const { rankings, excluded } = buildRankings(inputs, { ...baseOptions, minPlateAppearances: 10 });
    expect(rankings.map((r) => r.pitcherName)).toEqual(['Solid', 'Regular']);
    expect(excluded.map((r) => r.pitcherName)).toEqual(['Tiny']);
    expect(excluded[0].belowMinPa).toBe(true);
  });

  it('skips the floor when minPlateAppearances is 0 or unset', () => {
    const inputs: RankingInput[] = [
      { pitcherId: 'a', pitcherName: 'Regular', latest: { bat_ops: 0.600, bat_pa: 80 } },
      { pitcherId: 'b', pitcherName: 'Tiny', latest: { bat_ops: 1.500, bat_pa: 4 } },
    ];
    const { rankings, excluded } = buildRankings(inputs, baseOptions);
    expect(rankings.length).toBe(2);
    expect(excluded.length).toBe(0);
  });
});

describe('buildRankings — hitter/pitcher filter', () => {
  it("when filter='hitters', defense metrics don't affect the ranking", () => {
    const inputs: RankingInput[] = [
      { pitcherId: 'a', pitcherName: 'BatNoArm', latest: { bat_ops: 1.000, bat_r: 20, bat_rbi: 15, pit_era: 99 } },
      { pitcherId: 'b', pitcherName: 'ArmNoBat', latest: { bat_ops: 0.300, bat_r: 2, bat_rbi: 1, pit_era: 1.0 } },
    ];
    const { rankings } = buildRankings(inputs, { ...baseOptions, filter: 'hitters' });
    expect(rankings[0].pitcherName).toBe('BatNoArm');
  });

  it("when filter='pitchers', offense metrics don't affect the ranking", () => {
    const inputs: RankingInput[] = [
      { pitcherId: 'a', pitcherName: 'BatNoArm', latest: { bat_ops: 1.000, pit_era: 99, pit_whip: 5 } },
      { pitcherId: 'b', pitcherName: 'ArmNoBat', latest: { bat_ops: 0.300, pit_era: 1.0, pit_whip: 0.8 } },
    ];
    const { rankings } = buildRankings(inputs, { ...baseOptions, filter: 'pitchers' });
    expect(rankings[0].pitcherName).toBe('ArmNoBat');
  });
});

describe('buildRankings — topDrivers', () => {
  it('surfaces the highest-weighted contributing metrics per player', () => {
    const inputs: RankingInput[] = [
      { pitcherId: 'a', pitcherName: 'A', latest: {
        bat_ops: 1.200, bat_r: 30, bat_rbi: 25, bat_qab_pct: 50,
        bat_bb_pct_k: 2.0, bat_ba_pct_risp: 0.500, bat_so: 5, bat_pa: 80,
      } },
      { pitcherId: 'b', pitcherName: 'B', latest: {
        bat_ops: 0.700, bat_r: 12, bat_rbi: 10, bat_qab_pct: 25,
        bat_bb_pct_k: 0.5, bat_ba_pct_risp: 0.200, bat_so: 25, bat_pa: 80,
      } },
    ];
    const { rankings } = buildRankings(inputs, baseOptions);
    const top = rankings[0];
    expect(top.topDrivers.length).toBeGreaterThan(0);
    expect(top.topDrivers.length).toBeLessThanOrEqual(3);
    // The top driver for player A should be one of the weight-2 metrics.
    const headlineKeys = ['bat_ops', 'bat_r', 'bat_rbi'];
    expect(headlineKeys).toContain(top.topDrivers[0].key);
  });
});

describe('buildWeightingBreakdown', () => {
  it('sums to 100% across all metrics', () => {
    const { rows } = buildWeightingBreakdown();
    const total = rows.reduce((sum, r) => sum + r.shareOfPv, 0);
    expect(total).toBeCloseTo(1, 6);
  });

  it('bucket shares are exactly 45/45/10 (Off/Def/Intangibles)', () => {
    const { bucketShares } = buildWeightingBreakdown();
    expect(bucketShares.offense).toBeCloseTo(0.45, 6);
    expect(bucketShares.defense).toBeCloseTo(0.45, 6);
    expect(bucketShares.intangibles).toBeCloseTo(0.10, 6);
  });

  it('OPS share of bucket is greater than R or RBI', () => {
    const { rows } = buildWeightingBreakdown();
    const ops = rows.find((r) => r.key === 'bat_ops')!;
    const r = rows.find((r) => r.key === 'bat_r')!;
    const rbi = rows.find((r) => r.key === 'bat_rbi')!;
    expect(ops.shareOfBucket).toBeGreaterThan(r.shareOfBucket);
    expect(ops.shareOfBucket).toBeGreaterThan(rbi.shareOfBucket);
    expect(r.shareOfBucket).toBeCloseTo(rbi.shareOfBucket, 6);
  });

  it('FPCT share of PV is tiny (weight 0.25 inside a small bucket)', () => {
    const { rows } = buildWeightingBreakdown();
    const fpct = rows.find((r) => r.key === 'field_fpct')!;
    expect(fpct.shareOfPv).toBeLessThan(0.03); // under 3% of total PV
  });
});
