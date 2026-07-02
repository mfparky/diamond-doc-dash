import type { StatValue } from './stat-csv';
import type { PlayerRanking } from './team-rankings';
import type { CoachRating } from '@/hooks/use-pitchers';
import { getStoredApiKey } from './scan-form';

// --- Public shapes ---

export interface ReportCardInput {
  playerName: string;
  periodLabel: string; // "Mid-season 2026 · through Jun 15", coach-friendly
  playerValue?: number | null;
  playerValueRankInTeam?: number | null;
  totalPlayers?: number | null;
  latestStats: Record<string, StatValue> | null;
  previousStats: Record<string, StatValue> | null;
  ratings: {
    effort: CoachRating;
    coachability: CoachRating;
    baseballIq: CoachRating;
  };
  topDrivers?: PlayerRanking['topDrivers'];
  /**
   * Pre-computed core metric bands the coach sees on the report card. Passing
   * these lets the narrative stay consistent with the visual gradient bars
   * (and honor coach ±nudges).
   */
  coreMetrics?: Array<{
    label: string;
    band: string;
    coachAdjusted: boolean;
  }>;
  coachContext: string; // freeform coach input — anecdotes, observations, goals
}

export interface ReportCardDraft {
  summary: string;
  strengths: string;
  areas: string;
}

// --- Prompt builder ---

/**
 * Build a compact, structured payload the LLM can reason over without any
 * hallucination risk. We pre-format numbers so the model doesn't need to
 * do math, and we clip anything null so it doesn't invent stats.
 */
export function buildReportCardPromptPayload(input: ReportCardInput): {
  system: string;
  user: string;
} {
  const stats = summarizeStats(input.latestStats, input.previousStats);
  const ratingPhrase: Record<Exclude<CoachRating, null>, string> = {
    minus: 'below average',
    even: 'average',
    plus: 'above average',
  };
  const ratings = {
    effort: input.ratings.effort ? ratingPhrase[input.ratings.effort] : 'not rated',
    coachability: input.ratings.coachability ? ratingPhrase[input.ratings.coachability] : 'not rated',
    baseballIq: input.ratings.baseballIq ? ratingPhrase[input.ratings.baseballIq] : 'not rated',
  };

  const drivers = (input.topDrivers ?? []).slice(0, 5).map((d) => ({
    label: d.label,
    rank: Math.round(d.score),
    bucket: d.bucket,
  }));

  const bands = (input.coreMetrics ?? []).map((m) => {
    const suffix = m.coachAdjusted ? ' (coach-adjusted)' : '';
    return `- ${m.label}: ${m.band}${suffix}`;
  });

  const system = `You are a supportive youth-baseball coach writing a mid-season report card for a 10-12 year old player and their parents. Rules:
- Be specific, warm, and age-appropriate. Never harsh.
- Ground every stat claim in the data provided — do not invent numbers.
- Prefer strengths first. Frame areas to work on as opportunities, not deficits.
- If a rating or stat is missing, do not mention it or fabricate a value.
- Keep each section to 3-6 sentences.
- The player is called by first name.

Return ONLY valid JSON with the shape:
{ "summary": "…", "strengths": "…", "areas": "…" }`;

  const user = `Here is the data for this report card. Weave it into the narrative but do not repeat it as a table.

PLAYER: ${input.playerName}
PERIOD: ${input.periodLabel}

TEAM CONTEXT: ${
    input.playerValue !== null && input.playerValueRankInTeam !== null && input.totalPlayers !== null
      ? `Ranked #${input.playerValueRankInTeam} of ${input.totalPlayers} on team Player Value (${input.playerValue?.toFixed(1)}/100).`
      : 'Not enough team data to place on the ranking.'
  }

STATS (latest snapshot, with change vs previous snapshot in parentheses when known):
${stats.length > 0 ? stats.map((s) => `- ${s}`).join('\n') : '- No stat snapshot uploaded — narrate from coach context alone.'}

TOP CONTRIBUTORS TO PLAYER VALUE:
${drivers.length > 0 ? drivers.map((d) => `- ${d.label} (${d.bucket}, rank ${d.rank}/100)`).join('\n') : '- No ranking data available.'}

CORE METRIC BANDS (what the coach sees on the report-card gradient bars — align your narrative with these; if a band is marked coach-adjusted, trust the coach over the raw number):
${bands.length > 0 ? bands.join('\n') : '- No metric bands computed for this player.'}

COACH RATINGS:
- Effort: ${ratings.effort}
- Coachability: ${ratings.coachability}
- Baseball IQ: ${ratings.baseballIq}

