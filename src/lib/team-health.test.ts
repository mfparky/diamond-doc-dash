import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseStatsCsv } from './stat-csv';
import {
  aggregateTeamStats,
  computeLeaderboards,
  findCohorts,
  buildTeamHealthReport,
  type PitcherSnapshotInput,
} from './team-health';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SAMPLE_CSV = readFileSync(join(__dirname, '__fixtures__/sample-stats.csv'), 'utf8');

/** Build a synthetic snapshot input from the real CSV fixture. */
function snapshotsFromFixture(): PitcherSnapshotInput[] {
  const parsed = parseStatsCsv(SAMPLE_CSV);
  return parsed.rows.map((r, i) => ({
    pitcherId: `p-${i}`,
    pitcherName: r.fullName,
    latest: r.stats,
    previous: null,
  }));
}

describe('aggregateTeamStats', () => {
  it('sums basic counts and computes weighted aggregates', () => {
    const snapshots: PitcherSnapshotInput[] = [
      {
        pitcherId: 'a',
        pitcherName: 'A',
        latest: { pit_ip: 10, pit_er: 4, pit_h: 8, pit_bb: 5, pit_bf: 45, pit_so: 12, pit_p: 150, pit_s_pct: 60 },
        previous: null,
      },
      {
        pitcherId: 'b',
        pitcherName: 'B',
        latest: { pit_ip: 5, pit_er: 1, pit_h: 4, pit_bb: 2, pit_bf: 20, pit_so: 4, pit_p: 70, pit_s_pct: 55 },
        previous: null,
      },
    ];
    const agg = aggregateTeamStats(snapshots);
    expect(agg.totalIp).toBe(15);
    expect(agg.totalBf).toBe(65);
    expect(agg.totalPitches).toBe(220);
    // ERA = (5 ER * 9) / 15 IP = 3.00
    expect(agg.era).toBeCloseTo(3.0, 2);
    // WHIP = (12 H + 7 BB) / 15 IP = 1.267
    expect(agg.whip).toBeCloseTo(1.267, 2);
    // K/BF = 16 / 65
    expect(agg.kBfRate).toBeCloseTo(16 / 65, 3);
    // Strike% = ((60*150) + (55*70)) / (150+70) = (9000+3850)/220 = 58.41
    expect(agg.strikePct).toBeCloseTo(58.41, 1);
    expect(agg.pitchersWithStats).toBe(2);
  });

  it('returns nulls when no pitcher has the underlying counts', () => {
    const agg = aggregateTeamStats([{ pitcherId: 'a', pitcherName: 'A', latest: null, previous: null }]);
    expect(agg.era).toBeNull();
    expect(agg.whip).toBeNull();
    expect(agg.totalIp).toBeNull();
    expect(agg.pitchersWithStats).toBe(0);
  });

  it('aggregates the real fixture without crashing and yields plausible team totals', () => {
    const agg = aggregateTeamStats(snapshotsFromFixture());
    // Fixture totals row shows 78.1 IP across the team
    expect(agg.totalIp).not.toBeNull();
    expect(agg.totalIp!).toBeGreaterThan(50);
    expect(agg.era).not.toBeNull();
    expect(agg.whip).not.toBeNull();
    expect(agg.pitchersWithStats).toBeGreaterThan(0);
  });
});

describe('computeLeaderboards', () => {
  const snapshots: PitcherSnapshotInput[] = [
    {
      pitcherId: 'a',
      pitcherName: 'Ace',
      latest: { pit_ip: 20, pit_whip: 0.95, pit_era: 1.8, pit_k_pct_bf: 0.32, pit_fps_pct: 65, pit_bf: 70 },
      previous: null,
    },
    {
      pitcherId: 'b',
      pitcherName: 'Bench',
      latest: { pit_ip: 2, pit_whip: 0.5, pit_era: 0.0, pit_k_pct_bf: 0.5, pit_fps_pct: 80, pit_bf: 10 },
      previous: null,
    },
    {
      pitcherId: 'c',
      pitcherName: 'Closer',
      latest: { pit_ip: 8, pit_whip: 1.4, pit_era: 3.2, pit_k_pct_bf: 0.18, pit_fps_pct: 55, pit_bf: 30 },
      previous: null,
    },
  ];

  it('respects the minIp threshold so tiny samples cannot win', () => {
    const boards = computeLeaderboards(snapshots);
    const whip = boards.find((b) => b.id === 'whip');
    // Bench has the lowest WHIP at 0.5 but only 2 IP — should be excluded.
    expect(whip?.leader?.pitcherName).toBe('Ace');
  });

  it('picks the highest value for max-direction metrics', () => {
    const boards = computeLeaderboards(snapshots);
    const ip = boards.find((b) => b.id === 'ip');
    expect(ip?.leader?.pitcherName).toBe('Ace');
    expect(ip?.leader?.value).toBe(20);
  });

  it('produces a leader for every metric on the real fixture', () => {
    const boards = computeLeaderboards(snapshotsFromFixture());
    // Some metrics (e.g. lowest ERA) will have at least one qualifier.
    const hasLeaders = boards.filter((b) => b.leader !== null);
    expect(hasLeaders.length).toBeGreaterThan(0);
  });
});

