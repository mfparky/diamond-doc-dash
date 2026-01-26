import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { PitchLocation, PitchTypeConfig, DEFAULT_PITCH_TYPES } from '@/types/pitch-location';

export function usePitchLocations() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Fetch pitch locations for an outing
  const fetchPitchLocationsForOuting = useCallback(async (outingId: string): Promise<PitchLocation[]> => {
    try {
      const { data, error } = await supabase
        .from('pitch_locations')
        .select('*')
        .eq('outing_id', outingId)
        .order('pitch_number', { ascending: true });

      if (error) throw error;

      return (data || []).map((row) => ({
        id: row.id,
        outingId: row.outing_id,
        pitcherId: row.pitcher_id,
        pitchNumber: row.pitch_number,
        pitchType: row.pitch_type,
        xLocation: Number(row.x_location),
        yLocation: Number(row.y_location),
        isStrike: row.is_strike,
        createdAt: row.created_at,
      }));
    } catch (error) {
      console.error('Error fetching pitch locations:', error);
      return [];
    }
  }, []);

  // Fetch pitch locations for a pitcher within a date range
  const fetchPitchLocationsForPitcher = useCallback(async (
    pitcherId: string,
    startDate?: string,
    endDate?: string
  ): Promise<PitchLocation[]> => {
    try {
      let query = supabase
        .from('pitch_locations')
        .select('*')
        .eq('pitcher_id', pitcherId)
        .order('created_at', { ascending: true });

      if (startDate) {
        query = query.gte('created_at', startDate);
      }
      if (endDate) {
        query = query.lte('created_at', endDate);
      }

      const { data, error } = await query;

      if (error) throw error;

      return (data || []).map((row) => ({
        id: row.id,
        outingId: row.outing_id,
        pitcherId: row.pitcher_id,
        pitchNumber: row.pitch_number,
        pitchType: row.pitch_type,
        xLocation: Number(row.x_location),
        yLocation: Number(row.y_location),
        isStrike: row.is_strike,
        createdAt: row.created_at,
      }));
    } catch (error) {
      console.error('Error fetching pitch locations:', error);
      return [];
    }
  }, []);

  // Add pitch locations for an outing
  const addPitchLocations = useCallback(async (
    outingId: string,
    pitcherId: string,
    locations: Array<{
      pitchNumber: number;
      pitchType: number;
      xLocation: number;
      yLocation: number;
      isStrike: boolean;
    }>
  ): Promise<boolean> => {
    setIsLoading(true);
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: 'Authentication required',
          description: 'Please sign in to save pitch locations.',
          variant: 'destructive',
        });
        return false;
      }

      const insertData = locations.map((loc) => ({
        outing_id: outingId,
        pitcher_id: pitcherId,
        pitch_number: loc.pitchNumber,
        pitch_type: loc.pitchType,
        x_location: loc.xLocation,
        y_location: loc.yLocation,
        is_strike: loc.isStrike,
        user_id: user.id,
      }));

      const { error } = await supabase
        .from('pitch_locations')
        .insert(insertData);

      if (error) throw error;

      return true;
    } catch (error: any) {
      console.error('Error adding pitch locations:', error);
      const message = error?.message?.includes('row-level security')
        ? 'You must be signed in to save pitch locations.'
        : 'Could not save the pitch location data.';
      toast({
        title: 'Error saving pitch locations',
        description: message,
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  // Delete all pitch locations for an outing
  const deletePitchLocationsForOuting = useCallback(async (outingId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('pitch_locations')
        .delete()
        .eq('outing_id', outingId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting pitch locations:', error);
      return false;
    }
  }, []);

  // Fetch pitcher's pitch type config
  const fetchPitchTypes = useCallback(async (pitcherId: string): Promise<PitchTypeConfig> => {
    try {
      const { data, error } = await supabase
        .from('pitchers')
        .select('pitch_types')
        .eq('id', pitcherId)
        .maybeSingle();

      if (error) throw error;

      if (data?.pitch_types && typeof data.pitch_types === 'object') {
        return data.pitch_types as PitchTypeConfig;
      }
      return DEFAULT_PITCH_TYPES;
    } catch (error) {
      console.error('Error fetching pitch types:', error);
      return DEFAULT_PITCH_TYPES;
    }
  }, []);

  // Update pitcher's pitch type config
  const updatePitchTypes = useCallback(async (pitcherId: string, pitchTypes: PitchTypeConfig): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('pitchers')
        .update({ pitch_types: pitchTypes })
        .eq('id', pitcherId);

      if (error) throw error;

      toast({
        title: 'Pitch types updated',
        description: 'Pitch type labels have been saved.',
      });
      return true;
    } catch (error) {
      console.error('Error updating pitch types:', error);
      toast({
        title: 'Error updating pitch types',
        description: 'Could not save pitch type labels.',
        variant: 'destructive',
      });
      return false;
    }
  }, [toast]);

  return {
    isLoading,
    fetchPitchLocationsForOuting,
    fetchPitchLocationsForPitcher,
    addPitchLocations,
    deletePitchLocationsForOuting,
    fetchPitchTypes,
    updatePitchTypes,
  };
}
