import { useMemo, useState, useEffect } from 'react';
import { Pitcher, Outing } from '@/types/pitcher';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StrikeZoneHeatmap } from '@/components/StrikeZoneHeatmap';
import { StatusBadge } from '@/components/StatusBadge';
import { PitchLocation, PitchTypeConfig, DEFAULT_PITCH_TYPES } from '@/types/pitch-location';
import { supabase } from '@/integrations/supabase/client';
import { getPulseLevel } from '@/lib/pulse-status';
import { TrendingUp, Target, Zap, Calendar, ChevronRight } from 'lucide-react';

interface SevenDayDashboardProps {
  pitchers: Pitcher[];
  outings: Outing[];
  pitcherMaxPitches: Record<string, number>;
  onPitcherClick: (pitcher: Pitcher) => void;
  onEditRoster: () => void;
}

interface PitcherSevenDayStats {
  pitcher: Pitcher;
  totalPitches: number;
  totalStrikes: number;
  strikePercentage: number;
  maxVelocity: number;
  minVelocity: number;
  outingCount: number;
  outings: Outing[];
  pitchLocations: PitchLocation[];
  pitchTypes: PitchTypeConfig;
}

export function SevenDayDashboard({
  pitchers,
  outings,
  pitcherMaxPitches,
  onPitcherClick,
  onEditRoster,
}: SevenDayDashboardProps) {
  const [pitchLocationsMap, setPitchLocationsMap] = useState<Record<string, PitchLocation[]>>({});
  const [pitchTypesMap, setPitchTypesMap] = useState<Record<string, PitchTypeConfig>>({});
  const [isLoading, setIsLoading] = useState(true);

  // Calculate date range for last 7 days
  const sevenDaysAgo = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() - 7);
    date.setHours(0, 0, 0, 0);
    return date;
  }, []);

  // Filter outings to last 7 days
  const sevenDayOutings = useMemo(() => {
    return outings.filter(outing => new Date(outing.date) >= sevenDaysAgo);
  }, [outings, sevenDaysAgo]);

  // Get unique pitcher IDs who have outings in the last 7 days
  const activePitcherNames = useMemo(() => {
    return [...new Set(sevenDayOutings.map(o => o.pitcherName))];
  }, [sevenDayOutings]);

  // Fetch pitch locations for 7-day outings
  useEffect(() => {
    async function fetchPitchLocations() {
      setIsLoading(true);
      const outingIds = sevenDayOutings.map(o => o.id);
      
      if (outingIds.length === 0) {
        setPitchLocationsMap({});
        setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('pitch_locations')
          .select('*')
          .in('outing_id', outingIds);

        if (error) throw error;

        // Group by pitcher_id
        const locationsMap: Record<string, PitchLocation[]> = {};
        (data || []).forEach(row => {
          const pitcherId = row.pitcher_id;
          if (!locationsMap[pitcherId]) {
            locationsMap[pitcherId] = [];
          }
          locationsMap[pitcherId].push({
            id: row.id,
            outingId: row.outing_id,
            pitcherId: row.pitcher_id,
            pitchNumber: row.pitch_number,
            pitchType: row.pitch_type,
            xLocation: Number(row.x_location),
            yLocation: Number(row.y_location),
            isStrike: row.is_strike,
            createdAt: row.created_at,
          });
        });

        setPitchLocationsMap(locationsMap);
      } catch (err) {
        console.error('Error fetching pitch locations:', err);
      }
      
      setIsLoading(false);
    }

    fetchPitchLocations();
  }, [sevenDayOutings]);

  // Fetch pitch types for active pitchers
  useEffect(() => {
    async function fetchPitchTypes() {
      const activePitchers = pitchers.filter(p => activePitcherNames.includes(p.name));
      const pitcherIds = activePitchers.map(p => p.id);

      if (pitcherIds.length === 0) return;

      try {
        const { data, error } = await supabase
          .from('pitchers')
          .select('id, pitch_types')
          .in('id', pitcherIds);

        if (error) throw error;

        const typesMap: Record<string, PitchTypeConfig> = {};
        (data || []).forEach(row => {
          if (row.pitch_types && typeof row.pitch_types === 'object') {
            typesMap[row.id] = row.pitch_types as PitchTypeConfig;
          } else {
            typesMap[row.id] = DEFAULT_PITCH_TYPES;
          }
        });

        setPitchTypesMap(typesMap);
      } catch (err) {
        console.error('Error fetching pitch types:', err);
      }
    }

    fetchPitchTypes();
  }, [pitchers, activePitcherNames]);

  // Calculate stats for each pitcher with 7-day outings
  const pitcherStats: PitcherSevenDayStats[] = useMemo(() => {
    return pitchers
      .filter(p => activePitcherNames.includes(p.name))
      .map(pitcher => {
        const pitcherOutings = sevenDayOutings.filter(o => o.pitcherName === pitcher.name);
        const totalPitches = pitcherOutings.reduce((sum, o) => sum + o.pitchCount, 0);
        
        // Only count strikes from outings where strikes were tracked
        const outingsWithStrikes = pitcherOutings.filter(o => o.strikes !== null);
        const totalStrikesPitches = outingsWithStrikes.reduce((sum, o) => sum + o.pitchCount, 0);
        const totalStrikes = outingsWithStrikes.reduce((sum, o) => sum + (o.strikes ?? 0), 0);
        const strikePercentage = totalStrikesPitches > 0 
          ? Math.round((totalStrikes / totalStrikesPitches) * 100) 
          : 0;

        // Get velocity range
        const velocities = pitcherOutings.map(o => o.maxVelo).filter(v => v > 0);
        const maxVelocity = velocities.length > 0 ? Math.max(...velocities) : 0;
        const minVelocity = velocities.length > 0 ? Math.min(...velocities) : 0;

        return {
          pitcher,
          totalPitches,
          totalStrikes,
          strikePercentage,
          maxVelocity,
          minVelocity,
          outingCount: pitcherOutings.length,
          outings: pitcherOutings,
          pitchLocations: pitchLocationsMap[pitcher.id] || [],
          pitchTypes: pitchTypesMap[pitcher.id] || DEFAULT_PITCH_TYPES,
        };
      })
      .sort((a, b) => a.pitcher.name.localeCompare(b.pitcher.name));
  }, [pitchers, activePitcherNames, sevenDayOutings, pitchLocationsMap, pitchTypesMap]);

  // Calculate team totals
  const teamTotals = useMemo(() => {
    return pitcherStats.reduce(
      (acc, stats) => ({
        totalPitches: acc.totalPitches + stats.totalPitches,
        totalStrikes: acc.totalStrikes + stats.totalStrikes,
        totalOutings: acc.totalOutings + stats.outingCount,
      }),
      { totalPitches: 0, totalStrikes: 0, totalOutings: 0 }
    );
  }, [pitcherStats]);

  if (isLoading) {
    return (
      <div className="animate-slide-up">
        <div className="mb-6">
          <h2 className="font-display text-2xl font-bold text-foreground">7-Day Dashboard</h2>
          <p className="text-muted-foreground">Loading pitch data...</p>
        </div>
      </div>
    );
  }

  if (pitcherStats.length === 0) {
    return (
      <div className="animate-slide-up">
        <div className="mb-6">
          <h2 className="font-display text-2xl font-bold text-foreground">7-Day Dashboard</h2>
          <p className="text-muted-foreground">No outings recorded in the last 7 days.</p>
        </div>
        <Card className="glass-card border-border/50">
          <CardContent className="py-12 text-center text-muted-foreground">
            <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Log an outing to see pitcher stats here.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="animate-slide-up space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <h2 className="font-display text-2xl font-bold text-foreground">
            7-Day Dashboard
          </h2>
          <button
            onClick={onEditRoster}
            className="text-sm text-primary hover:text-primary/80 underline underline-offset-2"
          >
            Edit Roster
          </button>
        </div>
        <p className="text-muted-foreground">
          {pitcherStats.length} pitcher{pitcherStats.length !== 1 ? 's' : ''} • {teamTotals.totalOutings} outing{teamTotals.totalOutings !== 1 ? 's' : ''} • {teamTotals.totalPitches} total pitches
        </p>
      </div>

      {/* Pitcher Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {pitcherStats.map((stats) => {
          const maxPitches = pitcherMaxPitches[stats.pitcher.name] || 120;
          const pulseStatus = getPulseLevel(stats.totalPitches, maxPitches);
          
          return (
            <Card 
              key={stats.pitcher.id} 
              className="glass-card border-border/50 hover:border-primary/30 transition-all cursor-pointer group"
              onClick={() => onPitcherClick(stats.pitcher)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="font-display text-xl flex items-center gap-2">
                    {stats.pitcher.name}
                    <ChevronRight className="w-5 h-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </CardTitle>
                  <StatusBadge status={stats.pitcher.restStatus} />
                </div>
                <p className="text-sm text-muted-foreground">
                  {stats.outingCount} outing{stats.outingCount !== 1 ? 's' : ''} in the last 7 days
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {/* Left side: Stats */}
                  <div className="space-y-3">
                    {/* Pulse / Pitch Count */}
                    <div className="p-3 rounded-lg bg-secondary/30">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                        <Target className="w-3.5 h-3.5" />
                        7-Day Pulse
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className={`text-2xl font-bold ${
                          pulseStatus === 'danger' ? 'text-status-danger' :
                          pulseStatus === 'warning' ? 'text-status-warning' :
                          pulseStatus === 'caution' ? 'text-[hsl(45,90%,50%)]' :
                          'text-foreground'
                        }`}>
                          {stats.totalPitches}
                        </span>
                        <span className="text-xs text-muted-foreground">/ {maxPitches}</span>
                      </div>
                      {/* Progress bar */}
                      <div className="mt-2 h-1.5 bg-secondary rounded-full overflow-hidden">
                        <div 
                          className={`h-full transition-all rounded-full ${
                            pulseStatus === 'danger' ? 'bg-status-danger' :
                            pulseStatus === 'warning' ? 'bg-status-warning' :
                            pulseStatus === 'caution' ? 'bg-[hsl(45,90%,50%)]' :
                            'bg-primary'
                          }`}
                          style={{ width: `${Math.min(100, (stats.totalPitches / maxPitches) * 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* Strike Percentage */}
                    <div className="p-3 rounded-lg bg-secondary/30">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                        <TrendingUp className="w-3.5 h-3.5" />
                        Strike %
                      </div>
                      <span className={`text-2xl font-bold ${
                        stats.strikePercentage >= 60 ? 'text-status-success' :
                        stats.strikePercentage >= 50 ? 'text-status-warning' :
                        stats.strikePercentage > 0 ? 'text-status-danger' :
                        'text-muted-foreground'
                      }`}>
                        {stats.strikePercentage > 0 ? `${stats.strikePercentage}%` : '—'}
                      </span>
                      {stats.totalStrikes > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {stats.totalStrikes} strikes
                        </p>
                      )}
                    </div>

                    {/* Velocity */}
                    <div className="p-3 rounded-lg bg-secondary/30">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                        <Zap className="w-3.5 h-3.5" />
                        Velocity
                      </div>
                      {stats.maxVelocity > 0 ? (
                        <>
                          <span className="text-2xl font-bold text-foreground">
                            {stats.maxVelocity}
                          </span>
                          <span className="text-sm text-muted-foreground ml-1">mph</span>
                          {stats.minVelocity !== stats.maxVelocity && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Range: {stats.minVelocity} - {stats.maxVelocity}
                            </p>
                          )}
                        </>
                      ) : (
                        <span className="text-2xl font-bold text-muted-foreground">—</span>
                      )}
                    </div>
                  </div>

                  {/* Right side: Heatmap */}
                  <div className="flex flex-col">
                    <div className="text-xs text-muted-foreground mb-2 text-center">
                      Strike Zone Heatmap
                    </div>
                    {stats.pitchLocations.length > 0 ? (
                      <div className="flex-1 flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
                        <StrikeZoneHeatmap
                          pitchLocations={stats.pitchLocations}
                          pitchTypes={stats.pitchTypes}
                          size="sm"
                          showLegend={false}
                        />
                      </div>
                    ) : (
                      <div className="flex-1 flex items-center justify-center bg-secondary/20 rounded-lg border border-border/30">
                        <p className="text-xs text-muted-foreground text-center p-4">
                          No pitch locations plotted
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Outing breakdown */}
                <div className="pt-2 border-t border-border/30">
                  <div className="flex flex-wrap gap-2 text-xs">
                    {stats.outings.map((outing, idx) => (
                      <span 
                        key={outing.id}
                        className={`px-2 py-1 rounded-md ${
                          outing.eventType === 'Bullpen' ? 'bg-[hsl(220,70%,45%)]/20 text-[hsl(220,70%,65%)]' :
                          outing.eventType === 'Game' ? 'bg-[hsl(142,70%,45%)]/20 text-[hsl(142,70%,65%)]' :
                          outing.eventType === 'External' ? 'bg-[hsl(200,80%,60%)]/20 text-[hsl(200,80%,70%)]' :
                          'bg-[hsl(25,90%,55%)]/20 text-[hsl(25,90%,65%)]'
                        }`}
                      >
                        {new Date(outing.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}: {outing.pitchCount}p ({outing.eventType})
                      </span>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
