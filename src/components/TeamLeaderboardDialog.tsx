import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Trophy } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { WorkoutLeaderboard } from '@/components/WorkoutLeaderboard';
import { PitcherRecord } from '@/hooks/use-pitchers';

interface TeamLeaderboardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pitcherId: string;
}

export function TeamLeaderboardDialog({ open, onOpenChange, pitcherId }: TeamLeaderboardDialogProps) {
  const [teamPitchers, setTeamPitchers] = useState<PitcherRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!open) return;

    const fetchTeamPitchers = async () => {
      setIsLoading(true);
      try {
        const { data: pitcher } = await supabase
          .from('pitchers')
          .select('team_id')
          .eq('id', pitcherId)
          .single();

        if (!pitcher?.team_id) {
          setTeamPitchers([]);
          return;
        }

        const { data: pitchers } = await supabase
          .from('pitchers')
          .select('*')
          .eq('team_id', pitcher.team_id);

        const mapped: PitcherRecord[] = (pitchers || []).map((p) => ({
          id: p.id,
          name: p.name,
          pitchTypes: p.pitch_types as PitcherRecord['pitchTypes'],
          maxWeeklyPitches: p.max_weekly_pitches,
          createdAt: p.created_at,
          updatedAt: p.updated_at,
        }));

        setTeamPitchers(mapped);
      } catch (error) {
        console.error('Error fetching team pitchers:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTeamPitchers();
  }, [open, pitcherId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-500" />
            Team Leaderboard
          </DialogTitle>
          <DialogDescription>
            See how the team is doing with their workouts.
          </DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : teamPitchers.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No team data available.
          </div>
        ) : (
          <WorkoutLeaderboard pitchers={teamPitchers} />
        )}
      </DialogContent>
    </Dialog>
  );
}
