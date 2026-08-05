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
  const [leaderboardFrom, setLeaderboardFrom] = useState<Date | undefined>();
  const [leaderboardTo, setLeaderboardTo] = useState<Date | undefined>();

  useEffect(() => {
    if (!open) return;

    const fetchTeamPitchers = async () => {
      setIsLoading(true);
      try {
        const { data: pitcherRows } = await supabase.rpc('get_public_pitcher', { p_pitcher_id: pitcherId });
        const pitcher = pitcherRows?.[0];

        if (!pitcher) {
          setTeamPitchers([]);
          return;
        }

        // Fetch leaderboard date range from team, or fall back to owner settings
        // Try team-level settings first, then user-level fallback
        let lbFrom: string | null = null;
        let lbTo: string | null = null;

        if (pitcher.team_id) {
          const { data: teamRows } = await supabase.rpc('get_public_team_info', { p_team_id: pitcher.team_id });
          const team = teamRows?.[0];

          if (team) {
            lbFrom = team.leaderboard_from;
            lbTo = team.leaderboard_to;
          }
        }

        // Fallback to dashboard_settings if team didn't have dates
        if (!lbFrom && !lbTo && pitcher.user_id) {
          const { data: settings } = await supabase
            .from('dashboard_settings')
            .select('leaderboard_from, leaderboard_to')
            .eq('user_id', pitcher.user_id)
            .maybeSingle();

          if (settings) {
            lbFrom = settings.leaderboard_from;
            lbTo = settings.leaderboard_to;
          }
        }

        setLeaderboardFrom(lbFrom ? new Date(lbFrom + 'T00:00:00') : undefined);
        setLeaderboardTo(lbTo ? new Date(lbTo + 'T00:00:00') : undefined);

        // Fetch teammates by team_id, or fall back to user_id grouping
        let pitchers: typeof pitcherRows = [];
        if (pitcher.team_id) {
          const { data } = await supabase.rpc('get_public_team_pitchers', { p_team_id: pitcher.team_id });
          pitchers = data || [];
        } else if (pitcher.user_id) {
          const { data } = await supabase.rpc('get_public_user_pitchers', { p_user_id: pitcher.user_id });
          pitchers = data || [];
        } else {
          setTeamPitchers([]);
          return;
        }

        const mapped: PitcherRecord[] = (pitchers || []).map((p) => ({
          id: p.id,
          name: p.name,
          pitchTypes: p.pitch_types as PitcherRecord['pitchTypes'],
          maxWeeklyPitches: p.max_weekly_pitches,
          teamId: p.team_id,
          userId: p.user_id,
          createdAt: p.created_at,
          updatedAt: p.updated_at,
          effortRating: p.effort_rating === 'minus' || p.effort_rating === 'even' || p.effort_rating === 'plus' ? p.effort_rating : null,
          coachabilityRating: p.coachability_rating === 'minus' || p.coachability_rating === 'even' || p.coachability_rating === 'plus' ? p.coachability_rating : null,
          baseballIqRating: p.baseball_iq_rating === 'minus' || p.baseball_iq_rating === 'even' || p.baseball_iq_rating === 'plus' ? p.baseball_iq_rating : null,
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
          <WorkoutLeaderboard pitchers={teamPitchers} initialFrom={leaderboardFrom} initialTo={leaderboardTo} maxEntries={5} highlightPitcherId={pitcherId} hideDatePicker lockedToCoachDates />
        )}
      </DialogContent>
    </Dialog>
  );
}
