import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Trophy, CalendarIcon, TrendingUp, Medal } from 'lucide-react';
import { format, startOfWeek, endOfWeek, eachWeekOfInterval, differenceInWeeks, isWithinInterval } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { PitcherRecord } from '@/hooks/use-pitchers';
import { cn } from '@/lib/utils';

interface WorkoutLeaderboardProps {
  pitchers: PitcherRecord[];
}

interface LeaderboardEntry {
  pitcherId: string;
  pitcherName: string;
  totalCompletions: number;
  weeklyAverage: number;
  assignmentCount: number;
}

interface DateRange {
  from: Date;
  to: Date;
}

export function WorkoutLeaderboard({ pitchers }: WorkoutLeaderboardProps) {
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const now = new Date();
    const from = startOfWeek(new Date(now.getFullYear(), now.getMonth(), 1), { weekStartsOn: 1 });
    const to = endOfWeek(now, { weekStartsOn: 1 });
    return { from, to };
  });
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch completion data for the date range
  useEffect(() => {
    const fetchLeaderboardData = async () => {
      if (pitchers.length === 0) {
        setLeaderboard([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);

      try {
        // Get all weeks in the date range
        const weeks = eachWeekOfInterval(
          { start: dateRange.from, end: dateRange.to },
          { weekStartsOn: 1 }
        );

        const weekStarts = weeks.map((w) => format(w, 'yyyy-MM-dd'));

        // Fetch completions for all pitchers in the date range
        const { data: completions, error: completionsError } = await supabase
          .from('workout_completions')
          .select('pitcher_id, week_start, assignment_id')
          .in('pitcher_id', pitchers.map((p) => p.id))
          .in('week_start', weekStarts);

        if (completionsError) throw completionsError;

        // Fetch assignment counts per pitcher
        const { data: assignments, error: assignmentsError } = await supabase
          .from('workout_assignments')
          .select('pitcher_id')
          .in('pitcher_id', pitchers.map((p) => p.id));

        if (assignmentsError) throw assignmentsError;

        // Count assignments per pitcher
        const assignmentCounts: Record<string, number> = {};
        (assignments || []).forEach((a) => {
          assignmentCounts[a.pitcher_id] = (assignmentCounts[a.pitcher_id] || 0) + 1;
        });

        // Count completions per pitcher
        const completionCounts: Record<string, number> = {};
        (completions || []).forEach((c) => {
          completionCounts[c.pitcher_id] = (completionCounts[c.pitcher_id] || 0) + 1;
        });

        // Calculate weeks in range
        const weeksInRange = Math.max(1, differenceInWeeks(dateRange.to, dateRange.from) + 1);

        // Build leaderboard entries
        const entries: LeaderboardEntry[] = pitchers.map((pitcher) => ({
          pitcherId: pitcher.id,
          pitcherName: pitcher.name,
          totalCompletions: completionCounts[pitcher.id] || 0,
          weeklyAverage: Math.round(((completionCounts[pitcher.id] || 0) / weeksInRange) * 10) / 10,
          assignmentCount: assignmentCounts[pitcher.id] || 0,
        }));

        // Sort by total completions (descending)
        entries.sort((a, b) => b.totalCompletions - a.totalCompletions);

        setLeaderboard(entries);
      } catch (error) {
        console.error('Error fetching leaderboard data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLeaderboardData();
  }, [pitchers, dateRange]);

  const getRankIcon = (index: number) => {
    if (index === 0) return <Trophy className="w-5 h-5 text-yellow-500" />;
    if (index === 1) return <Medal className="w-5 h-5 text-gray-400" />;
    if (index === 2) return <Medal className="w-5 h-5 text-amber-600" />;
    return <span className="w-5 h-5 flex items-center justify-center text-sm font-bold text-muted-foreground">{index + 1}</span>;
  };

  const weeksInRange = useMemo(() => {
    return Math.max(1, differenceInWeeks(dateRange.to, dateRange.from) + 1);
  }, [dateRange]);

  return (
    <div className="space-y-4">
      {/* Date Range Picker */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-muted-foreground">Date Range:</span>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <CalendarIcon className="w-4 h-4" />
              {format(dateRange.from, 'MMM d')} - {format(dateRange.to, 'MMM d, yyyy')}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              selected={{ from: dateRange.from, to: dateRange.to }}
              onSelect={(range) => {
                if (range?.from && range?.to) {
                  setDateRange({
                    from: startOfWeek(range.from, { weekStartsOn: 1 }),
                    to: endOfWeek(range.to, { weekStartsOn: 1 }),
                  });
                } else if (range?.from) {
                  setDateRange({
                    from: startOfWeek(range.from, { weekStartsOn: 1 }),
                    to: endOfWeek(range.from, { weekStartsOn: 1 }),
                  });
                }
              }}
              numberOfMonths={1}
            />
          </PopoverContent>
        </Popover>
        <span className="text-xs text-muted-foreground">
          ({weeksInRange} week{weeksInRange !== 1 ? 's' : ''})
        </span>
      </div>

      {/* Leaderboard */}
      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      ) : leaderboard.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No workout data available for this period.
        </div>
      ) : (
        <div className="space-y-2">
          {leaderboard.map((entry, index) => (
            <div
              key={entry.pitcherId}
              className={cn(
                'flex items-center gap-3 p-3 rounded-lg border',
                index === 0
                  ? 'bg-yellow-500/10 border-yellow-500/30'
                  : index === 1
                  ? 'bg-gray-400/10 border-gray-400/30'
                  : index === 2
                  ? 'bg-amber-600/10 border-amber-600/30'
                  : 'bg-secondary/50 border-border/50'
              )}
            >
              {/* Rank */}
              <div className="shrink-0">{getRankIcon(index)}</div>

              {/* Name & Stats */}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground truncate">{entry.pitcherName}</p>
                <p className="text-xs text-muted-foreground">
                  {entry.assignmentCount} workout{entry.assignmentCount !== 1 ? 's' : ''} assigned
                </p>
              </div>

              {/* Completion Stats */}
              <div className="text-right shrink-0">
                <p className="font-bold text-foreground">{entry.totalCompletions}</p>
                <p className="text-xs text-muted-foreground">total</p>
              </div>

              <div className="text-right shrink-0 border-l border-border/50 pl-3">
                <p className="font-semibold text-primary">{entry.weeklyAverage}</p>
                <p className="text-xs text-muted-foreground">/week</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
