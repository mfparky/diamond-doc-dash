import { useState, useEffect, useCallback } from 'react';
import { logger } from '@/lib/logger';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { validatePitcher } from '@/lib/validation';
import { PitchTypeConfig } from '@/types/pitch-location';

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
}

function toCoachRating(value: string | null | undefined): CoachRating {
  if (value === 'minus' || value === 'even' || value === 'plus') return value;
  return null;
}

export function usePitchers() {
  const [pitchers, setPitchers] = useState<PitcherRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  // Fetch pitchers from Supabase
  const fetchPitchers = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('pitchers')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;

      const mappedPitchers: PitcherRecord[] = (data || []).map((row) => ({
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
      }));

      setPitchers(mappedPitchers);
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

      const { data, error } = await supabase
        .from('pitchers')
        .insert({
          name: validatedData.name,
          max_weekly_pitches: validatedData.maxWeeklyPitches,
          user_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      const newPitcher: PitcherRecord = {
        id: data.id,
        name: data.name,
        maxWeeklyPitches: data.max_weekly_pitches,
        pitchTypes: data.pitch_types as PitchTypeConfig | null,
        teamId: data.team_id ?? null,
        userId: data.user_id ?? null,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        effortRating: toCoachRating(data.effort_rating),
        coachabilityRating: toCoachRating(data.coachability_rating),
        baseballIqRating: toCoachRating(data.baseball_iq_rating),
      };

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
  }, [toast]);

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
    setCoachRating,
    refetch: fetchPitchers,
  };
}
