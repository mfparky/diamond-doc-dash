import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Outing } from '@/types/pitcher';
import { useToast } from '@/hooks/use-toast';

export function useOutings() {
  const [outings, setOutings] = useState<Outing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  // Fetch outings from Supabase
  const fetchOutings = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('outings')
        .select('*')
        .order('date', { ascending: false });

      if (error) throw error;

      // Map database rows to Outing type
      const mappedOutings: Outing[] = (data || []).map((row) => ({
        id: row.id,
        timestamp: row.created_at,
        date: row.date,
        pitcherName: row.pitcher_name,
        eventType: row.event_type as Outing['eventType'],
        pitchCount: row.pitch_count,
        strikes: row.strikes ?? 0,
        maxVelo: row.max_velocity ?? 0,
        notes: row.notes ?? '',
        videoUrl: row.video_url ?? undefined,
      }));

      setOutings(mappedOutings);
    } catch (error) {
      console.error('Error fetching outings:', error);
      toast({
        title: 'Error loading outings',
        description: 'Could not load outings from the database.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  // Add a new outing to Supabase
  const addOuting = useCallback(async (outingData: Omit<Outing, 'id' | 'timestamp'>): Promise<Outing | null> => {
    try {
      // Find the pitcher to get their ID
      const pitcherId = outingData.pitcherName.toLowerCase().replace(/\s+/g, '-');

      const { data, error } = await supabase
        .from('outings')
        .insert({
          pitcher_id: pitcherId,
          pitcher_name: outingData.pitcherName,
          date: outingData.date,
          event_type: outingData.eventType,
          pitch_count: outingData.pitchCount,
          strikes: outingData.strikes || null,
          max_velocity: outingData.maxVelo || null,
          notes: outingData.notes || null,
          video_url: outingData.videoUrl || null,
        })
        .select()
        .single();

      if (error) throw error;

      const newOuting: Outing = {
        id: data.id,
        timestamp: data.created_at,
        date: data.date,
        pitcherName: data.pitcher_name,
        eventType: data.event_type as Outing['eventType'],
        pitchCount: data.pitch_count,
        strikes: data.strikes ?? 0,
        maxVelo: data.max_velocity ?? 0,
        notes: data.notes ?? '',
        videoUrl: data.video_url ?? undefined,
      };

      setOutings((prev) => [newOuting, ...prev]);
      return newOuting;
    } catch (error) {
      console.error('Error adding outing:', error);
      toast({
        title: 'Error saving outing',
        description: 'Could not save the outing to the database.',
        variant: 'destructive',
      });
      return null;
    }
  }, [toast]);

  // Load outings on mount
  useEffect(() => {
    fetchOutings();
  }, [fetchOutings]);

  return {
    outings,
    isLoading,
    addOuting,
    refetch: fetchOutings,
  };
}
