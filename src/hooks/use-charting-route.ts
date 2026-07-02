import { useMemo, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useOutings } from '@/hooks/use-outings';
import { usePitchers } from '@/hooks/use-pitchers';
import { usePitchLocations } from '@/hooks/use-pitch-locations';
import { useToast } from '@/hooks/use-toast';
import { calculatePitcherStats } from '@/lib/pitcher-data';
import type { Outing, Pitcher } from '@/types/pitcher';

interface CompleteSessionData {
  pitches: Array<{
    pitchNumber: number;
    pitchType: number;
    xLocation: number;
    yLocation: number;
    isStrike: boolean;
  }>;
  maxVelo: number;
  pitchCount: number;
  strikes: number;
  eventType: Outing['eventType'];
  date: string;
  notes?: string;
}

/**
 * Shared plumbing for the three charting route pages (Bullpen / Game /
 * Live ABs). Reads pitcherId from the query string, resolves the pitcher
 * from the roster, and returns a completion handler that writes an outing
 * + pitch locations and navigates back to the dashboard.
 */
export function useChartingRoute() {
  const [searchParams] = useSearchParams();
  const pitcherId = searchParams.get('pitcherId') ?? '';
  const navigate = useNavigate();
  const { toast } = useToast();

  const { pitchers, isLoading: pitchersLoading } = usePitchers();
  const { outings, isLoading: outingsLoading, addOuting } = useOutings();
  const { addPitchLocations } = usePitchLocations();

  const pitcher = useMemo<Pitcher | null>(() => {
    if (!pitcherId) return null;
    const record = pitchers.find((p) => p.id === pitcherId);
    if (!record) return null;
    const basePitcher: Pitcher = {
      id: record.id,
      name: record.name,
      sevenDayPulse: 0,
      strikePercentage: 0,
      maxVelo: 0,
      lastOuting: '',
      lastPitchCount: 0,
      restStatus: { type: 'no-data' },
      notes: '',
      outings: [],
    };
    return calculatePitcherStats(basePitcher, outings);
  }, [pitcherId, pitchers, outings]);

  const isLoading = pitchersLoading || outingsLoading;

  const handleCancel = useCallback(() => {
    navigate('/');
  }, [navigate]);

  const handleComplete = useCallback(
    async (data: CompleteSessionData) => {
      if (!pitcher) {
        toast({
          title: 'Missing pitcher',
          description: 'Could not identify the player to log the session against.',
          variant: 'destructive',
        });
        return;
      }

      const newOuting = await addOuting({
        pitcherName: pitcher.name,
        date: data.date,
        eventType: data.eventType,
        pitchCount: data.pitchCount,
        strikes: data.strikes,
        maxVelo: data.maxVelo,
        notes: data.notes ?? `Live charted session - ${data.pitches.length} pitches`,
      });

      if (!newOuting) {
        // useOutings already fired an error toast.
        return;
      }

      if (data.pitches.length > 0) {
        await addPitchLocations(newOuting.id, pitcher.id, data.pitches);
      }

      toast({
        title: 'Session saved',
        description: `${data.pitchCount} pitches recorded${data.maxVelo ? ` · Max velo ${data.maxVelo}` : ''}.`,
      });
      navigate('/');
    },
    [pitcher, addOuting, addPitchLocations, toast, navigate],
  );

  return { pitcher, isLoading, pitcherId, handleComplete, handleCancel };
}
