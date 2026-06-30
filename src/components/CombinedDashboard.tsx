import { useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Outing, parseLocalDateAtNoon } from '@/types/pitcher';
import { PitchLocation, PitchTypeConfig, DEFAULT_PITCH_TYPES, PITCH_TYPE_COLORS } from '@/types/pitch-location';
import { SmoothHeatmap } from '@/components/SmoothHeatmap';
import { StrikePercentBar } from '@/components/StrikePercentBar';
import { FlipCounter } from '@/components/FlipCounter';

import { VelocityScale } from '@/components/VelocityScale';
import { DateRangePicker } from '@/components/DateRangePicker';
import { WorkoutLeaderboard } from '@/components/WorkoutLeaderboard';
import { useShowWorkoutLeaderboard } from '@/hooks/use-team-dashboard-prefs';
import { PitcherRecord } from '@/hooks/use-pitchers';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { TeamHealthPanel } from '@/components/TeamHealthPanel';
import { Activity, Target, Crosshair, Calendar, Flame, TrendingUp, TrendingDown, Minus, Dumbbell, Trophy, ListChecks } from 'lucide-react';

interface CombinedDashboardProps {
  outings: Outing[];
  pitcherPitchTypes: Record<string, PitchTypeConfig>;
  parentMode?: boolean;
  teamId?: string;
  pitchers?: PitcherRecord[];
  /** Coach-only: opens the season-stat CSV upload dialog. */
  onRequestStatUpload?: () => void;
}

interface GameDashboardRow {
  id: string;
  date: string;
  opponent_name: string | null;
  status: string;
  team_id: string | null;
  user_id: string | null;
}

interface PitchLocationRow {
  id: string;
  outing_id: string;
  pitcher_id: string;
  pitch_number: number;
  pitch_type: number;
  x_location: number | string;
  y_location: number | string;
  is_strike: boolean;
  created_at: string;
}

const EVENT_COLORS: Record<string, string> = {
  'Bullpen': 'hsl(220, 70%, 45%)',
  'Game': 'hsl(142, 70%, 45%)',
  'External': 'hsl(200, 80%, 60%)',
  'Live ABs': 'hsl(25, 90%, 55%)',
};

type ViewMode = '7-day' | 'season';

type ResultFilter = 'all' | 'strikes' | 'balls';