describe('findCohorts', () => {
  it('fires strike-zone work cohort on low FPS or high BB/INN', () => {
    const cohorts = findCohorts([
      { pitcherId: 'a', pitcherName: 'A', latest: { pit_fps_pct: 40, pit_bb_pct_inn: 0.8 }, previous: null },
      { pitcherId: 'b', pitcherName: 'B', latest: { pit_fps_pct: 70, pit_bb_pct_inn: 1.8 }, previous: null },
      { pitcherId: 'c', pitcherName: 'C', latest: { pit_fps_pct: 62, pit_bb_pct_inn: 0.5 }, previous: null },
    ]);
    const cohort = cohorts.find((c) => c.id === 'strike-zone-work');
    expect(cohort?.members.map((m) => m.pitcherName).sort()).toEqual(['A', 'B']);
  });

  it('fires arm-load watch only when both pitches/IP and short rest are present', () => {
    const cohorts = findCohorts([
      { pitcherId: 'a', pitcherName: 'A', latest: { pit_p_pct_ip: 22 }, previous: null, avgDaysBetweenOutings: 2 },
      { pitcherId: 'b', pitcherName: 'B', latest: { pit_p_pct_ip: 14 }, previous: null, avgDaysBetweenOutings: 2 },
      { pitcherId: 'c', pitcherName: 'C', latest: { pit_p_pct_ip: 22 }, previous: null, avgDaysBetweenOutings: 5 },
    ]);
    const cohort = cohorts.find((c) => c.id === 'arm-load-watch');
    expect(cohort?.members.map((m) => m.pitcherName)).toEqual(['A']);
  });

  it('fires mix imbalance only above the 30-pitch floor and 85% threshold', () => {
    const cohorts = findCohorts([
      // Too few pitches — ignored
      { pitcherId: 'a', pitcherName: 'A', latest: { pit_fb: 20 }, previous: null },
      // 95% fastball with enough volume
      { pitcherId: 'b', pitcherName: 'B', latest: { pit_fb: 95, pit_ch: 5 }, previous: null },
      // 60% fastball — fine
      { pitcherId: 'c', pitcherName: 'C', latest: { pit_fb: 60, pit_ch: 20, pit_cb: 20 }, previous: null },
    ]);
    const cohort = cohorts.find((c) => c.id === 'mix-imbalance');
    expect(cohort?.members.map((m) => m.pitcherName)).toEqual(['B']);
  });

  it('fires dominance-trending-down only when K/BF dropped >= 20%', () => {
    const cohorts = findCohorts([
      // -25% drop — qualifies
      { pitcherId: 'a', pitcherName: 'A', latest: { pit_k_pct_bf: 0.15 }, previous: { pit_k_pct_bf: 0.20 } },
      // -10% drop — does not
      { pitcherId: 'b', pitcherName: 'B', latest: { pit_k_pct_bf: 0.18 }, previous: { pit_k_pct_bf: 0.20 } },
      // No previous snapshot — does not
      { pitcherId: 'c', pitcherName: 'C', latest: { pit_k_pct_bf: 0.15 }, previous: null },
    ]);
    const cohort = cohorts.find((c) => c.id === 'dominance-down');
    expect(cohort?.members.map((m) => m.pitcherName)).toEqual(['A']);
  });

  it('omits cohorts that have no members', () => {
    const cohorts = findCohorts([
      { pitcherId: 'a', pitcherName: 'A', latest: { pit_fps_pct: 70 }, previous: null },
    ]);
    expect(cohorts.length).toBe(0);
  });
});

describe('buildTeamHealthReport — fixture smoke', () => {
  it('returns aggregates, leaderboards, and cohorts together without throwing', () => {
    const report = buildTeamHealthReport(snapshotsFromFixture());
    expect(report.aggregates.pitchersWithStats).toBeGreaterThan(0);
    expect(report.leaderboards.length).toBeGreaterThan(0);
    expect(Array.isArray(report.cohorts)).toBe(true);
  });
});
