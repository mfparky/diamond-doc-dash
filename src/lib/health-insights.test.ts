import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { generateInsights, type TrackerContext } from './health-insights';
import { parseStatsCsv } from './stat-csv';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SAMPLE_CSV = readFileSync(join(__dirname, '__fixtures__/sample-stats.csv'), 'utf8');

const emptyCtx: TrackerContext = {
  avgPitchesPerOuting: null,
  avgDaysBetweenOutings: null,
  recentOutingCount: 0,
};

describe('generateInsights — rules', () => {
  it('flags strong ERA as a positive', () => {
    const insights = generateInsights({ pit_era: 2.5 }, null, emptyCtx);
    expect(insights.some((i) => i.kind === 'good' && /ERA/i.test(i.message))).toBe(true);
  });

  it('flags poor ERA as attention', () => {
    const insights = generateInsights({ pit_era: 7.2 }, null, emptyCtx);
    expect(insights.some((i) => i.kind === 'attention' && /ERA/i.test(i.message))).toBe(true);
  });

  it('flags rising WHIP between snapshots', () => {
    const insights = generateInsights({ pit_whip: 1.9 }, { pit_whip: 1.4 }, emptyCtx);
    expect(insights.some((i) => i.kind === 'attention' && /WHIP/.test(i.message))).toBe(true);
  });

  it('flags long at-bats as a heads-up', () => {
    const insights = generateInsights({ pit_p_pct_bf: 4.8 }, null, emptyCtx);
    expect(insights.some((i) => i.kind === 'heads-up' && /pitches per batter/.test(i.message))).toBe(true);
  });

  it('flags low days-rest from tracker context', () => {
    const ctx: TrackerContext = { ...emptyCtx, avgDaysBetweenOutings: 2.1, recentOutingCount: 4 };
    const insights = generateInsights({}, null, ctx);
    expect(insights.some((i) => i.kind === 'heads-up' && /Pitch Smart/.test(i.message))).toBe(true);
  });

  it('flags a fastball-heavy mix above 85%', () => {
    const stats = { pit_fb: 90, pit_ct: 0, pit_cb: 4, pit_sl: 0, pit_ch: 6, pit_os: 0 };
    const insights = generateInsights(stats, null, emptyCtx);
    expect(insights.some((i) => i.kind === 'attention' && /Fastball/.test(i.message))).toBe(true);
  });

  it('flags strong first-pitch-strike rate as good', () => {
    const insights = generateInsights({ pit_fps_pct: 62 }, null, emptyCtx);
    expect(insights.some((i) => i.kind === 'good' && /First-pitch/.test(i.message))).toBe(true);
  });

  it('flags poor first-pitch-strike rate as attention', () => {
    const insights = generateInsights({ pit_fps_pct: 40 }, null, emptyCtx);
    expect(insights.some((i) => i.kind === 'attention' && /First-pitch/.test(i.message))).toBe(true);
  });

  it('sorts insights heads-up first, good last', () => {
    const stats = {
      pit_era: 2.5, // good
      pit_p_pct_bf: 5.0, // heads-up
      pit_fps_pct: 40, // attention
    };
    const insights = generateInsights(stats, null, emptyCtx);
    const kinds = insights.map((i) => i.kind);
    // First heads-up, then attention, then good — internal ties are stable
    expect(kinds.indexOf('heads-up')).toBeLessThan(kinds.indexOf('attention'));
    expect(kinds.indexOf('attention')).toBeLessThan(kinds.indexOf('good'));
  });

  it('returns nothing for an empty stat record', () => {
    expect(generateInsights({}, null, emptyCtx)).toEqual([]);
  });
});

describe('generateInsights — end-to-end with sample CSV', () => {
  const parsed = parseStatsCsv(SAMPLE_CSV);

  it('uses keys that match the parser output (no silent miss)', () => {
    // Owen's row has known values for several metrics — make sure at least
    // one rule fires when we feed real parsed stats in.
    const owen = parsed.rows.find((r) => r.fullName === 'Owen Parkinson');
    expect(owen).toBeDefined();
    const insights = generateInsights(owen!.stats, null, emptyCtx);
    expect(insights.length).toBeGreaterThan(0);
  });
});
