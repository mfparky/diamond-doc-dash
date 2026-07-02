import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  COOPERSTOWN_2025,
  COOPERSTOWN_TOURNAMENT_NAME,
  COOPERSTOWN_TOURNAMENT_SLUG,
  type TournamentGameSlot,
} from '@/lib/cooperstown-schedule';
import type { TournamentRosterEntry } from './use-tournament-plan';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export interface TournamentSummary {
  slug: string;
  name: string;
  updatedAt: string;
}

interface UseTournamentPlansResult {
  summaries: TournamentSummary[];
  isLoading: boolean;
  refetch: () => Promise<void>;
  createPlan: (
    slug: string,
    name: string,
    schedule: TournamentGameSlot[],
    roster?: TournamentRosterEntry[],
  ) => Promise<boolean>;
  deletePlan: (slug: string) => Promise<boolean>;
}

/** Kebab-case + strip anything that isn't a-z0-9 or a dash. */
export function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64);
}

/**
 * Lists every tournament plan the coach owns, plus create/delete helpers.
 * The Cooperstown seed row is inserted on first load if the coach has no
 * plans at all — so a brand-new user still lands on a usable planner.
 */
export function useTournamentPlans(): UseTournamentPlansResult {
  const [summaries, setSummaries] = useState<TournamentSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const fetchSummaries = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setSummaries([]);
        return;
      }
      const { data, error } = await db
        .from('tournament_pitch_plans')
        .select('tournament_slug, tournament_name, updated_at')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });
      if (error) throw error;

      const rows = (data ?? []) as Array<{
        tournament_slug: string;
        tournament_name: string;
        updated_at: string;
      }>;

      // Seed Cooperstown on first run so the picker isn't empty.
      if (rows.length === 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const fullSeed: Record<string, any> = {
          user_id: user.id,
          tournament_slug: COOPERSTOWN_TOURNAMENT_SLUG,
          tournament_name: COOPERSTOWN_TOURNAMENT_NAME,
          schedule: COOPERSTOWN_2025,
          entries: {},
          roster: [],
          notes: '',
        };
        let insertErr = (await db.from('tournament_pitch_plans').insert(fullSeed)).error;
        // Retry without newer optional columns if their migrations haven't run.
        for (const optional of ['catchers', 'roster']) {
          if (!insertErr) break;
          const msg = String(insertErr.message ?? '').toLowerCase();
          if (!msg.includes(optional) || !(msg.includes('does not exist') || msg.includes('could not find'))) break;
          delete fullSeed[optional];
          insertErr = (await db.from('tournament_pitch_plans').insert(fullSeed)).error;
        }
        if (insertErr) {
          // A duplicate-key race is fine; refetch below either way.
          if (!/duplicate|unique/i.test(insertErr.message ?? '')) throw insertErr;
        }
        const { data: reseed, error: reseedErr } = await db
          .from('tournament_pitch_plans')
          .select('tournament_slug, tournament_name, updated_at')
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false });
        if (reseedErr) throw reseedErr;
        setSummaries((reseed ?? []).map((r: typeof rows[number]) => ({
          slug: r.tournament_slug,
          name: r.tournament_name,
          updatedAt: r.updated_at,
        })));
      } else {
        setSummaries(rows.map((r) => ({
          slug: r.tournament_slug,
          name: r.tournament_name,
          updatedAt: r.updated_at,
        })));
      }
    } catch (e) {
      console.error('Error loading tournament plans:', e);
      toast({
        title: 'Could not load tournaments',
        description: 'Refresh to try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const createPlan = useCallback(
    async (slug: string, name: string, schedule: TournamentGameSlot[], roster: TournamentRosterEntry[] = []) => {
      const cleanSlug = slugify(slug);
      if (!cleanSlug || !name.trim()) {
        toast({ title: 'Name and slug required', variant: 'destructive' });
        return false;
      }
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          toast({ title: 'Sign in required', variant: 'destructive' });
          return false;
        }
        const { error } = await db
          .from('tournament_pitch_plans')
          .insert({
            user_id: user.id,
            tournament_slug: cleanSlug,
            tournament_name: name.trim(),
            schedule,
            entries: {},
            roster,
            notes: '',
          });
        if (error) {
          if (/duplicate|unique/i.test(error.message ?? '')) {
            toast({
              title: 'Tournament already exists',
              description: 'Pick a different name.',
              variant: 'destructive',
            });
            return false;
          }
          throw error;
        }
        await fetchSummaries();
        return true;
      } catch (e) {
        console.error('Error creating tournament:', e);
        toast({ title: 'Could not create tournament', variant: 'destructive' });
        return false;
      }
    },
    [fetchSummaries, toast],
  );

  const deletePlan = useCallback(
    async (slug: string) => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return false;
        const { error } = await db
          .from('tournament_pitch_plans')
          .delete()
          .eq('user_id', user.id)
          .eq('tournament_slug', slug);
        if (error) throw error;
        await fetchSummaries();
        return true;
      } catch (e) {
        console.error('Error deleting tournament:', e);
        toast({ title: 'Could not delete tournament', variant: 'destructive' });
        return false;
      }
    },
    [fetchSummaries, toast],
  );

  useEffect(() => {
    fetchSummaries();
  }, [fetchSummaries]);

  return { summaries, isLoading, refetch: fetchSummaries, createPlan, deletePlan };
}
