import { describe, it, expect } from 'vitest';
import { buildReportCardPromptPayload, type ReportCardInput } from './report-card-llm';

const baseInput: ReportCardInput = {
  playerName: 'Owen Parkinson',
  periodLabel: 'Mid-season 2026',
  playerValue: 62.3,
  playerValueRankInTeam: 5,
  totalPlayers: 13,
  latestStats: {
    bat_ops: 0.879,
    bat_obp: 0.459,
    bat_qab_pct: 37.8,
    pit_era: 5.68,
    pit_whip: 3.63,
  },
  previousStats: {
    bat_ops: 0.820,
    bat_obp: 0.440,
    pit_era: 4.20,
  },
  ratings: {
    effort: 'plus',
    coachability: 'even',
    baseballIq: 'plus',
  },
  topDrivers: [
    { key: 'bat_ops', label: 'OPS', narration: 'producing at the plate', bucket: 'offense', score: 82, weight: 2 },
  ],
  coachContext: 'Owen has been our most vocal leader this year.',
};

describe('buildReportCardPromptPayload', () => {
  it('includes the player name and period in the user prompt', () => {
    const { user } = buildReportCardPromptPayload(baseInput);
    expect(user).toContain('Owen Parkinson');
    expect(user).toContain('Mid-season 2026');
  });

  it('translates coach ratings to plain-English phrasing', () => {
    const { user } = buildReportCardPromptPayload(baseInput);
    expect(user).toContain('Effort: above average');
    expect(user).toContain('Coachability: average');
    expect(user).toContain('Baseball IQ: above average');
  });

  it('says "not rated" for null ratings and does not fabricate one', () => {
    const { user } = buildReportCardPromptPayload({
      ...baseInput,
      ratings: { effort: null, coachability: null, baseballIq: null },
    });
    expect(user).toContain('Effort: not rated');
    expect(user).toContain('Coachability: not rated');
    expect(user).toContain('Baseball IQ: not rated');
  });

  it('formats stats with trend deltas vs previous snapshot', () => {
    const { user } = buildReportCardPromptPayload(baseInput);
    // OPS went up (better)
    expect(user).toMatch(/OPS: 0\.879.*better/);
    // ERA went up (worse for pitchers)
    expect(user).toMatch(/ERA: 5\.68.*worse/);
  });

  it("says 'no stat snapshot uploaded' when latestStats is null", () => {
    const { user } = buildReportCardPromptPayload({ ...baseInput, latestStats: null });
    expect(user).toContain('No stat snapshot uploaded');
  });

  it("includes the coach context verbatim so the model must weave it in", () => {
    const { user } = buildReportCardPromptPayload(baseInput);
    expect(user).toContain('Owen has been our most vocal leader this year.');
  });

  it("marks empty coach context with a '(none provided)' hint", () => {
    const { user } = buildReportCardPromptPayload({ ...baseInput, coachContext: '   ' });
    expect(user).toContain('(none provided');
  });

  it('system prompt tells the model to return JSON with the three sections', () => {
    const { system } = buildReportCardPromptPayload(baseInput);
    expect(system).toContain('"summary"');
    expect(system).toContain('"strengths"');
    expect(system).toContain('"areas"');
    expect(system).toContain('do not invent numbers');
  });
});
