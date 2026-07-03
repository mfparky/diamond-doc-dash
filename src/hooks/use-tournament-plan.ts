import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { TournamentGameSlot } from '@/lib/cooperstown-schedule';

// `tournament_pitch_plans` isn't in the generated Supabase types yet — cast to bypass.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

/**
 * One cell of the pitcher × game grid. `null` means "not yet set" (distinct
 * from 0, which means "0 pitches thrown"). Both `planned` and `actual` are
 * optional so a coach can log actuals for a game without pre-planning it.
 *
 * `dayOverride` handles suspended games that resume the next day (OBA rule:
 * "pitches on resumption count toward the new calendar day"). When set, the
 * eligibility math treats this appearance as happening on the override day
 * instead of the game slot's own dayIndex. `null` or absent = no override.
 */
export interface PitchCell {
  planned: number | null;
  actual: number | null;
  dayOverride?: number | null;
}

/**
 * Entries keyed by `"<pitcherId>:<slotId>"`. Flat lookup so the grid can
 * render O(1) per cell without walking a nested map.
 */
export type PitchEntries = Record<string, PitchCell>;

/**
 * Rotation group for a roster player. 'A' = starters / best arms who lead
 * off the tournament, 'B' = depth arms who slot in on secondary days. null
 * = unassigned. Coach uses this to plan the day-by-day rotation strategy
 * (typically: A on Day 1, B on Day 2, mixed after that).
 */
export type RotationGroup = 'A' | 'B' | null;

/**
 * Per-tournament roster entry. `id` is either a real `pitchers.id` (for main
 * roster players) or a generated `pu_...` id (for pickup players who don't
 * exist in the main pitchers table). `isPickup` tells the UI whether to show
 * the source-pitcher lookup + edit name freely.
 */
export interface TournamentRosterEntry {
  id: string;
  name: string;
  isPickup: boolean;
  group?: RotationGroup;
}

/**
 * Per-day catcher assignments. Key = day index (as string, since JSONB
 * roundtrips objects), value = array of pitcher/roster ids catching that day.
 * The eligibility engine reads this to block a player from pitching on a
 * day they're catching.
 */
export type CatchersByDay = Record<string, string[]>;

export interface TournamentPlanRecord {
  id: string;
  tournamentSlug: string;
  tournamentName: string;
  schedule: TournamentGameSlot[];
  entries: PitchEntries;
  roster: TournamentRosterEntry[];
  catchers: CatchersByDay;
  notes: string;
  updatedAt: string;
}

interface UseTournamentPlanResult {
  plan: TournamentPlanRecord | null;
  isLoading: boolean;
  save: (patch: Partial<Pick<TournamentPlanRecord, 'schedule' | 'entries' | 'roster' | 'catchers' | 'notes'>>) => Promise<boolean>;
  refetch: () => Promise<void>;
}

export function entryKey(pitcherId: string, slotId: string): string {
  return `${pitcherId}:${slotId}`;
}

/** Defensive normalization for values coming out of JSONB storage. */
function normalizeEntries(raw: unknown): PitchEntries {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: PitchEntries = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!v || typeof v !== 'object' || Array.isArray(v)) continue;
    const cell = v as { planned?: unknown; actual?: unknown };
    const planned = typeof cell.planned === 'number' && Number.isFinite(cell.planned) ? Math.max(0, Math.trunc(cell.planned)) : null;
    const actual = typeof cell.actual === 'number' && Number.isFinite(cell.actual) ? Math.max(0, Math.trunc(cell.actual)) : null;
    const rawOverride = (cell as { dayOverride?: unknown }).dayOverride;
    const dayOverride = typeof rawOverride === 'number' && Number.isFinite(rawOverride) ? Math.max(0, Math.trunc(rawOverride)) : null;
    if (planned !== null || actual !== null || dayOverride !== null) {
      out[k] = { planned, actual, dayOverride };
    }
  }
  return out;
}

function normalizeRoster(raw: unknown): TournamentRosterEntry[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: TournamentRosterEntry[] = [];
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue;
    const entry = r as Record<string, unknown>;
    if (typeof entry.id !== 'string' || typeof entry.name !== 'string') continue;
    if (seen.has(entry.id)) continue;
    seen.add(entry.id);
    const group = entry.group === 'A' || entry.group === 'B' ? entry.group : null;
    out.push({
      id: entry.id,
      name: entry.name,
      isPickup: entry.isPickup === true,
      group,
    });
  }
  return out;
}

function normalizeCatchers(raw: unknown): CatchersByDay {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: CatchersByDay = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!Array.isArray(v)) continue;
    // Keys arrive as strings from JSONB; day-index as string is fine.
    if (!/^\d+$/.test(k)) continue;
    const ids = v.filter((x): x is string => typeof x === 'string');
    if (ids.length > 0) out[k] = Array.from(new Set(ids));
  }
  return out;
}

