import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseStatsCsv, matchRowsToRoster } from './stat-csv';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SAMPLE_CSV = readFileSync(join(__dirname, '__fixtures__/sample-stats.csv'), 'utf8');

describe('parseStatsCsv (GameChanger sample)', () => {
  const parsed = parseStatsCsv(SAMPLE_CSV);

  it('parses every player row and excludes Totals + Glossary', () => {
    expect(parsed.rows.length).toBe(13);
    expect(parsed.rows.every((r) => r.number !== 'Totals')).toBe(true);
    expect(parsed.rows.every((r) => r.number !== 'Glossary')).toBe(true);
  });

  it('produces "First Last" full names for matching', () => {
    const names = parsed.rows.map((r) => r.fullName);
    expect(names).toContain('Owen Parkinson');
    expect(names).toContain('Ari Van Pelt');
    // Two-part first name preserved as-is.
    expect(names).toContain('Nicolas Wolfgang Srenk');
  });

  it('namespaces stat keys by section', () => {
    const keys = parsed.statKeys;
    expect(keys.some((k) => k.startsWith('bat_'))).toBe(true);
    expect(keys.some((k) => k.startsWith('pit_'))).toBe(true);
    expect(keys.some((k) => k.startsWith('field_'))).toBe(true);
    // Same source name (GP) appears in batting and pitching — must be distinguished.
    expect(keys).toContain('bat_gp');
    expect(keys).toContain('pit_gp');
  });

  it('coerces numeric cells (including leading-dot decimals) and nulls "N/A" / "-"', () => {
    const owen = parsed.rows.find((r) => r.fullName === 'Owen Parkinson');
    expect(owen).toBeDefined();
    // batting average like ".355" should parse to a number
    expect(typeof owen!.stats.bat_avg).toBe('number');
    expect(owen!.stats.bat_avg).toBeCloseTo(0.355, 3);
    // ERA from the sample
    expect(owen!.stats.pit_era).toBeCloseTo(5.684, 3);
    // velocity by pitch type is "N/A" in the fixture — should be null
    expect(owen!.stats.pit_mphcb).toBeNull();
  });

  it('records jersey number and section-specific volume stats', () => {
    const colin = parsed.rows.find((r) => r.fullName === 'Colin Perry');
    expect(colin?.number).toBe('33');
    // pitching innings pitched
    expect(colin?.stats.pit_ip).toBe(8.0);
    // batting strikeouts
    expect(colin?.stats.bat_so).toBe(9);
  });

  it('returns the canonical stat key list once', () => {
    // No duplicates expected
    const unique = new Set(parsed.statKeys);
    expect(unique.size).toBe(parsed.statKeys.length);
  });

  it('flags an empty CSV', () => {
    expect(() => parseStatsCsv('')).toThrow();
  });

  it('flags a CSV without identity columns', () => {
    expect(() => parseStatsCsv('a,b,c\n1,2,3\n')).toThrow();
  });
});

describe('matchRowsToRoster', () => {
  const parsed = parseStatsCsv(SAMPLE_CSV);

  it('auto-matches exact case-insensitive First Last', () => {
    const roster = [
      { id: 'p1', name: 'Owen Parkinson' },
      { id: 'p2', name: 'colin perry' }, // different case on roster side
      { id: 'p3', name: 'Mason Gomes' },
    ];
    const { matched, unmatched } = matchRowsToRoster(parsed.rows, roster);
    const matchedNames = matched.map((m) => m.fullName);
    expect(matchedNames).toContain('Owen Parkinson');
    expect(matchedNames).toContain('Colin Perry');
    expect(matchedNames).toContain('Mason Gomes');
    expect(matched.find((m) => m.fullName === 'Owen Parkinson')?.pitcherId).toBe('p1');
    // Rows for players not on the trimmed roster fall into unmatched.
    expect(unmatched.length).toBe(parsed.rows.length - 3);
  });

  it('does not match a partial last-name collision', () => {
    const roster = [{ id: 'p1', name: 'Nico Aitchison' }];
    const { matched } = matchRowsToRoster(parsed.rows, roster);
    // The fixture has both "Eli Aitchison" and "Nico Aitchison" — only the
    // exact full-name match should land.
    expect(matched.map((m) => m.fullName)).toEqual(['Nico Aitchison']);
  });
});
