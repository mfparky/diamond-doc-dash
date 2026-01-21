import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface PitcherRecord {
  id: string;
  name: string;
  maxWeeklyPitches: number;
  createdAt: string;
  updatedAt: string;
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
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));

      setPitchers(mappedPitchers);
    } catch (error) {
      console.error('Error fetching pitchers:', error);
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
    try {
      const { data, error } = await supabase
        .from('pitchers')
        .insert({
          name: name.trim(),
          max_weekly_pitches: maxWeeklyPitches,
        })
        .select()
        .single();

      if (error) throw error;

      const newPitcher: PitcherRecord = {
        id: data.id,
        name: data.name,
        maxWeeklyPitches: data.max_weekly_pitches,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };

      setPitchers((prev) => [...prev, newPitcher].sort((a, b) => a.name.localeCompare(b.name)));
      toast({
        title: 'Pitcher added',
        description: `${name} has been added to the roster.`,
      });
      return newPitcher;
    } catch (error: any) {
      console.error('Error adding pitcher:', error);
      const message = error?.message?.includes('duplicate') 
        ? 'A pitcher with this name already exists.'
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
      const updateData: any = {};
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
      console.error('Error updating pitcher:', error);
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
      console.error('Error deleting pitcher:', error);
      toast({
        title: 'Error removing pitcher',
        description: 'Could not remove the pitcher.',
        variant: 'destructive',
      });
      return false;
    }
  }, [toast]);

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
    refetch: fetchPitchers,
  };
}