function normalizeSchedule(raw: unknown): TournamentGameSlot[] {
  if (!Array.isArray(raw)) return [];
  const out: TournamentGameSlot[] = [];
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue;
    const s = r as Record<string, unknown>;
    if (typeof s.id !== 'string' || typeof s.dayIndex !== 'number' || typeof s.gameIndex !== 'number') continue;
    const target = s.targetGroup;
    out.push({
      id: s.id,
      dayIndex: s.dayIndex,
      gameIndex: s.gameIndex,
      date: typeof s.date === 'string' ? s.date : '',
      time: typeof s.time === 'string' ? s.time : '',
      code: typeof s.code === 'string' ? s.code : '',
      opponent: typeof s.opponent === 'string' ? s.opponent : '',
      targetGroup: target === 'A' || target === 'B' ? target : null,
    });
  }
  return out;
}

export function useTournamentPlan(
  tournamentSlug: string,
  tournamentName: string,
  defaultSchedule: TournamentGameSlot[],
): UseTournamentPlanResult {
  const [plan, setPlan] = useState<TournamentPlanRecord | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const fetchPlan = useCallback(async () => {
    if (!tournamentSlug) return;
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setPlan(null);
        return;
      }
      // Use * so a plan can still load when a newly-added JSONB column
      // hasn't had its migration run yet in Supabase. Missing fields
      // are filled by the normalize* helpers below.
      const { data, error } = await db
        .from('tournament_pitch_plans')
        .select('*')
        .eq('user_id', user.id)
        .eq('tournament_slug', tournamentSlug)
        .maybeSingle();
      if (error) throw error;
      if (data) {
        const savedSchedule = normalizeSchedule(data.schedule);
        setPlan({
          id: data.id,
          tournamentSlug: data.tournament_slug,
          tournamentName: data.tournament_name,
          schedule: savedSchedule.length > 0 ? savedSchedule : defaultSchedule,
          entries: normalizeEntries(data.entries),
          roster: normalizeRoster(data.roster),
          catchers: normalizeCatchers(data.catchers),
          notes: data.notes ?? '',
          updatedAt: data.updated_at,
        });
      } else {
        setPlan(null);
      }
    } catch (e) {
      console.error('Error loading tournament plan:', e);
      toast({
        title: 'Could not load tournament plan',
        description: 'Refresh or start a new plan.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [tournamentSlug, defaultSchedule, toast]);

  const save = useCallback(
    async (patch: Partial<Pick<TournamentPlanRecord, 'schedule' | 'entries' | 'roster' | 'catchers' | 'notes'>>) => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          toast({ title: 'Sign in required', variant: 'destructive' });
          return false;
        }
        const nextSchedule = patch.schedule ?? plan?.schedule ?? defaultSchedule;
        const nextEntries = normalizeEntries(patch.entries ?? plan?.entries ?? {});
        const nextRoster = normalizeRoster(patch.roster ?? plan?.roster ?? []);
        const nextCatchers = normalizeCatchers(patch.catchers ?? plan?.catchers ?? {});
        // Build the row with every optional column, then drop any column the
        // DB rejects with "column does not exist" (migration not run yet).
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const fullRow: Record<string, any> = {
          user_id: user.id,
          tournament_slug: tournamentSlug,
          tournament_name: tournamentName,
          schedule: nextSchedule,
          entries: nextEntries,
          roster: nextRoster,
          catchers: nextCatchers,
          notes: patch.notes ?? plan?.notes ?? '',
        };
        let error = (await db
          .from('tournament_pitch_plans')
          .upsert(fullRow, { onConflict: 'user_id,tournament_slug' })).error;
        for (const optional of ['catchers', 'roster']) {
          if (!error) break;
          const msg = String(error.message ?? '').toLowerCase();
          if (!msg.includes(optional) || !(msg.includes('does not exist') || msg.includes('could not find'))) break;
          console.warn(`tournament_pitch_plans.${optional} column missing — retrying save without it. Run the pending migration.`);
          delete fullRow[optional];
          error = (await db
            .from('tournament_pitch_plans')
            .upsert(fullRow, { onConflict: 'user_id,tournament_slug' })).error;
        }
        if (error) throw error;
        await fetchPlan();
        return true;
      } catch (e) {
        console.error('Error saving tournament plan:', e);
        toast({
          title: 'Could not save tournament plan',
          description: 'Try again.',
          variant: 'destructive',
        });
        return false;
      }
    },
    [tournamentSlug, tournamentName, defaultSchedule, plan, fetchPlan, toast],
  );

  useEffect(() => {
    fetchPlan();
  }, [fetchPlan]);

  return { plan, isLoading, save, refetch: fetchPlan };
}
