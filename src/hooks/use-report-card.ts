import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { clampAdjustment, type CoreMetricSnapshotEntry, type MetricBand } from '@/lib/report-card-metrics';

const VALID_BANDS: readonly MetricBand[] = ['needs-work', 'developing', 'on-target', 'strong', 'excelling'];

// `report_cards` isn't in the generated Supabase types yet — cast to bypass.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export interface ReportCardRecord {
  id: string;
  pitcherId: string;
  periodStart: string;
  periodEnd: string;
  coachContext: string;
  summary: string;
  strengths: string;
  areas: string;
  snapshotId: string | null;
  /** Coach ±nudges keyed by metric key. Missing keys mean no override. */
  metricAdjustments: Record<string, number>;
  /** Position(s) of focus shown under the metrics in the printout. */
  positionPrimary: string | null;
  positionSupport1: string | null;
  positionSupport2: string | null;
  /** Coach's note on what to work on for fall tryouts. Printed under a fixed preamble. */
  tryoutFocus: string;
  /** When true, this card is readable on the player's public dashboard. */
  published: boolean;
  publishedAt: string | null;
  updatedAt: string;
  /** Point-in-time label+band snapshot, captured at save time — powers the
   *  written metrics overview on the public dashboard without exposing
   *  team-wide comparative data there. Empty until a coach with computed
   *  metrics available saves. */
  coreMetricsSnapshot: CoreMetricSnapshotEntry[];
}

type ReportCardPatch = Partial<Pick<ReportCardRecord,
  'coachContext' | 'summary' | 'strengths' | 'areas' | 'snapshotId' | 'metricAdjustments'
  | 'positionPrimary' | 'positionSupport1' | 'positionSupport2' | 'tryoutFocus' | 'published'
  | 'coreMetricsSnapshot'>>;

interface UseReportCardResult {
  card: ReportCardRecord | null;
  isLoading: boolean;
  save: (patch: ReportCardPatch) => Promise<boolean>;
  refetch: () => Promise<void>;
}

/**
 * Parse whatever came out of the JSONB column into a clean adjustments map.
 * Everything is defensively clamped so a hand-edited row can't blow up the UI.
 */
function normalizeAdjustments(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v !== 'number') continue;
    const clamped = clampAdjustment(v);
    if (clamped !== 0) out[k] = clamped;
  }
  return out;
}

/**
 * Defensively parse the JSONB metrics snapshot — drops anything not shaped
 * like a real entry so a hand-edited row can't blow up the UI. Exported so
 * any other reader of this column (e.g. the public PlayerDashboard) parses
 * it the same defensive way instead of trusting the JSONB shape directly.
 */
export function normalizeMetricsSnapshot(raw: unknown): CoreMetricSnapshotEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: CoreMetricSnapshotEntry[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const { label, band } = entry as Record<string, unknown>;
    if (typeof label !== 'string' || !label) continue;
    if (typeof band !== 'string' || !VALID_BANDS.includes(band as MetricBand)) continue;
    out.push({ label, band: band as MetricBand });
  }
  return out;
}

const REPORT_CARD_COLUMNS =
  'id, pitcher_id, period_start, period_end, coach_context, narrative_summary, narrative_strengths, narrative_areas, snapshot_id, metric_adjustments, position_primary, position_support_1, position_support_2, tryout_focus, published, published_at, updated_at, core_metrics_snapshot';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapReportCardRow(data: any): ReportCardRecord {
  return {
    id: data.id,
    pitcherId: data.pitcher_id,
    periodStart: data.period_start,
    periodEnd: data.period_end,
    coachContext: data.coach_context ?? '',
    summary: data.narrative_summary ?? '',
    strengths: data.narrative_strengths ?? '',
    areas: data.narrative_areas ?? '',
    snapshotId: data.snapshot_id,
    metricAdjustments: normalizeAdjustments(data.metric_adjustments),
    positionPrimary: data.position_primary ?? null,
    positionSupport1: data.position_support_1 ?? null,
    positionSupport2: data.position_support_2 ?? null,
    tryoutFocus: data.tryout_focus ?? '',
    published: data.published ?? false,
    publishedAt: data.published_at ?? null,
    updatedAt: data.updated_at,
    coreMetricsSnapshot: normalizeMetricsSnapshot(data.core_metrics_snapshot),
  };
}

/**
 * Coach-owned report card keyed by (pitcher_id, period_start). Upserts on save
 * so the coach can iterate through drafts + edits without creating dupes.
 */
