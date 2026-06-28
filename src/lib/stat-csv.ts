import Papa from 'papaparse';

// GameChanger-style season-stat CSVs have a quirky layout:
//   row 1: section banners ("Batting" / "Pitching" / "Fielding") spread across columns
//   row 2: column names — duplicated across sections (GP, H, BB, etc.)
//   rows 3..N-3: one row per player (Number, Last, First, then stats)
//   row N-2: "Totals" row
//   row N-1: blank
//   row N: "Glossary" row explaining every column
//
// We normalize all of that into a shape the rest of the app can use.

export type StatValue = number | string | null;

export interface ParsedStatRow {
  /** Jersey number as a string (some leagues use letters). */
  number: string;
  firstName: string;
  lastName: string;
  /** "First Last" — what we'll match against pitchers.name. */
  fullName: string;
  /** Section-namespaced stats: bat_avg, pit_era, field_fpct, etc. */
  stats: Record<string, StatValue>;
}

export interface ParseStatsResult {
  rows: ParsedStatRow[];
  /** Stat keys we found across all rows, in canonical order. */
  statKeys: string[];
  /** Headers that couldn't be classified, surfaced so we don't lose data silently. */
  unclassifiedHeaders: string[];
}

const SECTION_PREFIXES: Record<string, string> = {
  Batting: 'bat_',
  Pitching: 'pit_',
  Fielding: 'field_',
};

const IDENTITY_HEADERS = new Set(['Number', 'Last', 'First']);
const NULLISH_CELLS = new Set(['', '-', 'N/A', 'NA', 'null']);

function snakeCase(header: string): string {
  return header
    .replace(/[%/]+/g, '_pct_')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .toLowerCase();
}

function classifyHeaders(
  sectionRow: string[],
  headerRow: string[],
): { keys: (string | null)[]; unclassified: string[] } {
  // Sections come from row 1 — they tag the first column of their section
  // and the rest of the section's columns are implied empty cells until the
  // next non-empty cell. We forward-fill to know which prefix each col uses.
  const sections: string[] = [];
  let currentSection = '';
  for (const cell of sectionRow) {
    if (cell && cell.trim() !== '') {
      currentSection = cell.trim();
    }
    sections.push(currentSection);
  }

  const keys: (string | null)[] = [];
  const unclassified: string[] = [];

  for (let i = 0; i < headerRow.length; i += 1) {
    const header = (headerRow[i] ?? '').trim();
    if (!header) {
      keys.push(null);
      continue;
    }
    if (IDENTITY_HEADERS.has(header)) {
      keys.push(header.toLowerCase());
      continue;
    }
    const section = sections[i] ?? '';
    const prefix = SECTION_PREFIXES[section];
    if (!prefix) {
      unclassified.push(`col ${i}: ${header}`);
      keys.push(null);
      continue;
    }
    keys.push(`${prefix}${snakeCase(header)}`);
  }

  return { keys, unclassified };
}

function coerceCell(raw: string): StatValue {
  const value = raw?.trim() ?? '';
  if (NULLISH_CELLS.has(value)) return null;
  // Leading-dot decimals (".345") are common in baseball stats — parseFloat handles those.
  // Reject pure-text values like "N/A" before this point.
  const numeric = Number(value);
  if (!Number.isNaN(numeric) && value !== '') return numeric;
  return value;
}

/**
 * Parses a GameChanger-style season-stat CSV string.
 * Throws if the CSV doesn't look like a stat export (no section row / header row).
 */
export function parseStatsCsv(csv: string): ParseStatsResult {
  const parsed = Papa.parse<string[]>(csv, {
    skipEmptyLines: false,
  });
  const rows = parsed.data;
  if (rows.length < 3) {
    throw new Error('CSV is too short to be a season-stat export.');
  }

  const sectionRow = rows[0] ?? [];
  const headerRow = rows[1] ?? [];
  if (!headerRow.some((cell) => IDENTITY_HEADERS.has((cell ?? '').trim()))) {
    throw new Error('CSV header row is missing identity columns (Number / Last / First).');
  }

  const { keys, unclassified } = classifyHeaders(sectionRow, headerRow);

  const statKeys: string[] = [];
  for (const key of keys) {
    if (key && !IDENTITY_HEADERS.has(key) && key !== 'number' && key !== 'last' && key !== 'first') {
      if (!statKeys.includes(key)) statKeys.push(key);
    }
  }

  const result: ParsedStatRow[] = [];

  // Iterate body rows; skip totals/blank/glossary.
  for (let r = 2; r < rows.length; r += 1) {
    const row = rows[r];
    if (!row || row.every((cell) => !cell || cell.trim() === '')) continue;

    const numberCell = (row[0] ?? '').trim();
    const lastCell = (row[1] ?? '').trim();
    const firstCell = (row[2] ?? '').trim();
    if (!numberCell) continue;
    if (numberCell.toLowerCase() === 'totals') continue;
    if (numberCell.toLowerCase() === 'glossary') continue;
    if (!lastCell && !firstCell) continue;

    const stats: Record<string, StatValue> = {};
    for (let c = 3; c < row.length; c += 1) {
      const key = keys[c];
      if (!key) continue;
      stats[key] = coerceCell(row[c] ?? '');
    }

    result.push({
      number: numberCell,
      lastName: lastCell,
      firstName: firstCell,
      fullName: `${firstCell} ${lastCell}`.trim(),
      stats,
    });
  }

  return { rows: result, statKeys, unclassifiedHeaders: unclassified };
}

/**
 * Best-effort match of parsed rows to a pitcher roster by name.
 * Returns auto-matched pairs and the rows that need a manual decision.
 */
export interface NameMatchInput {
  id: string;
  name: string;
}

export interface MatchedStatRow extends ParsedStatRow {
  pitcherId: string;
}

export interface MatchStatsResult {
  matched: MatchedStatRow[];
  unmatched: ParsedStatRow[];
}

export function matchRowsToRoster(
  rows: ParsedStatRow[],
  roster: NameMatchInput[],
): MatchStatsResult {
  const byNormalized = new Map<string, string>();
  for (const p of roster) {
    byNormalized.set(p.name.trim().toLowerCase(), p.id);
  }

  const matched: MatchedStatRow[] = [];
  const unmatched: ParsedStatRow[] = [];

  for (const row of rows) {
    const key = row.fullName.toLowerCase();
    const id = byNormalized.get(key);
    if (id) {
      matched.push({ ...row, pitcherId: id });
    } else {
      unmatched.push(row);
    }
  }

  return { matched, unmatched };
}
