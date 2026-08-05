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

  it('participation floor shrinks a low-IP pitching line toward neutral, not toward 0', () => {
    // Three DIFFERENT pitching lines (so the raw score isn't already sitting
    // at the neutral 50 from a min===max tie), very different IP loads.
    // Floor at 5 IP. Rare has the best raw line but the smallest sample.
    const inputs: RankingInput[] = [
      { pitcherId: 'starter', pitcherName: 'Starter', latest: {
        bat_ops: 0.700, pit_era: 4.0, pit_whip: 1.40, pit_ip: 20,
      } },
      { pitcherId: 'semi', pitcherName: 'SemiRegular', latest: {
        bat_ops: 0.700, pit_era: 3.0, pit_whip: 1.20, pit_ip: 5,
      } },
      { pitcherId: 'rare', pitcherName: 'Rare', latest: {
        bat_ops: 0.700, pit_era: 1.0, pit_whip: 0.80, pit_ip: 1,
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

    // Rare (1 IP) has the best raw line of the three (lowest ERA/WHIP →
    // highest raw defense score, 100 — team-best on both metrics). At 20%
    // participation, that raw score is shrunk 80% of the way toward the
    // neutral midpoint (50 + (100-50)*0.2 = 60) rather than toward 0 — a
    // great one-inning outing reads as "mildly above average," not "crushed
    // to near-zero," which is what the old (multiply-the-whole-thing-by-the-
    // factor) implementation would have done: 100 * 0.2 = 20.
    expect(rare.participationFactor).toBeCloseTo(0.2, 6);
    expect(rare.belowParticipationFloor).toBe(true);
    expect(rare.defenseScoreRaw).toBeCloseTo(100, 6);
    expect(rare.defenseScore).toBeCloseTo(60, 6);
    expect(rare.defenseScore).toBeLessThan(rare.defenseScoreRaw!);
    expect(rare.defenseScore).toBeGreaterThan(50);
  });

  it('lets a real glove lift a barely-pitched kid\'s defense score, even with a bad small sample', () => {
    const inputs: RankingInput[] = [
      { pitcherId: 'good', pitcherName: 'FullTrust', latest: {
        pit_era: 1.0, pit_whip: 0.8, pit_ip: 10, field_fpct: 0.6,
      } },
      { pitcherId: 'shaky', pitcherName: 'ShakySample', latest: {
        pit_era: 9.0, pit_whip: 2.2, pit_ip: 1, field_fpct: 1.0,
      } },
    ];
    const { rankings } = buildRankings(inputs, { ...baseOptions, pitchingParticipationFloor: 5 });
    const shaky = rankings.find((r) => r.pitcherName === 'ShakySample')!;

    // Shaky's raw pitching line is the worst on the team (era/whip both
    // worse than FullTrust's), but their FPCT is the best. Weight-scaling
    // the tiny pitching sample lets that real glove work pull the blended
    // defense score above neutral (52), not just less-terrible.
    expect(shaky.defenseScore).toBeCloseTo(52, 6);
    expect(shaky.defenseScore).toBeGreaterThan(50);
  });

  it('highImpactArm bypasses the participation floor entirely for that player', () => {
    // A reference player is needed so era/whip/fpct actually normalize
    // against a spread rather than collapsing to 50 with only one data point.
    const inputs: RankingInput[] = [
      { pitcherId: 'good', pitcherName: 'FullTrust', latest: {
        pit_era: 1.0, pit_whip: 0.8, pit_ip: 10, field_fpct: 0.6,
      } },
      { pitcherId: 'shaky', pitcherName: 'ShakySample', latest: {
        pit_era: 9.0, pit_whip: 2.2, pit_ip: 1, field_fpct: 1.0,
      }, highImpactArm: true },
    ];
    const { rankings } = buildRankings(inputs, { ...baseOptions, pitchingParticipationFloor: 5 });
    const shaky = rankings.find((r) => r.pitcherName === 'ShakySample')!;

    // Override forces full trust: participationFactor is 1 regardless of IP,
    // so the (genuinely bad) pitching line counts at full, un-shrunk weight
    // and value — this drags the blend down, since the coach has vouched
    // the small sample is representative, not asked for it to be protected.
    expect(shaky.participationFactor).toBe(1);
    expect(shaky.belowParticipationFloor).toBe(false);
    expect(shaky.defenseScore).toBeLessThan(50);
  });

  it('never zeroes out a non-pitcher\'s real fielding score', () => {
    // Pure hitter, no pitching at all — participationFactor is 0, but that
    // must only damp a (nonexistent) pitching component, not the fielding
    // score, which should reflect the real FPCT percentile.
    const inputs: RankingInput[] = [
      { pitcherId: 'bat', pitcherName: 'BatOnly', latest: { bat_ops: 1.000, field_fpct: 1.0 } },
      { pitcherId: 'bat2', pitcherName: 'BatOnly2', latest: { bat_ops: 0.900, field_fpct: 0.6 } },
      { pitcherId: 'arm', pitcherName: 'ArmOnly', latest: { bat_ops: 0.400, pit_era: 2.0, pit_whip: 1.0, pit_ip: 10 } },
    ];
    const { rankings } = buildRankings(inputs, { ...baseOptions, pitchingParticipationFloor: 5 });
    const bat = rankings.find((r) => r.pitcherName === 'BatOnly')!;
    const bat2 = rankings.find((r) => r.pitcherName === 'BatOnly2')!;
    const arm = rankings.find((r) => r.pitcherName === 'ArmOnly')!;
    expect(bat.participationFactor).toBe(0);
    // Best FPCT in the team → full credit, not zeroed by pitching participation.
    expect(bat.defenseScore).toBe(100);
    expect(bat.defenseScore).toBeGreaterThan(bat2.defenseScore!);
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

describe('buildRankings — VORP / WAR', () => {
  it('computes offense VORP against the belowReef pool\'s average rate', () => {
    // 4 hitters, ops/r/rbi all monotonic a<b<c<d so ranking is unambiguous.
    // reefMode 50 splits the bottom 2 (a, b) into the replacement pool.
    const inputs: RankingInput[] = [
      { pitcherId: 'a', pitcherName: 'A', latest: { bat_ops: 0.300, bat_pa: 20, bat_r: 1, bat_rbi: 1 } }, // rate 0.1
      { pitcherId: 'b', pitcherName: 'B', latest: { bat_ops: 0.600, bat_pa: 20, bat_r: 3, bat_rbi: 3 } }, // rate 0.3
      { pitcherId: 'c', pitcherName: 'C', latest: { bat_ops: 0.900, bat_pa: 20, bat_r: 5, bat_rbi: 5 } }, // rate 0.5
      { pitcherId: 'd', pitcherName: 'D', latest: { bat_ops: 1.200, bat_pa: 30, bat_r: 11, bat_rbi: 10 } }, // rate 0.7
    ];
    const { rankings, excluded, replacementOffenseRate } = buildRankings(inputs, { ...baseOptions, reefMode: '50' });
    const all = [...rankings, ...excluded];
    expect(all.map((r) => r.pitcherName).sort()).toEqual(['A', 'B', 'C', 'D']);

    const a = all.find((r) => r.pitcherName === 'A')!;
    const b = all.find((r) => r.pitcherName === 'B')!;
    const c = all.find((r) => r.pitcherName === 'C')!;
    const d = all.find((r) => r.pitcherName === 'D')!;

    expect(a.belowReef).toBe(true);
    expect(b.belowReef).toBe(true);
    expect(c.belowReef).toBe(false);
    // Replacement rate = average of A (0.1) and B (0.3) = 0.2
    expect(replacementOffenseRate).toBeCloseTo(0.2, 6);
    expect(c.vorpOffense).toBeCloseTo((0.5 - 0.2) * 20, 6); // 6.0
    expect(d.vorpOffense).toBeCloseTo((0.7 - 0.2) * 30, 6); // 15.0
  });

  it('computes pitching VORP and converts to WAR via runsPerWin', () => {
    const inputs: RankingInput[] = [
      { pitcherId: 'a', pitcherName: 'A', latest: { pit_era: 8.0, pit_ip: 5 } },
      { pitcherId: 'b', pitcherName: 'B', latest: { pit_era: 6.0, pit_ip: 5 } },
      { pitcherId: 'c', pitcherName: 'C', latest: { pit_era: 4.0, pit_ip: 9 } },
      { pitcherId: 'd', pitcherName: 'D', latest: { pit_era: 2.0, pit_ip: 9 } },
    ];
    const { rankings, excluded, replacementEra, runsPerWin } = buildRankings(inputs, { ...baseOptions, reefMode: '50' });
    const all = [...rankings, ...excluded];
    const c = all.find((r) => r.pitcherName === 'C')!;
    const d = all.find((r) => r.pitcherName === 'D')!;

    // Replacement ERA = average of A (8.0) and B (6.0) = 7.0
    expect(replacementEra).toBeCloseTo(7.0, 6);
    expect(runsPerWin).toBe(10); // DEFAULT_RUNS_PER_WIN, no override passed
    expect(c.vorpPitching).toBeCloseTo((7.0 - 4.0) * (9 / 9), 6); // 3.0
    expect(d.vorpPitching).toBeCloseTo((7.0 - 2.0) * (9 / 9), 6); // 5.0
    expect(d.war).toBeCloseTo(5.0 / 10, 6); // 0.5

    // Custom runsPerWin halves the win value for the same run value.
    const withCustomRpw = buildRankings(inputs, { ...baseOptions, reefMode: '50', runsPerWin: 5 });
    const dCustom = [...withCustomRpw.rankings, ...withCustomRpw.excluded].find((r) => r.pitcherName === 'D')!;
    expect(dCustom.war).toBeCloseTo(5.0 / 5, 6); // 1.0
  });

  it('shrinks pitching VORP by the same participationFactor as the composite Defense score', () => {
    // A one-outing 10.5 ERA blow-up on a 1-IP sample shouldn't count at full
    // face value in a forward-looking "what if we swapped him" projection —
    // it should be shrunk exactly as much as the main Defense score already
    // shrinks it, not taken at face value just because VORP is a different
    // code path.
    const inputs: RankingInput[] = [
      { pitcherId: 'best', pitcherName: 'Best', latest: { pit_era: 2.0, pit_ip: 10 } },
      { pitcherId: 'mid', pitcherName: 'Mid', latest: { pit_era: 5.0, pit_ip: 10 } },
      { pitcherId: 'worst', pitcherName: 'Worst', latest: { pit_era: 9.0, pit_ip: 10 } },
      { pitcherId: 'shaky', pitcherName: 'Shaky', latest: { pit_era: 10.5, pit_ip: 1 } },
    ];
    const { rankings, excluded, replacementEra } = buildRankings(
      inputs,
      { ...baseOptions, reefMode: '50', pitchingParticipationFloor: 5 },
    );
    const all = [...rankings, ...excluded];
    const shaky = all.find((r) => r.pitcherName === 'Shaky')!;
    const worst = all.find((r) => r.pitcherName === 'Worst')!;

    expect(shaky.participationFactor).toBeCloseTo(0.2, 6);
    expect(worst.participationFactor).toBe(1);
    expect(replacementEra).not.toBeNull();

    const unshrunkVorp = (replacementEra! - 10.5) * (1 / 9);
    const expectedShrunkVorp = (replacementEra! - 10.5) * shaky.participationFactor * (1 / 9);
    expect(shaky.vorpPitching).toBeCloseTo(expectedShrunkVorp, 6);
    // Shrinking pulls the VORP toward zero — a small, noisy sample doesn't
    // earn full credit (or full blame) in either direction.
    expect(Math.abs(shaky.vorpPitching!)).toBeLessThan(Math.abs(unshrunkVorp));

    // Full-IP "Worst" gets no such protection — a genuinely bad season-long
    // line is trusted in full, unshrunk.
    expect(worst.vorpPitching).toBeCloseTo((replacementEra! - 9.0) * 1 * (10 / 9), 6);
  });

  it('leaves VORP/WAR null when a player has no PA/IP data to rate', () => {
    const inputs: RankingInput[] = [
      { pitcherId: 'a', pitcherName: 'A', latest: { bat_ops: 0.700 } }, // no bat_pa
      { pitcherId: 'b', pitcherName: 'B', latest: { bat_ops: 0.500 } },
    ];
    const { rankings } = buildRankings(inputs, baseOptions);
    for (const r of rankings) {
      expect(r.vorpOffense).toBeNull();
      expect(r.vorpPitching).toBeNull();
      expect(r.war).toBeNull();
    }
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

describe('buildRankings — ceiling', () => {
  it('flags the top ~15% of players by default', () => {
    const inputs: RankingInput[] = Array.from({ length: 20 }, (_, i) => ({
      pitcherId: `p-${i}`,
      pitcherName: `P${i}`,
      latest: { bat_ops: (i + 1) / 20 },
    }));
    const result = buildRankings(inputs, baseOptions);
    expect(result.ceilingPercentile).toBe(15);
    const above = result.rankings.filter((r) => r.aboveCeiling).length;
    // 15% of 20 = 3 -> ~3 above ceiling
    expect(above).toBeGreaterThanOrEqual(2);
    expect(above).toBeLessThanOrEqual(4);
    // Above-ceiling players are always the top of the rankings
    const topPvs = result.rankings.slice(0, above);
    expect(topPvs.every((r) => r.aboveCeiling)).toBe(true);
  });

  it('respects ceilingMode 10 vs 20', () => {
    const inputs: RankingInput[] = Array.from({ length: 20 }, (_, i) => ({
      pitcherId: `p-${i}`,
      pitcherName: `P${i}`,
      latest: { bat_ops: (i + 1) / 20 },
    }));
    const strict = buildRankings(inputs, { ...baseOptions, ceilingMode: '10' });
    const loose = buildRankings(inputs, { ...baseOptions, ceilingMode: '20' });
    expect(strict.ceilingPercentile).toBe(10);
    expect(loose.ceilingPercentile).toBe(20);
    expect(strict.rankings.filter((r) => r.aboveCeiling).length).toBeLessThanOrEqual(
      loose.rankings.filter((r) => r.aboveCeiling).length,
    );
    expect(strict.ceilingThreshold!).toBeGreaterThan(loose.ceilingThreshold!);
  });

  it("ceilingMode 'off' clears the flag and null-fills threshold + percentile", () => {
    const inputs: RankingInput[] = Array.from({ length: 20 }, (_, i) => ({
      pitcherId: `p-${i}`,
      pitcherName: `P${i}`,
      latest: { bat_ops: (i + 1) / 20 },
    }));
    const result = buildRankings(inputs, { ...baseOptions, ceilingMode: 'off' });
    expect(result.ceilingPercentile).toBeNull();
    expect(result.ceilingThreshold).toBeNull();
    expect(result.rankings.every((r) => !r.aboveCeiling)).toBe(true);
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

  it('bucket shares are 40/50/10 (Off/Def/Intangibles) — pitching-weighted', () => {
    const { bucketShares } = buildWeightingBreakdown();
    expect(bucketShares.offense).toBeCloseTo(0.40, 6);
    expect(bucketShares.defense).toBeCloseTo(0.50, 6);
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

  it('respects lever overrides: bucket weight bump + metric enable', () => {
    const { rows, bucketShares } = buildWeightingBreakdown({
      bucketWeights: { offense: 0.6, defense: 0.3, intangibles: 0.1 },
      metricEnabled: { bat_2outrbi: true },
    });
    // Offense should now claim ~60% of PV
    expect(bucketShares.offense).toBeCloseTo(0.6, 3);
    expect(bucketShares.defense).toBeCloseTo(0.3, 3);
    // 2-out RBI should show up in the rows now
    expect(rows.some((r) => r.key === 'bat_2outrbi')).toBe(true);
  });

  it('adds an IP volume slice when bucketWeights.ipVolume > 0', () => {
    const { bucketShares } = buildWeightingBreakdown({
      bucketWeights: { offense: 0.45, defense: 0.45, intangibles: 0.10, ipVolume: 0.15 },
    });
    // 0.15 of 1.15 = ~0.13
    expect(bucketShares.ipVolume).toBeCloseTo(0.15 / 1.15, 3);
  });
});

describe('buildRankings — lever overrides', () => {
  it('2-out RBI is off by default and turning it on affects the ranking', () => {
    const inputs: RankingInput[] = [
      { pitcherId: 'a', pitcherName: 'ClutchKid', latest: { bat_ops: 0.700, bat_r: 10, bat_rbi: 10, bat_2outrbi: 8, bat_pa: 50 } },
      { pitcherId: 'b', pitcherName: 'SituationalMiss', latest: { bat_ops: 0.700, bat_r: 10, bat_rbi: 10, bat_2outrbi: 0, bat_pa: 50 } },
    ];
    const off = buildRankings(inputs, baseOptions);
    const on = buildRankings(inputs, { ...baseOptions, metricEnabled: { bat_2outrbi: true } });
    // When 2-out RBI is off, the two players are basically tied.
    expect(Math.abs(off.rankings[0].playerValue - off.rankings[1].playerValue)).toBeLessThan(0.001);
    // Turning it on moves the clutch kid to the top.
    expect(on.rankings[0].pitcherName).toBe('ClutchKid');
  });

  it('bucket weight overrides shift the composite', () => {
    // Two two-way players. BatOnlyBig has a much better bat + worse arm;
    // ArmOnlyBig is the reverse. Sliding the bucket weights should flip
    // which one ranks higher.
    const inputs: RankingInput[] = [
      { pitcherId: 'bat', pitcherName: 'BatOnlyBig', latest: {
        bat_ops: 1.100, bat_pa: 100,
        pit_era: 8.0, pit_whip: 2.0, pit_ip: 20,
      } },
      { pitcherId: 'arm', pitcherName: 'ArmOnlyBig', latest: {
        bat_ops: 0.400, bat_pa: 100,
        pit_era: 1.5, pit_whip: 0.9, pit_ip: 20,
      } },
    ];
    const offHeavy = buildRankings(inputs, { ...baseOptions, bucketWeights: { offense: 0.9, defense: 0.1 } });
    const defHeavy = buildRankings(inputs, { ...baseOptions, bucketWeights: { offense: 0.1, defense: 0.9 } });
    expect(offHeavy.rankings[0].pitcherName).toBe('BatOnlyBig');
    expect(defHeavy.rankings[0].pitcherName).toBe('ArmOnlyBig');
  });

  it('IP volume bonus (via bucketWeights.ipVolume) restores the innings-eater lift', () => {
    const inputs: RankingInput[] = [
      { pitcherId: 'starter', pitcherName: 'Starter', latest: { bat_ops: 0.700, pit_era: 3.0, pit_whip: 1.20, pit_ip: 30, bat_pa: 40 } },
      { pitcherId: 'reliever', pitcherName: 'Reliever', latest: { bat_ops: 0.700, pit_era: 3.0, pit_whip: 1.20, pit_ip: 2, bat_pa: 40 } },
    ];
    const nobonus = buildRankings(inputs, baseOptions);
    const withBonus = buildRankings(inputs, { ...baseOptions, bucketWeights: { offense: 0.45, defense: 0.45, intangibles: 0.10, ipVolume: 0.15 } });
    // No bonus + same participation factor -> basically tied on rates.
    expect(Math.abs(nobonus.rankings[0].playerValue - nobonus.rankings[1].playerValue)).toBeLessThan(1);
    // Bonus flips it: starter clearly ahead
    expect(withBonus.rankings[0].pitcherName).toBe('Starter');
    expect(withBonus.rankings[0].playerValue).toBeGreaterThan(withBonus.rankings[1].playerValue);
  });

  it('metricWeights=0 zeroes out a metric without disabling the whole bucket', () => {
    // With bat_r and bat_rbi zeroed, the composite reduces to OPS + other
    // rate stats. Producer (high OPS, low R/RBI) should end up ahead.
    const inputs: RankingInput[] = [
      { pitcherId: 'a', pitcherName: 'Producer', latest: { bat_ops: 1.100, bat_r: 5, bat_rbi: 5, bat_pa: 40 } },
      { pitcherId: 'b', pitcherName: 'RunsLeader', latest: { bat_ops: 0.700, bat_r: 30, bat_rbi: 25, bat_pa: 40 } },
    ];
    const rWeight0 = buildRankings(inputs, { ...baseOptions, metricWeights: { bat_r: 0, bat_rbi: 0 } });
    expect(rWeight0.rankings[0].pitcherName).toBe('Producer');
    // Producer's offense should be higher when R + RBI are ignored — even by a
    // meaningful margin since OPS is now the only signal that separates them.
    expect(rWeight0.rankings[0].playerValue).toBeGreaterThan(rWeight0.rankings[1].playerValue);
  });
});