export function useReportCard(pitcherId: string | undefined, periodStart: string, periodEnd: string): UseReportCardResult {
  const [card, setCard] = useState<ReportCardRecord | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Tracks which pitcher we've already tried the "fall back to latest card"
  // resolution for, so it only fires once per player pick — not on every
  // manual edit to the period fields. Without that guard, deliberately
  // typing a new period to start a fresh card for an already-reviewed
  // player would immediately snap back to the old one.
  const fallbackResolvedForRef = useRef<string | null>(null);

  const fetchCard = useCallback(async () => {
    if (!pitcherId || !periodStart || !periodEnd) {
      // No player picked yet — clear any previous player's card so the UI
      // doesn't hydrate stale text into the new player's form.
      setCard(null);
      return;
    }
    // Clear stale card the moment the coach switches players. Prevents the
    // previous player's summary/strengths/areas from persisting into the new
    // player's form during the fetch window (which is what caused edits to
    // save under the wrong pitcher_id).
    setCard(null);
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setCard(null);
        return;
      }
      const { data: exact, error: exactError } = await db
        .from('report_cards')
        .select(REPORT_CARD_COLUMNS)
        .eq('user_id', user.id)
        .eq('pitcher_id', pitcherId)
        .eq('period_start', periodStart)
        .maybeSingle();
      if (exactError) throw exactError;

      if (exact) {
        fallbackResolvedForRef.current = pitcherId;
        setCard(mapReportCardRow(exact));
        return;
      }

      // No card for this exact period. The default period shown is "60
      // days before today," a value that shifts daily — so a card saved
      // under any other date range silently fails to match and the editor
      // looks blank even though the card exists. The first time we look at
      // a given player, fall back to their most recently saved card of any
      // period (mirrors the "print all" view, which never had this bug
      // since it never filtered by exact period to begin with).
      if (fallbackResolvedForRef.current !== pitcherId) {
        fallbackResolvedForRef.current = pitcherId;
        const { data: latest, error: latestError } = await db
          .from('report_cards')
          .select(REPORT_CARD_COLUMNS)
          .eq('user_id', user.id)
          .eq('pitcher_id', pitcherId)
          .order('updated_at', { ascending: false })
          .limit(1);
        if (latestError) throw latestError;
        if (latest && latest.length > 0) {
          setCard(mapReportCardRow(latest[0]));
          return;
        }
      }

      setCard(null);
    } catch (e) {
      console.error('Error loading report card:', e);
      toast({
        title: 'Could not load report card',
        description: 'Refresh or start a new draft.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [pitcherId, periodStart, periodEnd, toast]);

  const save = useCallback(
    async (patch: ReportCardPatch) => {
      if (!pitcherId) return false;
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          toast({ title: 'Sign in required', variant: 'destructive' });
          return false;
        }
        const nextAdjustments = normalizeAdjustments(
          patch.metricAdjustments ?? card?.metricAdjustments ?? {},
        );
        const nextPublished = patch.published ?? card?.published ?? false;
        // Re-stamp published_at on every save while published so "last shown to
        // parents" tracks edits, not just the first publish; clear it on unpublish.
        const nextPublishedAt = nextPublished ? new Date().toISOString() : null;
        const { error } = await db
          .from('report_cards')
          .upsert(
            {
              user_id: user.id,
              pitcher_id: pitcherId,
              period_start: periodStart,
              period_end: periodEnd,
              coach_context: patch.coachContext ?? card?.coachContext ?? '',
              narrative_summary: patch.summary ?? card?.summary ?? '',
              narrative_strengths: patch.strengths ?? card?.strengths ?? '',
              narrative_areas: patch.areas ?? card?.areas ?? '',
              tryout_focus: patch.tryoutFocus ?? card?.tryoutFocus ?? '',
              snapshot_id: patch.snapshotId ?? card?.snapshotId ?? null,
              metric_adjustments: nextAdjustments,
              // These three are explicitly nullable (a coach clearing a position
              // pick sends null on purpose), so "in patch" distinguishes that
              // from "key omitted" — a plain ?? would wrongly keep the old value.
              position_primary: 'positionPrimary' in patch ? patch.positionPrimary : card?.positionPrimary ?? null,
              position_support_1: 'positionSupport1' in patch ? patch.positionSupport1 : card?.positionSupport1 ?? null,
              position_support_2: 'positionSupport2' in patch ? patch.positionSupport2 : card?.positionSupport2 ?? null,
              published: nextPublished,
              published_at: nextPublishedAt,
              core_metrics_snapshot: patch.coreMetricsSnapshot ?? card?.coreMetricsSnapshot ?? [],
            },
            { onConflict: 'user_id,pitcher_id,period_start' },
          );
        if (error) throw error;
        await fetchCard();
        return true;
      } catch (e) {
        console.error('Error saving report card:', e);
        toast({
          title: 'Could not save report card',
          description: 'Try again.',
          variant: 'destructive',
        });
        return false;
      }
    },
    [pitcherId, periodStart, periodEnd, card, fetchCard, toast],
  );

  useEffect(() => {
    fetchCard();
  }, [fetchCard]);

  return { card, isLoading, save, refetch: fetchCard };
}

interface UseLatestReportCardsResult {
  /** Each pitcher's single most-recently-updated saved card, if any. */
  cardsByPitcher: Map<string, ReportCardRecord>;
  isLoading: boolean;
}

/**
 * Bulk fetch for the "print all" review — one round-trip, then keep only
 * the newest saved card per pitcher (a pitcher can have several across
 * different review periods). Pitchers with no saved card are simply absent
 * from the map rather than surfaced as an error.
 */
export function useLatestReportCards(pitcherIds: string[]): UseLatestReportCardsResult {
  const [cardsByPitcher, setCardsByPitcher] = useState<Map<string, ReportCardRecord>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Stable key so the effect doesn't churn on every render of a new array
  // reference holding the same ids.
  const key = pitcherIds.slice().sort().join(',');

  const fetchCards = useCallback(async () => {
    if (pitcherIds.length === 0) {
      setCardsByPitcher(new Map());
      return;
    }
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setCardsByPitcher(new Map());
        return;
      }
      const { data, error } = await db
        .from('report_cards')
        .select(REPORT_CARD_COLUMNS)
        .eq('user_id', user.id)
        .in('pitcher_id', pitcherIds)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      const latest = new Map<string, ReportCardRecord>();
      for (const row of data ?? []) {
        // Sorted newest-first, so the first row seen per pitcher is the latest.
        if (!latest.has(row.pitcher_id)) latest.set(row.pitcher_id, mapReportCardRow(row));
      }
      setCardsByPitcher(latest);
    } catch (e) {
      console.error('Error loading report cards:', e);
      toast({
        title: 'Could not load report cards',
        description: 'Refresh and try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, toast]);

  useEffect(() => {
    fetchCards();
  }, [fetchCards]);

  return { cardsByPitcher, isLoading };
}
