import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Json } from '@/integrations/supabase/types';

export interface LineupRecord {
  id: string;
  date: string;
  battingOrder: string[]; // ordered pitcher_ids
  notes: string | null;
  updatedAt: string;
}

interface UseLineupResult {
  lineup: LineupRecord | null;
  isLoading: boolean;
  refetch: () => Promise<void>;
  save: (battingOrder: string[], notes?: string | null) => Promise<boolean>;
}

/**
 * Coach-owned lineup for a given date. `save` upserts by (user_id, date) so
 * a coach can iterate through the day without creating duplicates.
 */
export function useLineup(date: string): UseLineupResult {
  const [lineup, setLineup] = useState<LineupRecord | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const fetchLineup = useCallback(async () => {
    if (!date) return;
    setIsLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLineup(null);
        return;
      }
      const { data, error } = await supabase
        .from('lineups')
        .select('id, date, batting_order, notes, updated_at')
        .eq('user_id', user.id)
        .eq('date', date)
        .maybeSingle();
      if (error) throw error;
      if (data) {
        setLineup({
          id: data.id,
          date: data.date,
          battingOrder: Array.isArray(data.batting_order)
            ? (data.batting_order as unknown as string[])
            : [],
          notes: data.notes,
          updatedAt: data.updated_at,
        });
      } else {
        setLineup(null);
      }
    } catch (e) {
      console.error('Error fetching lineup:', e);
      toast({
        title: 'Could not load lineup',
        description: 'Try refreshing.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [date, toast]);

  const save = useCallback(
    async (battingOrder: string[], notes: string | null = null) => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          toast({
            title: 'Sign in required',
            description: 'Sign in to save lineups.',
            variant: 'destructive',
          });
          return false;
        }
        const { error } = await supabase
          .from('lineups')
          .upsert(
            {
              user_id: user.id,
              date,
              batting_order: battingOrder as unknown as Json,
              notes,
            },
            { onConflict: 'user_id,date' },
          );
        if (error) throw error;
        await fetchLineup();
        return true;
      } catch (e) {
        console.error('Error saving lineup:', e);
        toast({
          title: 'Could not save lineup',
          description: 'Try again.',
          variant: 'destructive',
        });
        return false;
      }
    },
    [date, fetchLineup, toast],
  );

  useEffect(() => {
    fetchLineup();
  }, [fetchLineup]);

  return { lineup, isLoading, refetch: fetchLineup, save };
}
