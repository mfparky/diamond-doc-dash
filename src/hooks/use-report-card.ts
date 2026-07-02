import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

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
  updatedAt: string;
}

interface UseReportCardResult {
  card: ReportCardRecord | null;
  isLoading: boolean;
  save: (patch: Partial<Pick<ReportCardRecord,
    'coachContext' | 'summary' | 'strengths' | 'areas' | 'snapshotId'>>) => Promise<boolean>;
  refetch: () => Promise<void>;
}

/**
 * Coach-owned report card keyed by (pitcher_id, period_start). Upserts on save
 * so the coach can iterate through drafts + edits without creating dupes.
 */
export function useReportCard(pitcherId: string | undefined, periodStart: string, periodEnd: string): UseReportCardResult {
  const [card, setCard] = useState<ReportCardRecord | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const fetchCard = useCallback(async () => {
    if (!pitcherId || !periodStart || !periodEnd) return;
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setCard(null);
        return;
      }
      const { data, error } = await db
        .from('report_cards')
        .select('id, pitcher_id, period_start, period_end, coach_context, narrative_summary, narrative_strengths, narrative_areas, snapshot_id, updated_at')
        .eq('user_id', user.id)
        .eq('pitcher_id', pitcherId)
        .eq('period_start', periodStart)
        .maybeSingle();
      if (error) throw error;
      if (data) {
        setCard({
          id: data.id,
          pitcherId: data.pitcher_id,
          periodStart: data.period_start,
          periodEnd: data.period_end,
          coachContext: data.coach_context ?? '',
          summary: data.narrative_summary ?? '',
          strengths: data.narrative_strengths ?? '',
          areas: data.narrative_areas ?? '',
          snapshotId: data.snapshot_id,
          updatedAt: data.updated_at,
        });
      } else {
        setCard(null);
      }
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
    async (patch: Partial<Pick<ReportCardRecord, 'coachContext' | 'summary' | 'strengths' | 'areas' | 'snapshotId'>>) => {
      if (!pitcherId) return false;
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          toast({ title: 'Sign in required', variant: 'destructive' });
          return false;
        }
        const { error } = await supabase
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
              snapshot_id: patch.snapshotId ?? card?.snapshotId ?? null,
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
