import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Trophy, CalendarIcon, TrendingUp, TrendingDown, Medal, Minus } from 'lucide-react';
import { format, startOfWeek, endOfWeek, eachWeekOfInterval, differenceInWeeks, subWeeks } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { PitcherRecord } from '@/hooks/use-pitchers';
import { cn } from '@/lib/utils';

interface WorkoutLeaderboardProps {
  pitchers: PitcherRecord[];
  initialFrom?: Date;
  initialTo?: Date;
  maxEntries?: number;
  highlightPitcherId?: string;
  hideDatePicker?: boolean;
  lockedToCoachDates?: boolean;
  compact?: boolean;
}

type Trend = 'up' | 'down' | 'same';

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

function TrendIcon({ trend }: { trend: Trend }) {
  if (trend === 'up')   return <TrendingUp   className="w-4 h-4 text-green-500" />;
  if (trend === 'down') return <TrendingDown className="w-4 h-4 text-red-400" />;
  return <Minus className="w-4 h-4 text-muted-foreground/50" />;
}

function CompactLeaderboardRow({ entry, index, trend, isHighlighted }: {
  entry: LeaderboardEntry;
  index: number;
  trend: Trend;
  isHighlighted?: boolean;
}) {
  const medals = ['🥇', '🥈', '🥉'];
  return (
    <div className={cn(
      'flex items-center gap-3 px-3 py-2.5 rounded-lg',
      isHighlighted ? 'ring-1 ring-primary/40 bg-primary/5' : 'hover:bg-secondary/40',
    )}>
      {/* Rank */}
      <span className="w-6 text-center shrink-0">
        {index < 3
          ? <span className="text-base leading-none">{medals[index]}</span>
          : <span className="text-sm font-bold text-muted-foreground">{index + 1}</span>
        }
      </span>
      {/* Name */}
      <span className={cn(
        'flex-1 font-medium truncate text-sm',
        isHighlighted ? 'text-primary' : 'text-foreground',
      )}>
        {entry.pitcherName}
      </span>
      {/* Trend */}
      <TrendIcon trend={trend} />
    </div>
  );
}

function LeaderboardRow({ entry, index, trend, getRankIcon, isHighlighted }: {
  entry: LeaderboardEntry;
  index: number;
  trend: Trend;
  getRankIcon: (i: number) => React.ReactNode;
  isHighlighted?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 p-3 rounded-lg border',
        isHighlighted ? 'ring-2 ring-primary/50' : '',
        index === 0
          ? 'bg-yellow-500/10 border-yellow-500/30'
          : index === 1
          ? 'bg-gray-400/10 border-gray-400/30'
          : index === 2
          ? 'bg-amber-600/10 border-amber-600/30'
          : 'bg-secondary/50 border-border/50'
      )}
    >
      <div className="shrink-0">{getRankIcon(index)}</div>
      <TrendIcon trend={trend} />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-foreground truncate">{entry.pitcherName}</p>
        <p className="text-xs text-muted-foreground">
          {entry.assignmentCount} workout{entry.assignmentCount !== 1 ? 's' : ''} assigned
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className="font-bold text-foreground">{entry.totalCompletions}</p>
        <p className="text-xs text-muted-foreground">total</p>
      </div>
      <div className="text-right shrink-0 border-l border-border/50 pl-3">
        <p className="font-semibold text-primary">{entry.weeklyAverage}</p>
        <p className="text-xs text-muted-foreground">/week</p>
      </div>
    </div>
  );
}