COACH CONTEXT (what the coach wants you to weave in — respect this over pure stats):
${input.coachContext.trim() || '(none provided — use stats + ratings only)'}

Return the JSON now.`;

  return { system, user };
}

// --- LLM call ---

function endpointUrl(): string {
  const isLocalDev = typeof window !== 'undefined'
    && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  return isLocalDev
    ? `${window.location.origin}/api/anthropic/v1/messages`
    : 'https://zhhqakxjywbipmeyvlum.supabase.co/functions/v1/anthropic-proxy';
}

const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpoaHFha3hqeXdiaXBtZXl2bHVtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg4NDgwMzAsImV4cCI6MjA4NDQyNDAzMH0.XPDfMQf60GuYZgnoBh4XLUD1Hc51XYORXuTMPPeN7Cs';

export class ReportCardLLMError extends Error {}

export async function generateReportCardDraft(input: ReportCardInput): Promise<ReportCardDraft> {
  const apiKey = getStoredApiKey();
  if (!apiKey) {
    throw new ReportCardLLMError('No Anthropic API key configured. Set one from the paper-form scanner to enable AI-drafted report cards.');
  }

  const { system, user } = buildReportCardPromptPayload(input);

  const isLocalDev = typeof window !== 'undefined'
    && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (isLocalDev) {
    headers['x-api-key'] = apiKey;
    headers['anthropic-version'] = '2023-06-01';
  } else {
    headers['apikey'] = SUPABASE_ANON_KEY;
    headers['x-anthropic-key'] = apiKey;
  }

  const response = await fetch(endpointUrl(), {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: 1200,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'unknown error');
    throw new ReportCardLLMError(`Anthropic API returned ${response.status}: ${errorText.slice(0, 240)}`);
  }

  const body = await response.json();
  const text: string = body?.content?.[0]?.text ?? '';
  const draft = extractJsonPayload(text);
  if (!draft) {
    throw new ReportCardLLMError('Model response did not include a JSON payload. Try Generate again.');
  }
  return draft;
}

// --- Helpers ---

/** Format one stat line with an optional trend delta. */
function summarizeStats(
  latest: Record<string, StatValue> | null,
  previous: Record<string, StatValue> | null,
): string[] {
  if (!latest) return [];
  const rows: string[] = [];
  const format = (
    label: string,
    key: string,
    fixed: number,
    higherIsBetter: boolean,
  ): void => {
    const v = num(latest, key);
    if (v === null) return;
    const p = num(previous, key);
    const delta = p !== null ? v - p : null;
    const trend = delta === null
      ? ''
      : delta === 0
        ? ' (unchanged)'
        : ` (${delta > 0 ? '+' : ''}${delta.toFixed(fixed)} vs previous, ${
            (delta > 0) === higherIsBetter ? 'better' : 'worse'
          })`;
    rows.push(`${label}: ${v.toFixed(fixed)}${trend}`);
  };

  // Offense
  format('OPS', 'bat_ops', 3, true);
  format('OBP', 'bat_obp', 3, true);
  format('AVG', 'bat_avg', 3, true);
  format('BA/RISP', 'bat_ba_pct_risp', 3, true);
  format('QAB%', 'bat_qab_pct', 1, true);
  format('BB/K', 'bat_bb_pct_k', 2, true);
  // Pitching
  format('ERA', 'pit_era', 2, false);
  format('WHIP', 'pit_whip', 2, false);
  format('FPS%', 'pit_fps_pct', 1, true);
  format('K/BF', 'pit_k_pct_bf', 3, true);
  format('IP', 'pit_ip', 1, true);
  // Fielding
  format('FPCT', 'field_fpct', 3, true);

  return rows;
}

function num(stats: Record<string, StatValue> | null, key: string): number | null {
  if (!stats) return null;
  const v = stats[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/**
 * Anthropic's text sometimes wraps the JSON in prose or fences. Extract the
 * first top-level JSON object and parse it. Returns null on parse failure.
 */
function extractJsonPayload(text: string): ReportCardDraft | null {
  if (!text) return null;
  // Strip common code-fence wrappers.
  const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  const firstBrace = stripped.indexOf('{');
  const lastBrace = stripped.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) return null;
  const jsonSlice = stripped.slice(firstBrace, lastBrace + 1);
  try {
    const parsed = JSON.parse(jsonSlice) as Partial<ReportCardDraft>;
    if (typeof parsed.summary !== 'string' || typeof parsed.strengths !== 'string' || typeof parsed.areas !== 'string') {
      return null;
    }
    return {
      summary: parsed.summary.trim(),
      strengths: parsed.strengths.trim(),
      areas: parsed.areas.trim(),
    };
  } catch {
    return null;
  }
}
