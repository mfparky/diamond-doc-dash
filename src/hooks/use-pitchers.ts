import { useState, useEffect, useCallback } from 'react';
import { logger } from '@/lib/logger';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { validatePitcher } from '@/lib/validation';
import { PitchTypeConfig } from '@/types/pitch-location';
import { useTeamMemberships } from '@/hooks/use-team-memberships';

export type CoachRating = 'minus' | 'even' | 'plus' | null;

export interface PitcherRecord {
  id: string;
  name: string;
  maxWeeklyPitches: number;
  pitchTypes: PitchTypeConfig | null;
  teamId?: string | null;
  userId?: string | null;
  createdAt: string;
  updatedAt: string;
  effortRating: CoachRating;
  coachabilityRating: CoachRating;
  baseballIqRating: CoachRating;
  /** Coach override: trust this arm's pitching sample at full weight regardless of IP. */
  highImpactArm: boolean;
  /** False once archived off the active roster (e.g. at season rollover).
   *  usePitchers() only ever returns active=true rows — this is here so
   *  the same PitcherRecord shape covers the archived list too. */
  active: boolean;
}

function toCoachRating(value: string | null | undefined): CoachRating {
  if (value === 'minus' || value === 'even' || value === 'plus') return value;
  return null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapPitcherRow(row: any): PitcherRecord {
  return {
    id: row.id,
    name: row.name,
    maxWeeklyPitches: row.max_weekly_pitches,
    pitchTypes: row.pitch_types as PitchTypeConfig | null,
    teamId: row.team_id ?? null,
    userId: row.user_id ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    effortRating: toCoachRating(row.effort_rating),
    coachabilityRating: toCoachRating(row.coachability_rating),
    baseballIqRating: toCoachRating(row.baseball_iq_rating),
    highImpactArm: row.high_impact_arm ?? false,
    active: row.active ?? true,
  };
}

export function usePitchers() {
  const [pitchers, setPitchers] = useState<PitcherRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const { activeTeamId } = useTeamMemberships();

  // Fetch pitchers from Supabase. Active roster only — archived players
  // (past-season, kept for their history and public link) live outside
  // this hook; RosterManagementDialog fetches them separately on demand.
  const fetchPitchers = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('pitchers')
        .select('*')
        .eq('active', true)
        .order('name', { ascending: true });

      if (error) throw error;

      setPitchers((data || []).map(mapPitcherRow));
    } catch (error) {
      logger.error('Error fetching pitchers:', error);
      toast({
        title: 'Error loading roster',
        description: 'Could not load pitchers from the database.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  // Add a new pitcher
  const addPitcher = useCallback(async (name: string, maxWeeklyPitches: number = 120): Promise<PitcherRecord | null> => {
    // Validate input
    const validation = validatePitcher({ name, maxWeeklyPitches });
    if (validation.success === false) {
      toast({
        title: 'Validation Error',
        description: validation.error,
        variant: 'destructive',
      });
      return null;
    }
    const validatedData = validation.data;

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: 'Authentication required',
          description: 'Please sign in to add pitchers.',
          variant: 'destructive',
        });
        return null;
      }

      // Stamp team_id explicitly so isolation doesn't rely solely on the DB
      // trigger fallback — a new roster entry must always belong to the
      // adding coach's currently active team.
      const { data, error } = await supabase
        .from('pitchers')
        .insert({
          name: validatedData.name,
          max_weekly_pitches: validatedData.maxWeeklyPitches,
          user_id: user.id,
          team_id: activeTeamId ?? null,
        })
        .select()
        .single();

      if (error) throw error;

      const newPitcher: PitcherRecord = mapPitcherRow(data);

      setPitchers((prev) => [...prev, newPitcher].sort((a, b) => a.name.localeCompare(b.name)));
      toast({
        title: 'Pitcher added',
        description: `${name} has been added to the roster.`,
      });
      return newPitcher;
    } catch (error: any) {
      logger.error('Error adding pitcher:', error);
      const message = error?.message?.includes('duplicate') 
        ? 'A pitcher with this name already exists.'
        : error?.message?.includes('row-level security')
        ? 'You must be signed in to add pitchers.'
        : 'Could not add the pitcher.';
      toast({
        title: 'Error adding pitcher',
        description: message,
        variant: 'destructive',
      });
      return null;
    }
  }, [toast, activeTeamId]);

  // Update a pitcher
  const updatePitcher = useCallback(async (id: string, updates: { name?: string; maxWeeklyPitches?: number }): Promise<boolean> => {
    try {
      const updateData: { name?: string; max_weekly_pitches?: number } = {};
      if (updates.name !== undefined) updateData.name = updates.name.trim();
      if (updates.maxWeeklyPitches !== undefined) updateData.max_weekly_pitches = updates.maxWeeklyPitches;

      const { error } = await supabase
        .from('pitchers')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;

      await fetchPitchers();
      toast({
        title: 'Pitcher updated',
        description: 'The pitcher has been updated successfully.',
      });
      return true;
    } catch (error: any) {
      logger.error('Error updating pitcher:', error);
      const message = error?.message?.includes('duplicate') 
        ? 'A pitcher with this name already exists.'
        : 'Could not update the pitcher.';
      toast({
        title: 'Error updating pitcher',
        description: message,
        variant: 'destructive',
      });
      return false;
    }
  }, [toast, fetchPitchers]);

  // Delete a pitcher
  const deletePitcher = useCallback(async (id: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('pitchers')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setPitchers((prev) => prev.filter((p) => p.id !== id));
      toast({
        title: 'Pitcher removed',
        description: 'The pitcher has been removed from the roster.',
      });
      return true;
    } catch (error) {
      logger.error('Error deleting pitcher:', error);
      toast({
        title: 'Error removing pitcher',
        description: 'Could not remove the pitcher.',
        variant: 'destructive',
      });
      return false;
    }
  }, [toast]);

  // Archive: soft-remove from the active roster for a season rollover.
  // Unlike delete, this touches nothing else — history, stats, report
  // cards, and the player's public /player/:id link all keep working.
  const archivePitcher = useCallback(async (id: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('pitchers')
        .update({ active: false })
        .eq('id', id);

      if (error) throw error;

      setPitchers((prev) => prev.filter((p) => p.id !== id));
      toast({
        title: 'Pitcher archived',
        description: 'Removed from the active roster. Reactivate anytime from Archived players.',
      });
      return true;
    } catch (error) {
      logger.error('Error archiving pitcher:', error);
      toast({
        title: 'Could not archive pitcher',
        description: 'Try again.',
        variant: 'destructive',
      });
      return false;
    }
  }, [toast]);

  // Bring an archived player back onto the active roster.
  const reactivatePitcher = useCallback(async (id: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('pitchers')
        .update({ active: true })
        .eq('id', id);

      if (error) throw error;

      await fetchPitchers();
      toast({ title: 'Pitcher reactivated', description: 'Back on the active roster.' });
      return true;
    } catch (error) {
      logger.error('Error reactivating pitcher:', error);
      toast({
        title: 'Could not reactivate pitcher',
        description: 'Try again.',
        variant: 'destructive',
      });
      return false;
    }
  }, [toast, fetchPitchers]);

  // "Roll to a new season" — archives the whole current active roster in
  // one action. Nothing is deleted; each player can be reactivated
  // individually afterward and their history/public link are untouched.
  const startNewSeason = useCallback(async (): Promise<boolean> => {
    const ids = pitchers.map((p) => p.id);
    if (ids.length === 0) return true;
    try {
      const { error } = await supabase
        .from('pitchers')
        .update({ active: false })
        .in('id', ids);

      if (error) throw error;

      setPitchers([]);
      toast({
        title: 'New season started',
        description: `${ids.length} player${ids.length === 1 ? '' : 's'} archived. Reactivate returners anytime.`,
      });
      return true;
    } catch (error) {
      logger.error('Error starting new season:', error);
      toast({
        title: 'Could not start new season',
        description: 'Try again.',
        variant: 'destructive',
      });
      return false;
    }
  }, [pitchers, toast]);

  // Archived players, fetched on demand only — most consumers of this hook
  // never need them, so they live outside its own `pitchers` state.
  const fetchArchivedPitchers = useCallback(async (): Promise<PitcherRecord[]> => {
    try {
      const { data, error } = await supabase
        .from('pitchers')
        .select('*')
        .eq('active', false)
        .order('name', { ascending: true });

      if (error) throw error;

      return (data || []).map(mapPitcherRow);
    } catch (error) {
      logger.error('Error fetching archived pitchers:', error);
      toast({
        title: 'Could not load archived players',
        description: 'Try again.',
        variant: 'destructive',
      });
      return [];
    }
  }, [toast]);

  // Set a single coach-rating dimension on a pitcher. Optimistic update with
  // rollback on error so the rankings UI feels instant.
  const setCoachRating = useCallback(
    async (
      id: string,
      dimension: 'effort' | 'coachability' | 'baseball_iq',
      rating: CoachRating,
    ): Promise<boolean> => {
      const column =
        dimension === 'effort' ? 'effort_rating' :
        dimension === 'coachability' ? 'coachability_rating' :
        'baseball_iq_rating';
      const localKey =
        dimension === 'effort' ? 'effortRating' as const :
        dimension === 'coachability' ? 'coachabilityRating' as const :
        'baseballIqRating' as const;

      const previousRating = pitchers.find((p) => p.id === id)?.[localKey] ?? null;
      setPitchers((prev) => prev.map((p) => (p.id === id ? { ...p, [localKey]: rating } : p)));

      try {
        const { error } = await supabase
          .from('pitchers')
          .update({ [column]: rating })
          .eq('id', id);
        if (error) throw error;
        return true;
      } catch (error) {
        logger.error('Error setting coach rating:', error);
        setPitchers((prev) => prev.map((p) => (p.id === id ? { ...p, [localKey]: previousRating } : p)));
        toast({
          title: 'Could not save rating',
          description: 'Try again.',
          variant: 'destructive',
        });
        return false;
      }
    },
    [pitchers, toast],
  );

  // Toggle the "trusted high-impact arm" override that bypasses the pitching
  // participation floor for one player on the Rankings page. Optimistic
  // update with rollback, same shape as setCoachRating.
  const setHighImpactArm = useCallback(
    async (id: string, value: boolean): Promise<boolean> => {
      const previous = pitchers.find((p) => p.id === id)?.highImpactArm ?? false;
      setPitchers((prev) => prev.map((p) => (p.id === id ? { ...p, highImpactArm: value } : p)));

      try {
        const { error } = await (supabase as any)
          .from('pitchers')
          .update({ high_impact_arm: value })
          .eq('id', id);
        if (error) throw error;
        return true;
      } catch (error) {
        logger.error('Error setting high-impact arm flag:', error);
        setPitchers((prev) => prev.map((p) => (p.id === id ? { ...p, highImpactArm: previous } : p)));
        toast({
          title: 'Could not save',
          description: 'Try again.',
          variant: 'destructive',
        });
        return false;
      }
    },
    [pitchers, toast],
  );

  // Load pitchers on mount
  useEffect(() => {
    fetchPitchers();
  }, [fetchPitchers]);

  return {
    pitchers,
    isLoading,
    addPitcher,
    updatePitcher,
    deletePitcher,
    archivePitcher,
    reactivatePitcher,
    startNewSeason,
    fetchArchivedPitchers,
    setCoachRating,
    setHighImpactArm,
    refetch: fetchPitchers,
  };
}