export function WorkoutLeaderboard({ pitchers, initialFrom, initialTo, maxEntries, highlightPitcherId, hideDatePicker, lockedToCoachDates, compact }: WorkoutLeaderboardProps) {
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const now = new Date();
    const from = initialFrom ?? startOfWeek(new Date(now.getFullYear(), now.getMonth(), 1), { weekStartsOn: 1 });
    const to = initialTo ?? endOfWeek(now, { weekStartsOn: 1 });
    return { from, to };
  });

  // Sync dateRange when initialFrom/initialTo props arrive (async fetch)
  useEffect(() => {
    if (initialFrom || initialTo) {
      const now = new Date();
      setDateRange({
        from: initialFrom ?? startOfWeek(new Date(now.getFullYear(), now.getMonth(), 1), { weekStartsOn: 1 }),
        to: initialTo ?? endOfWeek(now, { weekStartsOn: 1 }),
      });
    }
  }, [initialFrom, initialTo]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [trends, setTrends] = useState<Record<string, Trend>>({});
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
        // Current period weeks
        const weeks = eachWeekOfInterval(
          { start: dateRange.from, end: dateRange.to },
          { weekStartsOn: 1 }
        );
        const weekStarts = weeks.map((w) => format(w, 'yyyy-MM-dd'));

        // Week-on-week trend: always compare this calendar week vs last calendar week
        const today = new Date();
        const thisWeekStart = format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd');
        const lastWeekStart = format(startOfWeek(subWeeks(today, 1), { weekStartsOn: 1 }), 'yyyy-MM-dd');

        // Single query covering the selected period + both trend weeks
        const allWeekStarts = [...new Set([...weekStarts, thisWeekStart, lastWeekStart])];

        const { data: completions, error: completionsError } = await supabase
          .from('workout_completions')
          .select('pitcher_id, week_start, assignment_id')
          .in('pitcher_id', pitchers.map((p) => p.id))
          .in('week_start', allWeekStarts);

        if (completionsError) throw completionsError;

        // Fetch assignment counts + double-points flag per pitcher
        const { data: assignments, error: assignmentsError } = await supabase
          .from('workout_assignments')
          .select('id, pitcher_id, double_points, expires_at')
          .in('pitcher_id', pitchers.map((p) => p.id));

        if (assignmentsError) throw assignmentsError;

        // Count only ACTIVE (non-expired) assignments per pitcher,
        // but keep weights for ALL assignments so completed expired workouts still tally.
        const nowMs = Date.now();
        const assignmentCounts: Record<string, number> = {};
        const assignmentWeight: Record<string, number> = {};
        (assignments || []).forEach((a: any) => {
          const isExpired = a.expires_at && new Date(a.expires_at).getTime() < nowMs;
          if (!isExpired) {
            assignmentCounts[a.pitcher_id] = (assignmentCounts[a.pitcher_id] || 0) + 1;
          }
          assignmentWeight[a.id] = a.double_points ? 2 : 1;
        });

        // Split completions: selected period, this week, last week
        const weekStartSet = new Set(weekStarts);
        const completionCounts: Record<string, number> = {};
        const thisWeekCounts: Record<string, number> = {};
        const lastWeekCounts: Record<string, number> = {};
        (completions || []).forEach((c) => {
          const w = assignmentWeight[c.assignment_id] ?? 1;
          if (weekStartSet.has(c.week_start)) {
            completionCounts[c.pitcher_id] = (completionCounts[c.pitcher_id] || 0) + w;
          }
          if (c.week_start === thisWeekStart) {
            thisWeekCounts[c.pitcher_id] = (thisWeekCounts[c.pitcher_id] || 0) + w;
          }
          if (c.week_start === lastWeekStart) {
            lastWeekCounts[c.pitcher_id] = (lastWeekCounts[c.pitcher_id] || 0) + w;
          }
        });

        // Calculate weeks in range
        const weeksInRange = Math.max(1, differenceInWeeks(dateRange.to, dateRange.from) + 1);

        // Build and sort current leaderboard
        const entries: LeaderboardEntry[] = pitchers.map((pitcher) => ({
          pitcherId: pitcher.id,
          pitcherName: pitcher.name,
          totalCompletions: completionCounts[pitcher.id] || 0,
          weeklyAverage: Math.round(((completionCounts[pitcher.id] || 0) / weeksInRange) * 10) / 10,
          assignmentCount: assignmentCounts[pitcher.id] || 0,
        }));
        entries.sort((a, b) => b.totalCompletions - a.totalCompletions);

        // Build week-on-week trend ranks
        const sortedByThisWeek = [...pitchers].sort(
          (a, b) => (thisWeekCounts[b.id] || 0) - (thisWeekCounts[a.id] || 0)
        );
        const sortedByLastWeek = [...pitchers].sort(
          (a, b) => (lastWeekCounts[b.id] || 0) - (lastWeekCounts[a.id] || 0)
        );
        const thisWeekRanks: Record<string, number> = {};
        const lastWeekRanks: Record<string, number> = {};
        sortedByThisWeek.forEach((p, i) => { thisWeekRanks[p.id] = i; });
        sortedByLastWeek.forEach((p, i) => { lastWeekRanks[p.id] = i; });

        const newTrends: Record<string, Trend> = {};
        pitchers.forEach((p) => {
          const thisCount = thisWeekCounts[p.id] || 0;
          const lastCount = lastWeekCounts[p.id] || 0;
          // If no activity in either week, no movement to show
          if (thisCount === 0 && lastCount === 0) {
            newTrends[p.id] = 'same';
            return;
          }
          const thisRank = thisWeekRanks[p.id] ?? pitchers.length;
          const lastRank = lastWeekRanks[p.id] ?? pitchers.length;
          if (thisRank < lastRank) newTrends[p.id] = 'up';
          else if (thisRank > lastRank) newTrends[p.id] = 'down';
          else newTrends[p.id] = 'same';
        });

        setLeaderboard(entries);
        setTrends(newTrends);
      } catch (error) {
        console.error('Error fetching leaderboard data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLeaderboardData();

    // Poll every 3 minutes to stay fresh without a persistent WebSocket
    const interval = setInterval(fetchLeaderboardData, 3 * 60 * 1000);
    return () => clearInterval(interval);
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

  const getTrend = (pitcherId: string): Trend => trends[pitcherId] || 'same';

  return (
    <div className="space-y-4">
      {/* Date Range Picker - hidden for parent view */}
      {!hideDatePicker && (
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
                  }
                }}
                numberOfMonths={1}
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
          <span className="text-xs text-muted-foreground">
            ({weeksInRange} week{weeksInRange !== 1 ? 's' : ''})
          </span>
        </div>
      )}
      {hideDatePicker && (
        lockedToCoachDates && !initialFrom && !initialTo ? (
          <p className="text-xs text-muted-foreground text-center italic">
            Date range not set by coach yet — showing current week.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground text-center">
            {format(dateRange.from, 'MMM d')} – {format(dateRange.to, 'MMM d, yyyy')} ({weeksInRange} week{weeksInRange !== 1 ? 's' : ''})
          </p>
        )
      )}

      {/* Leaderboard */}
      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      ) : leaderboard.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No workout data available for this period.
        </div>
      ) : (
        <div className="space-y-2">
          {(() => {
            // If maxEntries is set, show top N + highlighted player if outside top N
            let visibleEntries = leaderboard;
            let highlightEntry: { entry: LeaderboardEntry; rank: number } | null = null;

            if (maxEntries && maxEntries < leaderboard.length) {
              const topEntries = leaderboard.slice(0, maxEntries);
              const highlightInTop = highlightPitcherId
                ? topEntries.some(e => e.pitcherId === highlightPitcherId)
                : true;

              if (!highlightInTop && highlightPitcherId) {
                const idx = leaderboard.findIndex(e => e.pitcherId === highlightPitcherId);
                if (idx >= 0) {
                  highlightEntry = { entry: leaderboard[idx], rank: idx };
                }
              }
              visibleEntries = topEntries;
            }

            return (
              <>
                {visibleEntries.map((entry, index) =>
                  compact ? (
                    <CompactLeaderboardRow
                      key={entry.pitcherId}
                      entry={entry}
                      index={index}
                      trend={getTrend(entry.pitcherId)}
                      isHighlighted={entry.pitcherId === highlightPitcherId}
                    />
                  ) : (
                    <LeaderboardRow key={entry.pitcherId} entry={entry} index={index} trend={getTrend(entry.pitcherId)} getRankIcon={getRankIcon} isHighlighted={entry.pitcherId === highlightPitcherId} />
                  )
                )}
                {highlightEntry && (
                  <>
                    <div className="text-center text-xs text-muted-foreground py-1">···</div>
                    {compact ? (
                      <CompactLeaderboardRow entry={highlightEntry.entry} index={highlightEntry.rank} trend={getTrend(highlightEntry.entry.pitcherId)} isHighlighted />
                    ) : (
                      <LeaderboardRow entry={highlightEntry.entry} index={highlightEntry.rank} trend={getTrend(highlightEntry.entry.pitcherId)} getRankIcon={getRankIcon} isHighlighted />
                    )}
                  </>
                )}
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}
