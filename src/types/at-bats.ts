export const AB_OUTCOMES = [
  'K', 'K-L', 'BB', 'HBP',
  '1B', '2B', '3B', 'HR',
  'GO', 'FO', 'LO', 'FC', 'E',
] as const;

export type AbOutcome = typeof AB_OUTCOMES[number];

export const AB_OUTCOME_LABELS: Record<AbOutcome, string> = {
  'K':   'Strikeout (swing)',
  'K-L': 'Strikeout (look)',
  'BB':  'Walk',
  'HBP': 'Hit by pitch',
  '1B':  'Single',
  '2B':  'Double',
  '3B':  'Triple',
  'HR':  'Home run',
  'GO':  'Ground out',
  'FO':  'Fly out',
  'LO':  'Line out',
  'FC':  'Fielder\'s choice',
  'E':   'Error',
};

// Color classes / hsl values per outcome category
export const AB_OUTCOME_COLOR: Record<AbOutcome, string> = {
  'K':   'hsl(0, 70%, 55%)',
  'K-L': 'hsl(0, 70%, 55%)',
  'BB':  'hsl(220, 70%, 55%)',
  'HBP': 'hsl(280, 70%, 55%)',
  '1B':  'hsl(142, 70%, 45%)',
  '2B':  'hsl(142, 75%, 40%)',
  '3B':  'hsl(142, 80%, 35%)',
  'HR':  'hsl(48, 96%, 50%)',
  'GO':  'hsl(25, 90%, 55%)',
  'FO':  'hsl(200, 70%, 55%)',
  'LO':  'hsl(170, 70%, 45%)',
  'FC':  'hsl(60, 70%, 45%)',
  'E':   'hsl(40, 90%, 50%)',
};

export interface AtBat {
  ab: number;
  outcome: AbOutcome | null;
  /** Last globally-sequential pitch number of this at-bat (inclusive) */
  endPitch: number;
}

export interface LiveAbsData {
  /** Free-text notes from the session */
  text?: string;
  atBats: AtBat[];
}

export function parseLiveAbsData(notes: string | undefined | null): LiveAbsData | null {
  if (!notes) return null;
  try {
    const parsed = JSON.parse(notes);
    if (parsed && Array.isArray(parsed.atBats)) return parsed as LiveAbsData;
  } catch { /* not JSON */ }
  return null;
}

export function encodeLiveAbsData(data: LiveAbsData): string {
  return JSON.stringify(data);
}

/** Return the global pitch-number range [start, end] for a given at-bat */
export function abPitchRange(atBats: AtBat[], abIndex: number): [number, number] {
  const start = abIndex === 0 ? 1 : atBats[abIndex - 1].endPitch + 1;
  const end = atBats[abIndex].endPitch;
  return [start, end];
}
