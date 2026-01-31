import { useMemo, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Outing } from '@/types/pitcher';
import { PitchLocation, PitchTypeConfig, DEFAULT_PITCH_TYPES, PITCH_TYPE_COLORS } from '@/types/pitch-location';
import { SmoothHeatmap } from '@/components/SmoothHeatmap';
import { VelocityScale } from '@/components/VelocityScale';
import { DateRangePicker } from '@/components/DateRangePicker';
import { supabase } from '@/integrations/supabase/client';
import { Activity, Target, Calendar, Flame, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface CombinedDashboardProps {
  outings: Outing[];
  pitcherPitchTypes: Record<string, PitchTypeConfig>;
}

const EVENT_COLORS: Record<string, string> = {
  'Bullpen': 'hsl(220, 70%, 45%)',
  'Game': 'hsl(142, 70%, 45%)',
  'External': 'hsl(200, 80%, 60%)',
  'Practice': 'hsl(25, 90%, 55%)',
};

type ViewMode = '7-day' | 'season';

export function CombinedDashboard({ outings, pitcherPitchTypes }: CombinedDashboardProps) {
  const [pitchLocations, setPitchLocations] = useState<PitchLocation[]>([]);
  const [isLoadingLocations, setIsLoadingLocations] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('season');
  
  // Default season range: Jan 1 to Dec 31 of current year
  const currentYear = new Date().getFullYear();
  const [seasonStart, setSeasonStart] = useState<Date>(new Date(currentYear, 0, 1));
  const [seasonEnd, setSeasonEnd] = useState<Date>(new Date());

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
        const { data, error } = await supabase
          .from('pitch_locations')
          .select('*')
          .gte('created_at', `${dateRange.start}T00:00:00`)
          .lte('created_at', `${dateRange.end}T23:59:59`);

        if (error) throw error;

        const locations: PitchLocation[] = (data || []).map((row) => ({
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

    return {
      pitches: getTrend(stats.totalPitches, previousStats.totalPitches),
      pitchesDiff: stats.totalPitches - previousStats.totalPitches,
      strikePercentage: getTrend(stats.strikePercentage, previousStats.strikePercentage),
      strikePercentageDiff: (stats.strikePercentage ?? 0) - (previousStats.strikePercentage ?? 0),
      outings: getTrend(stats.totalOutings, previousStats.totalOutings),
      outingsDiff: stats.totalOutings - previousStats.totalOutings,
    };
  }, [stats, previousStats]);

  // Trend arrow component
  const TrendIndicator = ({ trend, diff, suffix = '' }: { trend: 'up' | 'down' | 'neutral'; diff: number; suffix?: string }) => {
    if (viewMode !== '7-day') return null;
    
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
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
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

        {/* Strike % */}
        <Card className="glass-card">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 rounded-lg bg-success/10 shrink-0">
                <Target className="w-4 h-4 sm:w-5 sm:h-5 text-success" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-[10px] sm:text-xs text-muted-foreground">Strike %</p>
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

      {/* Velocity Distribution Chart */}
      {stats.velocities.length > 0 && (
        <VelocityScale velocities={stats.velocities} minRange={45} maxRange={60} />
      )}

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Heatmap */}
        <Card className="glass-card">
          <CardHeader className="pb-2 px-3 sm:px-6">
            <CardTitle className="font-display text-base sm:text-lg flex items-center gap-2">
              <Flame className="w-4 h-4 sm:w-5 sm:h-5 text-orange-500" />
              Combined Strike Zone
            </CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center px-2 sm:px-6">
            {isLoadingLocations ? (
              <div className="w-full max-w-[300px] aspect-[300/388] flex items-center justify-center">
                <p className="text-muted-foreground animate-pulse">Loading...</p>
              </div>
            ) : pitchLocations.length > 0 ? (
              <div className="w-full max-w-[300px]">
                <SmoothHeatmap 
                  pitchLocations={pitchLocations} 
                  size="md"
                />
              </div>
            ) : (
              <div className="w-full max-w-[300px] aspect-[300/388] flex items-center justify-center border border-dashed border-muted-foreground/30 rounded-lg">
                <p className="text-muted-foreground text-sm text-center px-4">No pitch location data</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right Column: Event & Pitch Type Breakdown */}
        <div className="space-y-4 sm:space-y-6">
          {/* Event Type Breakdown */}
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
                        <div 
                          className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-sm shrink-0" 
                          style={{ backgroundColor: EVENT_COLORS[eventType] || 'hsl(var(--muted))' }}
                        />
                        <span className="text-xs sm:text-sm text-foreground truncate">{eventType}</span>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs sm:text-sm font-medium text-foreground">{data.pitches}</span>
                        <span className="text-[10px] sm:text-xs text-muted-foreground ml-1">
                          ({data.count})
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>

          {/* Pitch Type Breakdown */}
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
                        <div 
                          className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full shrink-0" 
                          style={{ backgroundColor: PITCH_TYPE_COLORS[pitch.type.toString()] || 'hsl(var(--muted))' }}
                        />
                        <span className="text-xs sm:text-sm text-foreground font-medium truncate">
                          {getPitchTypeLabel(pitch.type)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                        <span className="text-[10px] sm:text-xs text-muted-foreground">
                          {pitch.count} ({pitch.percentage}%)
                        </span>
                        <span 
                          className={`text-[10px] sm:text-xs font-medium ${
                            pitch.strikeRate >= 60 
                              ? 'text-success' 
                              : pitch.strikeRate < 50 
                                ? 'text-destructive' 
                                : 'text-warning'
                          }`}
                        >
                          {pitch.strikeRate}% K
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