export function CombinedDashboard({ outings, pitcherPitchTypes, parentMode = false, teamId, pitchers, onRequestStatUpload }: CombinedDashboardProps) {
  const [showWorkoutLeaderboard] = useShowWorkoutLeaderboard();
  const [pitchLocations, setPitchLocations] = useState<PitchLocation[]>([]);
  const [isLoadingLocations, setIsLoadingLocations] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('season');
  const [filterPitchType, setFilterPitchType] = useState<number | null>(null);
  const [resultFilter, setResultFilter] = useState<ResultFilter>('all');
  
  // Default season range: Jan 1 to Dec 31 of current year
  const currentYear = new Date().getFullYear();
  const [seasonStart, setSeasonStart] = useState<Date>(new Date(currentYear, 0, 1));
  const [seasonEnd, setSeasonEnd] = useState<Date>(new Date());
  const [totalWorkoutsCompleted, setTotalWorkoutsCompleted] = useState(0);
  const [teamPitchers, setTeamPitchers] = useState<PitcherRecord[]>([]);
  const [leaderboardDates, setLeaderboardDates] = useState<{ from?: Date; to?: Date }>({});
  const [coachWorkoutCount, setCoachWorkoutCount] = useState(0);
  const [coachLeaderboardDates, setCoachLeaderboardDates] = useState<{ from?: Date; to?: Date }>({});
  const [games, setGames] = useState<GameDashboardRow[]>([]);
  const { toast } = useToast();
  const coachTeamId = useMemo(() => teamId ?? pitchers?.find((p) => p.teamId)?.teamId ?? null, [teamId, pitchers]);

  // Fetch total workout completions for the season (parent mode)
  useEffect(() => {
    if (!parentMode) return;
    const pitcherNames = [...new Set(outings.map(o => o.pitcherName))];
    if (pitcherNames.length === 0) return;

    async function fetchWorkoutCount() {
      try {
        // Get pitcher IDs from names
        const { data: pitchers } = await supabase
          .from('pitchers')
          .select('id')
          .in('name', pitcherNames);

        if (!pitchers || pitchers.length === 0) return;

        const ids = pitchers.map(p => p.id);
        const { count, error } = await supabase
          .from('workout_completions')
          .select('*', { count: 'exact', head: true })
          .in('pitcher_id', ids);

        if (!error && count !== null) {
          setTotalWorkoutsCompleted(count);
        }
      } catch (err) {
        console.error('Error fetching workout count:', err);
        toast({
          title: 'Could not load workout count',
          description: 'Some dashboard stats may be incomplete.',
          variant: 'destructive',
        });
      }
    }

    fetchWorkoutCount();
  }, [parentMode, outings, toast]);

  // Fetch team pitchers and leaderboard dates for parent mode
  useEffect(() => {
    if (!parentMode || !teamId) return;

    async function fetchTeamPitchersAndDates() {
      try {
        const [pitchersRes, teamRes] = await Promise.all([
          supabase.from('pitchers').select('*').eq('team_id', teamId),
          supabase.from('teams').select('leaderboard_from, leaderboard_to, owner_id').eq('id', teamId).maybeSingle(),
        ]);

        if (pitchersRes.data && pitchersRes.data.length > 0) {
          // Pitchers have team_id set — use them directly
          setTeamPitchers(pitchersRes.data.map(p => ({
            id: p.id,
            name: p.name,
            maxWeeklyPitches: p.max_weekly_pitches,
            pitchTypes: p.pitch_types as PitcherRecord['pitchTypes'],
            teamId: p.team_id,
            userId: p.user_id,
            createdAt: p.created_at,
            updatedAt: p.updated_at,
            effortRating: p.effort_rating === 'minus' || p.effort_rating === 'even' || p.effort_rating === 'plus' ? p.effort_rating : null,
            coachabilityRating: p.coachability_rating === 'minus' || p.coachability_rating === 'even' || p.coachability_rating === 'plus' ? p.coachability_rating : null,
            baseballIqRating: p.baseball_iq_rating === 'minus' || p.baseball_iq_rating === 'even' || p.baseball_iq_rating === 'plus' ? p.baseball_iq_rating : null,
          })));
        } else {
          // Fallback: pitchers predate team_id — look them up by name from outings
          const pitcherNames = [...new Set(outings.map(o => o.pitcherName))];
          if (pitcherNames.length > 0) {
            const { data: fallbackPitchers } = await supabase
              .from('pitchers')
              .select('*')
              .in('name', pitcherNames);

            if (fallbackPitchers && fallbackPitchers.length > 0) {
              setTeamPitchers(fallbackPitchers.map(p => ({
                id: p.id,
                name: p.name,
                maxWeeklyPitches: p.max_weekly_pitches,
                pitchTypes: p.pitch_types as PitcherRecord['pitchTypes'],
                teamId: p.team_id,
                userId: p.user_id,
                createdAt: p.created_at,
                updatedAt: p.updated_at,
                  effortRating: p.effort_rating === 'minus' || p.effort_rating === 'even' || p.effort_rating === 'plus' ? p.effort_rating : null,
                  coachabilityRating: p.coachability_rating === 'minus' || p.coachability_rating === 'even' || p.coachability_rating === 'plus' ? p.coachability_rating : null,
                  baseballIqRating: p.baseball_iq_rating === 'minus' || p.baseball_iq_rating === 'even' || p.baseball_iq_rating === 'plus' ? p.baseball_iq_rating : null,
              })));
            }
          }
        }

        if (teamRes.data) {
          let lbFrom = teamRes.data.leaderboard_from;
          let lbTo = teamRes.data.leaderboard_to;

          // Fallback to dashboard_settings if team dates aren't set
          if ((!lbFrom || !lbTo) && teamRes.data.owner_id) {
            const { data: settings } = await supabase
              .from('dashboard_settings')
              .select('leaderboard_from, leaderboard_to')
              .eq('user_id', teamRes.data.owner_id)
              .maybeSingle();
            if (settings) {
              lbFrom = lbFrom || settings.leaderboard_from;
              lbTo = lbTo || settings.leaderboard_to;
            }
          }

          setLeaderboardDates({
            from: lbFrom ? new Date(lbFrom + 'T00:00:00') : undefined,
            to: lbTo ? new Date(lbTo + 'T00:00:00') : undefined,
          });
        }
      } catch (err) {
        console.error('Error fetching team pitchers:', err);
        toast({
          title: 'Could not load team roster',
          description: 'The team leaderboard may be empty until you retry.',
          variant: 'destructive',
        });
      }
    }

    fetchTeamPitchersAndDates();
  }, [parentMode, teamId, outings, toast]);

  // Fetch workout count + leaderboard dates for coach (non-parent) view
  useEffect(() => {
    if (parentMode || !pitchers || pitchers.length === 0) return;

    async function fetchCoachWorkoutData() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const ids = pitchers!.map((p) => p.id);
        const [countRes, settingsRes] = await Promise.all([
          supabase.from('workout_completions').select('*', { count: 'exact', head: true }).in('pitcher_id', ids),
          supabase.from('dashboard_settings').select('leaderboard_from, leaderboard_to').eq('user_id', user.id).maybeSingle(),
        ]);

        if (!countRes.error && countRes.count !== null) setCoachWorkoutCount(countRes.count);

        if (settingsRes.data) {
          const { leaderboard_from, leaderboard_to } = settingsRes.data;
          setCoachLeaderboardDates({
            from: leaderboard_from ? new Date(leaderboard_from + 'T00:00:00') : undefined,
            to: leaderboard_to ? new Date(leaderboard_to + 'T00:00:00') : undefined,
          });
        }
      } catch (err) {
        console.error('Error fetching coach workout data:', err);
        toast({
          title: 'Could not load workout summary',
          description: 'Some dashboard stats may be incomplete.',
          variant: 'destructive',
        });
      }
    }

    fetchCoachWorkoutData();
  }, [parentMode, pitchers, toast]);

  useEffect(() => {
    if (parentMode || !coachTeamId) return;
    let cancelled = false;

    async function fetchCoachGames() {
      const { data, error } = await supabase
        .from('games')
        .select('id, date, opponent_name, status, team_id, user_id')
        .eq('team_id', coachTeamId)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });

      if (cancelled) return;
      if (error) {
        console.error('Error fetching games:', error);
        return;
      }
      setGames((data || []) as GameDashboardRow[]);
    }

    fetchCoachGames();
    return () => { cancelled = true; };
  }, [parentMode, coachTeamId]);

  // Calculate date range based on view mode
  const dateRange = useMemo(() => {
    if (viewMode === '7-day') {
      const today = new Date();
      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(today.getDate() - 7);
      return {
        start: sevenDaysAgo.toISOString().split('T')[0],
        end: today.toISOString().split('T')[0],
      };
    } else {
      return {
        start: seasonStart.toISOString().split('T')[0],
        end: seasonEnd.toISOString().split('T')[0],
      };
    }
  }, [viewMode, seasonStart, seasonEnd]);

  // Calculate previous 7-day range for trend comparison
  const previousDateRange = useMemo(() => {
    const today = new Date();
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 7);
    const fourteenDaysAgo = new Date(today);
    fourteenDaysAgo.setDate(today.getDate() - 14);
    return {
      start: fourteenDaysAgo.toISOString().split('T')[0],
      end: sevenDaysAgo.toISOString().split('T')[0],
    };
  }, []);

  // Filter outings based on date range
  const filteredOutings = useMemo(() => {
    const startDate = new Date(dateRange.start);
    const endDate = new Date(dateRange.end);
    endDate.setHours(23, 59, 59, 999);
    
    return outings.filter((o) => {
      const outingDate = new Date(o.date);
      return outingDate >= startDate && outingDate <= endDate;
    });
  }, [outings, dateRange]);

  // Filter outings for previous 7-day period (for trend comparison)
  const previousOutings = useMemo(() => {
    const startDate = new Date(previousDateRange.start);
    const endDate = new Date(previousDateRange.end);
    endDate.setHours(23, 59, 59, 999);
    
    return outings.filter((o) => {
      const outingDate = new Date(o.date);
      return outingDate >= startDate && outingDate <= endDate;
    });
  }, [outings, previousDateRange]);

  // Fetch all pitch locations for the selected date range
  useEffect(() => {
    const fetchAllLocations = async () => {
      setIsLoadingLocations(true);
      try {
        // Paginate to avoid Supabase's 1000-row default limit
        const allRows: PitchLocationRow[] = [];
        const PAGE_SIZE = 1000;
        let from = 0;
        let hasMore = true;

        while (hasMore) {
          const { data, error } = await supabase
            .from('pitch_locations')
            .select('*')
            .gte('created_at', `${dateRange.start}T00:00:00`)
            .lte('created_at', `${dateRange.end}T23:59:59`)
            .range(from, from + PAGE_SIZE - 1);

          if (error) throw error;
          allRows.push(...(data || []));
          hasMore = (data?.length ?? 0) === PAGE_SIZE;
          from += PAGE_SIZE;
        }

        const locations: PitchLocation[] = allRows.map((row) => ({
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
        setPitchLocations(locations);
      } catch (error) {
        console.error('Error fetching pitch locations:', error);
      } finally {
        setIsLoadingLocations(false);
      }
    };

    fetchAllLocations();
  }, [dateRange]);

  const handleDateRangeChange = (start: Date, end: Date) => {
    setSeasonStart(start);
    setSeasonEnd(end);
  };

  // Helper to calculate stats for a set of outings
  const calculateStats = (outingsList: Outing[]) => {
    const totalPitches = outingsList.reduce((sum, o) => sum + o.pitchCount, 0);
    
    const outingsWithStrikes = outingsList.filter((o) => o.strikes !== null && o.strikes !== undefined);
    const totalStrikes = outingsWithStrikes.reduce((sum, o) => sum + (o.strikes || 0), 0);
    const totalPitchesWithStrikes = outingsWithStrikes.reduce((sum, o) => sum + o.pitchCount, 0);
    const strikePercentage = totalPitchesWithStrikes > 0 
      ? Math.round((totalStrikes / totalPitchesWithStrikes) * 100) 
      : null;

    const velocities = outingsList
      .filter((o) => o.maxVelo && o.maxVelo > 0)
      .map((o) => o.maxVelo!);

    const eventBreakdown: Record<string, { count: number; pitches: number }> = {};
    outingsList.forEach((o) => {
      if (!eventBreakdown[o.eventType]) {
        eventBreakdown[o.eventType] = { count: 0, pitches: 0 };
      }
      eventBreakdown[o.eventType].count++;
      eventBreakdown[o.eventType].pitches += o.pitchCount;
    });

    const uniquePitchers = new Set(outingsList.map((o) => o.pitcherName)).size;

    return {
      totalPitches,
      strikePercentage,
      velocities,
      totalOutings: outingsList.length,
      uniquePitchers,
      eventBreakdown,
    };
  };

  // Calculate aggregate stats for current period
  const stats = useMemo(() => calculateStats(filteredOutings), [filteredOutings]);

  // Per-pitcher strike % data for radar chart
  const pitcherRadarData = useMemo(() => {
    const pitcherNames = [...new Set(filteredOutings.map((o) => o.pitcherName))];
    return pitcherNames.map((name) => {
      const pOutings = filteredOutings.filter((o) => o.pitcherName === name);
      const withStrikes = pOutings.filter((o) => o.strikes !== null);
      const strikePitches = withStrikes.reduce((s, o) => s + o.pitchCount, 0);
      const totalStrikes = withStrikes.reduce((s, o) => s + (o.strikes ?? 0), 0);
      const strikePercent = strikePitches > 0 ? (totalStrikes / strikePitches) * 100 : 0;
      return { id: name, name, strikePercent, strikePitches, totalStrikes };
    });
  }, [filteredOutings]);

  // Calculate stats for previous 7-day period (for trend comparison)
  const previousStats = useMemo(() => calculateStats(previousOutings), [previousOutings]);

  // Calculate trend indicators (only shown in 7-day view)
  const trends = useMemo(() => {
    const getTrend = (current: number | null, previous: number | null): 'up' | 'down' | 'neutral' => {
      if (current === null || previous === null || previous === 0) return 'neutral';
      if (current > previous) return 'up';
      if (current < previous) return 'down';
      return 'neutral';
    };

    const currentGameOutings = filteredOutings.filter((o) => o.eventType === 'Game');
    const prevGameOutings = previousOutings.filter((o) => o.eventType === 'Game');
    const calcGameStrikePct = (list: Outing[]): number | null => {
      const withStrikes = list.filter((o) => o.strikes !== null && o.strikes !== undefined);
      const pitches = withStrikes.reduce((s, o) => s + o.pitchCount, 0);
      const strikes = withStrikes.reduce((s, o) => s + (o.strikes ?? 0), 0);
      return pitches > 0 ? Math.round((strikes / pitches) * 100) : null;
    };
    const currentGameStrikePct = calcGameStrikePct(currentGameOutings);
    const previousGameStrikePct = calcGameStrikePct(prevGameOutings);

    return {
      pitches: getTrend(stats.totalPitches, previousStats.totalPitches),
      pitchesDiff: stats.totalPitches - previousStats.totalPitches,
      strikePercentage: getTrend(stats.strikePercentage, previousStats.strikePercentage),
      strikePercentageDiff: (stats.strikePercentage ?? 0) - (previousStats.strikePercentage ?? 0),
      outings: getTrend(stats.totalOutings, previousStats.totalOutings),
      outingsDiff: stats.totalOutings - previousStats.totalOutings,
      gameStrikePercentage: getTrend(currentGameStrikePct, previousGameStrikePct),
      gameStrikePercentageDiff: (currentGameStrikePct ?? 0) - (previousGameStrikePct ?? 0),
      currentGameStrikePct,
      previousGameStrikePct,
    };
  }, [stats, previousStats, filteredOutings, previousOutings]);


  const gamesStats = useMemo(() => {
    const start = parseLocalDateAtNoon(dateRange.start);
    const end = parseLocalDateAtNoon(dateRange.end);
    const inRange = (date: string) => {
      const d = parseLocalDateAtNoon(date);
      return d >= start && d <= end;
    };

    const gamesInRange = games.filter((game) => inRange(game.date));
    const knownGameDates = new Set(gamesInRange.map((game) => game.date));
    const gameOutings = filteredOutings.filter((outing) => outing.eventType === 'Game');
    const outingOnlyGames: GameDashboardRow[] = [...new Set(gameOutings.map((outing) => outing.date))]
      .filter((date) => !knownGameDates.has(date))
      .map((date) => ({ id: `outing-${date}`, date, opponent_name: null, status: 'completed', team_id: coachTeamId, user_id: null }));

    const displayGames = [...gamesInRange, ...outingOnlyGames]
      .sort((a, b) => parseLocalDateAtNoon(b.date).getTime() - parseLocalDateAtNoon(a.date).getTime());

    const totalGamePitches = gameOutings.reduce((sum, outing) => sum + outing.pitchCount, 0);
    const gameOutingsWithStrikes = gameOutings.filter((outing) => outing.strikes !== null);
    const pitchesWithStrikes = gameOutingsWithStrikes.reduce((sum, outing) => sum + outing.pitchCount, 0);
    const strikes = gameOutingsWithStrikes.reduce((sum, outing) => sum + (outing.strikes ?? 0), 0);

    const byPitcher = new Map<string, number>();
    gameOutings.forEach((outing) => {
      byPitcher.set(outing.pitcherName, (byPitcher.get(outing.pitcherName) ?? 0) + outing.pitchCount);
    });

    const pitcherNames = (pitchers?.map((pitcher) => pitcher.name) ?? [...new Set(filteredOutings.map((outing) => outing.pitcherName))])
      .sort((a, b) => a.localeCompare(b));
    const recentGames = displayGames.slice(0, 5);

    const gameSummaries = displayGames.map((game) => {
      const outingsForGame = gameOutings.filter((o) => o.date === game.date);
      const pitches = outingsForGame.reduce((sum, o) => sum + o.pitchCount, 0);
      const withStrikes = outingsForGame.filter((o) => o.strikes !== null);
      const sPitches = withStrikes.reduce((sum, o) => sum + o.pitchCount, 0);
      const sStrikes = withStrikes.reduce((sum, o) => sum + (o.strikes ?? 0), 0);
      const topVelo = outingsForGame.reduce((max, o) => Math.max(max, o.maxVelo ?? 0), 0);
      const pitcherCount = new Set(outingsForGame.map((o) => o.pitcherName)).size;
      return {
        id: game.id,
        date: game.date,
        opponent: game.opponent_name,
        pitches,
        strikePct: sPitches > 0 ? Math.round((sStrikes / sPitches) * 100) : null,
        pitcherCount,
        topVelo,
      };
    });

    const matrix = pitcherNames.map((name) => ({
      name,
      total: recentGames.reduce((sum, game) => sum + gameOutings
        .filter((outing) => outing.date === game.date && outing.pitcherName === name)
        .reduce((pitchSum, outing) => pitchSum + outing.pitchCount, 0), 0),
      cells: recentGames.map((game) => ({
        gameId: game.id,
        date: game.date,
        pitches: gameOutings
          .filter((outing) => outing.date === game.date && outing.pitcherName === name)
          .reduce((sum, outing) => sum + outing.pitchCount, 0),
      })),
    })).filter((row) => row.total > 0);

    return {
      games: displayGames,
      recentGames,
      gameSummaries,
      totalGamePitches,
      avgPitches: displayGames.length > 0 ? Math.round(totalGamePitches / displayGames.length) : 0,
      strikePercentage: pitchesWithStrikes > 0 ? Math.round((strikes / pitchesWithStrikes) * 100) : null,
      topArms: Array.from(byPitcher.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3),
      matrix,
    };
  }, [coachTeamId, dateRange, filteredOutings, games, pitchers]);

  // Trend arrow component
  const TrendIndicator = ({ trend, diff, suffix = '' }: { trend: 'up' | 'down' | 'neutral'; diff: number; suffix?: string }) => {
    if (trend === 'neutral') return null;

    
    const Icon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
    const colorClass = trend === 'up' ? 'text-success' : trend === 'down' ? 'text-destructive' : 'text-muted-foreground';
    const diffText = diff > 0 ? `+${diff}${suffix}` : `${diff}${suffix}`;
    
    return (
      <div className={`flex items-center gap-0.5 ${colorClass}`}>
        <Icon className="w-3 h-3" />
        <span className="text-[10px] font-medium">{diffText}</span>
      </div>
    );
  };

  // Calculate pitch type breakdown from pitch locations
  const pitchTypeBreakdown = useMemo(() => {
    const breakdown: Record<number, { count: number; strikes: number }> = {};
    
    pitchLocations.forEach((loc) => {
      if (!breakdown[loc.pitchType]) {
        breakdown[loc.pitchType] = { count: 0, strikes: 0 };
      }
      breakdown[loc.pitchType].count++;
      if (loc.isStrike) {
        breakdown[loc.pitchType].strikes++;
      }
    });

    const total = pitchLocations.length;
    
    return Object.entries(breakdown)
      .map(([type, data]) => ({
        type: parseInt(type),
        count: data.count,
        strikes: data.strikes,
        percentage: total > 0 ? Math.round((data.count / total) * 100) : 0,
        strikeRate: data.count > 0 ? Math.round((data.strikes / data.count) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count);
  }, [pitchLocations]);

  // Get label for pitch type (aggregate across all pitchers)
  const getPitchTypeLabel = (typeNum: number): string => {
    // Use default labels for combined view
    return DEFAULT_PITCH_TYPES[typeNum.toString()] || `P${typeNum}`;
  };

  // Filter pitch locations by pitch type and result for the heatmap
  const filteredPitchLocations = useMemo(() => {
    let filtered = pitchLocations;
    
    if (filterPitchType !== null) {
      filtered = filtered.filter(p => p.pitchType === filterPitchType);
    }
    
    if (resultFilter === 'strikes') {
      filtered = filtered.filter(p => p.isStrike);
    } else if (resultFilter === 'balls') {
      filtered = filtered.filter(p => !p.isStrike);
    }
    
    return filtered;
  }, [pitchLocations, filterPitchType, resultFilter]);

  // Overall stats for the filter buttons
  const overallStats = useMemo(() => {
    const baseLocations = filterPitchType !== null 
      ? pitchLocations.filter(p => p.pitchType === filterPitchType)
      : pitchLocations;
    const strikes = baseLocations.filter(p => p.isStrike).length;
    return {
      total: baseLocations.length,
      strikes,
      balls: baseLocations.length - strikes,
    };
  }, [pitchLocations, filterPitchType]);

  const formatGameDate = (date: string) => parseLocalDateAtNoon(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const getPitchLoadClass = (pitches: number) => {
    if (pitches >= 76) return 'bg-status-danger/25 text-status-danger border-status-danger/30';
    if (pitches >= 61) return 'bg-status-warning/25 text-status-warning border-status-warning/30';
    if (pitches >= 46) return 'bg-status-caution/25 text-status-caution border-status-caution/30';
    if (pitches >= 31) return 'bg-muted text-foreground border-border';
    return 'bg-secondary/70 text-muted-foreground border-border/60';
  };

  // Time toggle pills component - matches Players view design
  const TimeTogglePills = () => (
    <div className="flex items-center bg-secondary rounded-lg p-1 w-fit">
      <Button
        variant="ghost"
        size="sm"
        className={`h-8 px-4 text-sm font-medium ${viewMode === '7-day' ? 'bg-card shadow-sm' : ''}`}
        onClick={() => setViewMode('7-day')}
      >
        7-Day
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className={`h-8 px-4 text-sm font-medium ${viewMode === 'season' ? 'bg-card shadow-sm' : ''}`}
        onClick={() => setViewMode('season')}
      >
        Season
      </Button>
    </div>
  );

  if (filteredOutings.length === 0) {
    return (
      <div className="space-y-6 animate-slide-up overflow-x-hidden">
        {/* Header with Time Toggle on right */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-bold text-foreground">
              Team Dashboard
            </h2>
            <p className="text-muted-foreground">
              No outings in the selected {viewMode === '7-day' ? '7 days' : 'date range'}
            </p>
          </div>
          {!parentMode && (
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              {viewMode === 'season' && (
                <DateRangePicker
                  startDate={seasonStart}
                  endDate={seasonEnd}
                  onRangeChange={handleDateRangeChange}
                />
              )}
              <TimeTogglePills />
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-slide-up overflow-x-hidden">
      {/* Header with Time Toggle on right - matches Players view */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-bold text-foreground">
            Team Dashboard
          </h2>
          <p className="text-muted-foreground">
            {stats.uniquePitchers} pitcher{stats.uniquePitchers !== 1 ? 's' : ''} • {stats.totalOutings} outing{stats.totalOutings !== 1 ? 's' : ''} • {stats.totalPitches} total pitches
          </p>
        </div>
        {!parentMode && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            {viewMode === 'season' && (
              <DateRangePicker
                startDate={seasonStart}
                endDate={seasonEnd}
                onRangeChange={handleDateRangeChange}
              />
            )}
            <TimeTogglePills />
          </div>
        )}
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Pitches */}
        <Card className="glass-card">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 rounded-lg bg-primary/10 shrink-0">
                <Activity className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-[10px] sm:text-xs text-muted-foreground">Total Pitches</p>
                  <TrendIndicator trend={trends.pitches} diff={trends.pitchesDiff} />
                </div>
                <p className="text-lg sm:text-2xl font-bold text-foreground">{stats.totalPitches}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Game Strike % — from Game outings only */}
        <Card className="glass-card">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 rounded-lg bg-warning/10 shrink-0">
                <Crosshair className="w-4 h-4 sm:w-5 sm:h-5 text-warning" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-[10px] sm:text-xs text-muted-foreground">Game Strike %</p>
                  {gamesStats.strikePercentage !== null && (
                    <TrendIndicator trend={trends.gameStrikePercentage} diff={trends.gameStrikePercentageDiff} suffix="%" />
                  )}
                </div>
                <p className="text-lg sm:text-2xl font-bold text-foreground">
                  {gamesStats.strikePercentage !== null ? `${gamesStats.strikePercentage}%` : '—'}
                </p>
              </div>

            </div>
          </CardContent>
        </Card>

        {/* Total Strike % — across all sessions */}
        <Card className="glass-card">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 rounded-lg bg-success/10 shrink-0">
                <Target className="w-4 h-4 sm:w-5 sm:h-5 text-success" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-[10px] sm:text-xs text-muted-foreground">Total Strike %</p>
                  {stats.strikePercentage !== null && (
                    <TrendIndicator trend={trends.strikePercentage} diff={trends.strikePercentageDiff} suffix="%" />
                  )}
                </div>
                <p className="text-lg sm:text-2xl font-bold text-foreground">
                  {stats.strikePercentage !== null ? `${stats.strikePercentage}%` : '—'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Total Outings */}
        <Card className="glass-card">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 rounded-lg bg-accent/10 shrink-0">
                <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-accent-foreground" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-[10px] sm:text-xs text-muted-foreground">Sessions</p>
                  <TrendIndicator trend={trends.outings} diff={trends.outingsDiff} />
                </div>
                <p className="text-lg sm:text-2xl font-bold text-foreground">{stats.totalOutings}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {!parentMode && gamesStats.games.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="font-display text-xl font-bold text-foreground">Games</h3>
              <p className="text-xs text-muted-foreground">Game outings in the selected range</p>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link to="/games" className="gap-2">
                <ListChecks className="w-4 h-4" /> Review
              </Link>
            </Button>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <Card className="glass-card">
              <CardContent className="p-3 sm:p-4">
                <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider">Games</p>
                <p className="text-xl sm:text-2xl font-bold text-foreground">{gamesStats.games.length}</p>
              </CardContent>
            </Card>
            <Card className="glass-card">
              <CardContent className="p-3 sm:p-4">
                <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider">Avg Pitches</p>
                <p className="text-xl sm:text-2xl font-bold text-foreground">{gamesStats.avgPitches}</p>
              </CardContent>
            </Card>
            <Card className="glass-card">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center gap-1.5">
                  <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider">Game Strike %</p>
                  {gamesStats.strikePercentage !== null && (
                    <TrendIndicator trend={trends.gameStrikePercentage} diff={trends.gameStrikePercentageDiff} suffix="%" />
                  )}
                </div>
                <p className="text-xl sm:text-2xl font-bold text-foreground">{gamesStats.strikePercentage !== null ? `${gamesStats.strikePercentage}%` : '—'}</p>
              </CardContent>
            </Card>
            <Card className="glass-card">
              <CardContent className="p-3 sm:p-4">
                <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider">Most Used</p>
                <p className="text-sm sm:text-base font-semibold text-foreground truncate">{gamesStats.topArms[0]?.[0] ?? '—'}</p>
                {gamesStats.topArms[0] && <p className="text-xs text-muted-foreground">{gamesStats.topArms[0][1]} pitches</p>}
              </CardContent>
            </Card>
          </div>

          {gamesStats.gameSummaries.length > 0 && (
            <Card className="glass-card">
              <CardHeader className="pb-2 px-3 sm:px-6">
                <CardTitle className="font-display text-base sm:text-lg">Game-by-Game</CardTitle>
              </CardHeader>
              <CardContent className="px-3 sm:px-6">
                <div className="overflow-x-auto">
                  <div className="min-w-[520px] space-y-1">
                    <div className="grid grid-cols-[minmax(80px,0.9fr)_minmax(120px,1.4fr)_repeat(4,minmax(64px,0.7fr))] gap-2 text-[10px] uppercase tracking-wider text-muted-foreground px-2 pb-1 border-b border-border/50">
                      <span>Date</span>
                      <span>Opponent</span>
                      <span className="text-right">Pitches</span>
                      <span className="text-right">Strike %</span>
                      <span className="text-right">Top Velo</span>
                      <span className="text-right">Arms</span>
                    </div>
                    {gamesStats.gameSummaries.map((g) => (
                      <Link
                        key={g.id}
                        to={g.id.startsWith('outing-') ? '/games' : `/games/${g.id}`}
                        className="grid grid-cols-[minmax(80px,0.9fr)_minmax(120px,1.4fr)_repeat(4,minmax(64px,0.7fr))] gap-2 items-center px-2 py-2 rounded-md hover:bg-muted/40 transition-colors"
                      >
                        <span className="text-sm font-medium text-foreground">{formatGameDate(g.date)}</span>
                        <span className="text-sm text-foreground truncate">{g.opponent || <span className="text-muted-foreground italic">—</span>}</span>
                        <span className="text-right text-sm font-semibold text-foreground tabular-nums">{g.pitches || '—'}</span>
                        <span className="text-right text-sm font-semibold tabular-nums">
                          {g.strikePct !== null ? (
                            <span className={g.strikePct >= 60 ? 'text-success' : g.strikePct >= 50 ? 'text-foreground' : 'text-destructive'}>
                              {g.strikePct}%
                            </span>
                          ) : <span className="text-muted-foreground">—</span>}
                        </span>
                        <span className="text-right text-sm text-foreground tabular-nums">{g.topVelo > 0 ? g.topVelo : <span className="text-muted-foreground">—</span>}</span>
                        <span className="text-right text-sm text-muted-foreground tabular-nums">{g.pitcherCount || '—'}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {gamesStats.matrix.length > 0 && (
            <Card className="glass-card">
              <CardHeader className="pb-2 px-3 sm:px-6">
                <CardTitle className="font-display text-base sm:text-lg">Pitcher × Last 5 Games</CardTitle>
              </CardHeader>
              <CardContent className="px-3 sm:px-6">
                <div className="overflow-x-auto">
                  <div className="min-w-[560px] space-y-2">
                    <div className="grid grid-cols-[minmax(130px,1.2fr)_repeat(5,minmax(68px,0.7fr))_64px] gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                      <span>Pitcher</span>
                      {gamesStats.recentGames.map((game) => (
                        <span key={game.id} className="text-center truncate">{formatGameDate(game.date)}</span>
                      ))}
                      {Array.from({ length: Math.max(0, 5 - gamesStats.recentGames.length) }).map((_, idx) => <span key={`blank-head-${idx}`} />)}
                      <span className="text-right">Total</span>
                    </div>
                    {gamesStats.matrix.map((row) => (
                      <div key={row.name} className="grid grid-cols-[minmax(130px,1.2fr)_repeat(5,minmax(68px,0.7fr))_64px] gap-2 items-center">
                        <span className="text-sm font-medium text-foreground truncate">{row.name}</span>
                        {row.cells.map((cell) => (
                          <span key={`${row.name}-${cell.gameId}`} className={`h-8 rounded-md border flex items-center justify-center text-xs font-semibold ${getPitchLoadClass(cell.pitches)}`}>
                            {cell.pitches || '—'}
                          </span>
                        ))}
                        {Array.from({ length: Math.max(0, 5 - row.cells.length) }).map((_, idx) => <span key={`${row.name}-blank-${idx}`} className="h-8" />)}
                        <span className="text-right text-sm font-semibold text-foreground">{row.total}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </section>
      )}

      {/* Velocity & Strike % Side by Side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        {stats.velocities.length > 0 && (
          <VelocityScale velocities={stats.velocities} />
        )}
        <StrikePercentBar pitcherSeasons={pitcherRadarData} outings={filteredOutings.map(o => ({ date: o.date, strikes: o.strikes, pitch_count: o.pitchCount }))} />
      </div>


      {/* Two Column Layout — Coach: 3 cols | Parent: 2 cols */}

      {/* Coach view splits the dense analytics + insights into tabs so the
          team tab opens with one focus area at a time. */}
      {!parentMode && (
        <Tabs defaultValue="trends" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="trends">Trends</TabsTrigger>
            <TabsTrigger value="health-report">Health Report</TabsTrigger>
          </TabsList>
          <TabsContent value="trends" className="mt-4">
      {/* Coach grid: Heatmap | Pitch Mix + Session Breakdown stacked. Workouts
          render in their own row below so they don't leave a placeholder gap
          when the workouts toggle is off. */}
      {!parentMode && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Col 1: Heatmap */}
          <Card className="glass-card">
            <CardHeader className="pb-2 px-3 sm:px-6">
              <CardTitle className="font-display text-base sm:text-lg flex items-center gap-2">
                <Flame className="w-4 h-4 sm:w-5 sm:h-5 text-orange-500" />
                Combined Strike Zone
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 px-2 sm:px-6">
              {pitchTypeBreakdown.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Pitch Type</p>
                  <div className="flex flex-wrap gap-1.5">
                    <Button variant={filterPitchType === null ? 'default' : 'outline'} size="sm" onClick={() => setFilterPitchType(null)} className="text-xs h-7 px-2.5">All</Button>
                    {pitchTypeBreakdown.map((pitch) => (
                      <Button key={pitch.type} variant={filterPitchType === pitch.type ? 'default' : 'outline'} size="sm" onClick={() => setFilterPitchType(filterPitchType === pitch.type ? null : pitch.type)} className="text-xs h-7 px-2.5 gap-1.5">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: PITCH_TYPE_COLORS[pitch.type.toString()] }} />
                        {getPitchTypeLabel(pitch.type)}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
              {pitchLocations.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Show:</span>
                  <div className="flex gap-1">
                    <Button variant={resultFilter === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setResultFilter('all')} className="text-xs h-7 px-2.5">All ({overallStats.total})</Button>
                    <Button variant={resultFilter === 'strikes' ? 'default' : 'outline'} size="sm" onClick={() => setResultFilter('strikes')} className="text-xs h-7 px-2.5">Strikes ({overallStats.strikes})</Button>
                    <Button variant={resultFilter === 'balls' ? 'default' : 'outline'} size="sm" onClick={() => setResultFilter('balls')} className="text-xs h-7 px-2.5">Balls ({overallStats.balls})</Button>
                  </div>
                </div>
              )}
              <div className="flex justify-center">
                {isLoadingLocations ? (
                  <div className="w-full max-w-[300px] aspect-[300/388] flex items-center justify-center"><p className="text-muted-foreground animate-pulse">Loading...</p></div>
                ) : pitchLocations.length > 0 ? (
                  <div className="w-full max-w-[300px]"><SmoothHeatmap pitchLocations={filteredPitchLocations} size="md" /></div>
                ) : (
                  <div className="w-full max-w-[300px] aspect-[300/388] flex items-center justify-center border border-dashed border-muted-foreground/30 rounded-lg"><p className="text-muted-foreground text-sm text-center px-4">No pitch location data</p></div>
                )}
              </div>
              {pitchLocations.length > 0 && stats.totalPitches > pitchLocations.length && (
                <p className="text-[10px] text-muted-foreground text-center">{pitchLocations.length.toLocaleString()} of {stats.totalPitches.toLocaleString()} pitches have location data ({Math.round((pitchLocations.length / stats.totalPitches) * 100)}% charted)</p>
              )}
              {pitchLocations.length > 0 && (filterPitchType !== null || resultFilter !== 'all') && (
                <div className="text-center text-xs text-muted-foreground border-t border-border/50 pt-2">
                  Showing <span className="font-medium text-foreground">{filteredPitchLocations.length}</span> pitches
                  {filterPitchType !== null && <span> • {getPitchTypeLabel(filterPitchType)}</span>}
                  {resultFilter !== 'all' && <span> • {resultFilter === 'strikes' ? 'Strikes only' : 'Balls only'}</span>}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Cols 2-3: Pitch Mix + Session Breakdown stacked */}
          <div className="lg:col-span-2 flex flex-col gap-4 sm:gap-6">
            {pitchTypeBreakdown.length > 0 && (
              <Card className="glass-card">
                <CardHeader className="pb-2 px-3 sm:px-6">
                  <CardTitle className="font-display text-base sm:text-lg">Pitch Mix</CardTitle>
                </CardHeader>
                <CardContent className="px-3 sm:px-6">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2.5">
                    {pitchTypeBreakdown.map((pitch) => (
                      <div key={pitch.type} className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: PITCH_TYPE_COLORS[pitch.type.toString()] || 'hsl(var(--muted))' }} />
                          <span className="text-xs text-foreground font-medium truncate">{getPitchTypeLabel(pitch.type)}</span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[10px] text-muted-foreground">{pitch.count} ({pitch.percentage}%)</span>
                          <span className={`text-[10px] font-medium ${pitch.strikeRate >= 60 ? 'text-success' : pitch.strikeRate < 50 ? 'text-destructive' : 'text-warning'}`}>{pitch.strikeRate}% K</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
            {Object.keys(stats.eventBreakdown).length > 0 && (
              <Card className="glass-card">
                <CardHeader className="pb-2 px-3 sm:px-6">
                  <CardTitle className="font-display text-base sm:text-lg">Session Breakdown</CardTitle>
                </CardHeader>
                <CardContent className="px-3 sm:px-6">
                  <div className="space-y-2.5 sm:space-y-3">
                    {Object.entries(stats.eventBreakdown)
                      .sort(([, a], [, b]) => b.pitches - a.pitches)
                      .map(([eventType, data]) => (
                        <div key={eventType} className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-sm shrink-0" style={{ backgroundColor: EVENT_COLORS[eventType] || 'hsl(var(--muted))' }} />
                            <span className="text-xs sm:text-sm text-foreground truncate">{eventType}</span>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-xs sm:text-sm font-medium text-foreground">{data.pitches}</span>
                            <span className="text-[10px] sm:text-xs text-muted-foreground ml-1">({data.count})</span>
                          </div>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* Workouts row — rendered below the analytics grid so an off toggle
          doesn't leave a placeholder cell with white space. */}
      {!parentMode && showWorkoutLeaderboard && pitchers && pitchers.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          <Card className="glass-card border-accent/30 bg-accent/5">
            <CardContent className="p-4 sm:p-6 flex flex-col items-center justify-center h-full gap-2 text-center">
              <div className="flex flex-col items-center gap-1.5">
                <div className="p-2.5 rounded-lg bg-accent/10">
                  <Dumbbell className="w-6 h-6 text-accent" />
                </div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Season Workouts</p>
              </div>
              <p className="text-4xl font-bold text-foreground">{coachWorkoutCount}</p>
              <p className="text-xs text-muted-foreground">completions across all players</p>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardContent className="p-2 sm:p-3">
              <div className="flex items-center gap-2 mb-2">
                <Trophy className="w-4 h-4 text-yellow-500" />
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Workout Leaderboard</p>
              </div>
              <WorkoutLeaderboard
                pitchers={pitchers}
                initialFrom={coachLeaderboardDates.from}
                initialTo={coachLeaderboardDates.to}
                maxEntries={5}
                hideDatePicker
                lockedToCoachDates
                compact
              />
            </CardContent>
          </Card>
        </div>
      )}
          </TabsContent>
          <TabsContent value="health-report" className="mt-4">
            {pitchers && pitchers.length > 0 && (
              <TeamHealthPanel
                pitchers={pitchers}
                outings={outings}
                onRequestUpload={onRequestStatUpload}
              />
            )}
          </TabsContent>
        </Tabs>
      )}

      {/* Parent 2-col: Heatmap | Workout Counter + Leaderboard + Pitch Mix */}
      {parentMode && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {/* Heatmap */}
          <Card className="glass-card">
            <CardHeader className="pb-2 px-3 sm:px-6">
              <CardTitle className="font-display text-base sm:text-lg flex items-center gap-2">
                <Flame className="w-4 h-4 sm:w-5 sm:h-5 text-orange-500" />
                Combined Strike Zone
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 px-2 sm:px-6">
              {pitchTypeBreakdown.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Pitch Type</p>
                  <div className="flex flex-wrap gap-1.5">
                    <Button variant={filterPitchType === null ? 'default' : 'outline'} size="sm" onClick={() => setFilterPitchType(null)} className="text-xs h-7 px-2.5">All</Button>
                    {pitchTypeBreakdown.map((pitch) => (
                      <Button key={pitch.type} variant={filterPitchType === pitch.type ? 'default' : 'outline'} size="sm" onClick={() => setFilterPitchType(filterPitchType === pitch.type ? null : pitch.type)} className="text-xs h-7 px-2.5 gap-1.5">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: PITCH_TYPE_COLORS[pitch.type.toString()] }} />
                        {getPitchTypeLabel(pitch.type)}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
              {pitchLocations.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Show:</span>
                  <div className="flex gap-1">
                    <Button variant={resultFilter === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setResultFilter('all')} className="text-xs h-7 px-2.5">All ({overallStats.total})</Button>
                    <Button variant={resultFilter === 'strikes' ? 'default' : 'outline'} size="sm" onClick={() => setResultFilter('strikes')} className="text-xs h-7 px-2.5">Strikes ({overallStats.strikes})</Button>
                    <Button variant={resultFilter === 'balls' ? 'default' : 'outline'} size="sm" onClick={() => setResultFilter('balls')} className="text-xs h-7 px-2.5">Balls ({overallStats.balls})</Button>
                  </div>
                </div>
              )}
              <div className="flex justify-center">
                {isLoadingLocations ? (
                  <div className="w-full max-w-[300px] aspect-[300/388] flex items-center justify-center"><p className="text-muted-foreground animate-pulse">Loading...</p></div>
                ) : pitchLocations.length > 0 ? (
                  <div className="w-full max-w-[300px]"><SmoothHeatmap pitchLocations={filteredPitchLocations} size="md" /></div>
                ) : (
                  <div className="w-full max-w-[300px] aspect-[300/388] flex items-center justify-center border border-dashed border-muted-foreground/30 rounded-lg"><p className="text-muted-foreground text-sm text-center px-4">No pitch location data</p></div>
                )}
              </div>
              {pitchLocations.length > 0 && stats.totalPitches > pitchLocations.length && (
                <p className="text-[10px] text-muted-foreground text-center">{pitchLocations.length.toLocaleString()} of {stats.totalPitches.toLocaleString()} pitches have location data ({Math.round((pitchLocations.length / stats.totalPitches) * 100)}% charted)</p>
              )}
              {pitchLocations.length > 0 && (filterPitchType !== null || resultFilter !== 'all') && (
                <div className="text-center text-xs text-muted-foreground border-t border-border/50 pt-2">
                  Showing <span className="font-medium text-foreground">{filteredPitchLocations.length}</span> pitches
                  {filterPitchType !== null && <span> • {getPitchTypeLabel(filterPitchType)}</span>}
                  {resultFilter !== 'all' && <span> • {resultFilter === 'strikes' ? 'Strikes only' : 'Balls only'}</span>}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Right Column: Workout Counter, Leaderboard, Pitch Mix */}
          <div className="space-y-4 sm:space-y-6">
            {showWorkoutLeaderboard && totalWorkoutsCompleted > 0 && (
              <Card className="glass-card border-accent/30 bg-accent/5">
                <CardContent className="p-4 sm:p-6 flex items-center gap-4">
                  <div className="p-2.5 rounded-lg bg-accent/10">
                    <Dumbbell className="w-6 h-6 text-accent" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Season Workouts Completed</p>
                    <FlipCounter value={totalWorkoutsCompleted} countUpFrom={Math.max(0, totalWorkoutsCompleted - 5)} />
                  </div>
                </CardContent>
              </Card>
            )}

            {teamPitchers.length > 0 && (
              <Card className="glass-card">
                <CardContent className="p-4 sm:p-6">
                  <div className="flex items-center gap-2 mb-3">
                    <Trophy className="w-4 h-4 text-yellow-500" />
                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Workout Leaderboard</p>
                  </div>
                  <WorkoutLeaderboard
                    pitchers={teamPitchers}
                    initialFrom={leaderboardDates.from}
                    initialTo={leaderboardDates.to}
                    maxEntries={5}
                    hideDatePicker
                    lockedToCoachDates
                    compact
                  />
                </CardContent>
              </Card>
            )}
            {pitchTypeBreakdown.length > 0 && (
              <Card className="glass-card">
                <CardHeader className="pb-2 px-3 sm:px-6">
                  <CardTitle className="font-display text-base sm:text-lg">Pitch Mix</CardTitle>
                </CardHeader>
                <CardContent className="px-3 sm:px-6">
                  <div className="space-y-2.5 sm:space-y-3">
                    {pitchTypeBreakdown.map((pitch) => (
                      <div key={pitch.type} className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full shrink-0" style={{ backgroundColor: PITCH_TYPE_COLORS[pitch.type.toString()] || 'hsl(var(--muted))' }} />
                          <span className="text-xs sm:text-sm text-foreground font-medium truncate">{getPitchTypeLabel(pitch.type)}</span>
                        </div>
                        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                          <span className="text-[10px] sm:text-xs text-muted-foreground">{pitch.count} ({pitch.percentage}%)</span>
                          <span className={`text-[10px] sm:text-xs font-medium ${pitch.strikeRate >= 60 ? 'text-success' : pitch.strikeRate < 50 ? 'text-destructive' : 'text-warning'}`}>{pitch.strikeRate}% K</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* Session Breakdown — full width, parent mode only (coach mode has it inline above) */}
      {parentMode && Object.keys(stats.eventBreakdown).length > 0 && (
        <Card className="glass-card">
          <CardHeader className="pb-2 px-3 sm:px-6">
            <CardTitle className="font-display text-base sm:text-lg">Session Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="px-3 sm:px-6">
            <div className="space-y-2.5 sm:space-y-3">
              {Object.entries(stats.eventBreakdown)
                .sort(([, a], [, b]) => b.pitches - a.pitches)
                .map(([eventType, data]) => (
                  <div key={eventType} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-sm shrink-0" style={{ backgroundColor: EVENT_COLORS[eventType] || 'hsl(var(--muted))' }} />
                      <span className="text-xs sm:text-sm text-foreground truncate">{eventType}</span>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-xs sm:text-sm font-medium text-foreground">{data.pitches}</span>
                      <span className="text-[10px] sm:text-xs text-muted-foreground ml-1">({data.count})</span>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
