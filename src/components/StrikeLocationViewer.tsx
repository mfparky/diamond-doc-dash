import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StrikeZone } from './StrikeZone';
import { StrikeZoneHeatmap } from './StrikeZoneHeatmap';
import { usePitchLocations } from '@/hooks/use-pitch-locations';
import { PitchLocation, PitchTypeConfig, DEFAULT_PITCH_TYPES, PITCH_TYPE_COLORS } from '@/types/pitch-location';
import { Outing } from '@/types/pitcher';
import { Target } from 'lucide-react';

type ViewMode = 'session' | '7-day' | 'year';
type ResultFilter = 'all' | 'strikes' | 'balls';

interface StrikeLocationViewerProps {
  pitcherId: string;
  outings: Outing[];
  pitchTypes?: PitchTypeConfig;
}

export function StrikeLocationViewer({
  pitcherId,
  outings,
  pitchTypes = DEFAULT_PITCH_TYPES,
}: StrikeLocationViewerProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('7-day');
  const [selectedOutingId, setSelectedOutingId] = useState<string | null>(null);
  const [pitchLocations, setPitchLocations] = useState<PitchLocation[]>([]);
  const [filterPitchType, setFilterPitchType] = useState<number | null>(null);
  const [resultFilter, setResultFilter] = useState<ResultFilter>('all');
  const [isLoading, setIsLoading] = useState(false);

  const { fetchPitchLocationsForOuting, fetchPitchLocationsForPitcher } = usePitchLocations();

  // Get outings sorted by date (most recent first)
  const sortedOutings = useMemo(() => {
    return [...outings].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [outings]);

  // Calculate date ranges
  const dateRanges = useMemo(() => {
    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const yearStart = new Date(2026, 0, 1);
    const yearEnd = new Date(2026, 11, 31, 23, 59, 59);

    return {
      sevenDay: { start: sevenDaysAgo.toISOString(), end: now.toISOString() },
      year: { start: yearStart.toISOString(), end: yearEnd.toISOString() },
    };
  }, []);

  // Load pitch locations based on view mode
  useEffect(() => {
    const loadPitchLocations = async () => {
      setIsLoading(true);
      let locations: PitchLocation[] = [];

      try {
        if (viewMode === 'session' && selectedOutingId) {
          locations = await fetchPitchLocationsForOuting(selectedOutingId);
        } else if (viewMode === '7-day') {
          locations = await fetchPitchLocationsForPitcher(
            pitcherId,
            dateRanges.sevenDay.start,
            dateRanges.sevenDay.end
          );
        } else if (viewMode === 'year') {
          locations = await fetchPitchLocationsForPitcher(
            pitcherId,
            dateRanges.year.start,
            dateRanges.year.end
          );
        }
      } catch (error) {
        console.error('Error loading pitch locations:', error);
      }

      setPitchLocations(locations);
      setIsLoading(false);
    };

    loadPitchLocations();
  }, [viewMode, selectedOutingId, pitcherId, dateRanges, fetchPitchLocationsForOuting, fetchPitchLocationsForPitcher]);

  // Auto-select most recent outing when switching to session view
  useEffect(() => {
    if (viewMode === 'session' && sortedOutings.length > 0 && !selectedOutingId) {
      setSelectedOutingId(sortedOutings[0].id);
    }
  }, [viewMode, sortedOutings, selectedOutingId]);

  // Filter locations by pitch type and result
  const filteredLocations = useMemo(() => {
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

  // Get unique pitch types in the data
  const usedPitchTypes = useMemo(() => {
    return [...new Set(pitchLocations.map(p => p.pitchType))].sort();
  }, [pitchLocations]);

  // Calculate pitch mix breakdown
  const pitchMixStats = useMemo(() => {
    const total = pitchLocations.length;
    if (total === 0) return [];

    const breakdown: Array<{
      pitchType: number;
      label: string;
      count: number;
      percentage: number;
      strikes: number;
      strikePercentage: number;
    }> = [];

    usedPitchTypes.forEach((pt) => {
      const pitchesOfType = pitchLocations.filter(p => p.pitchType === pt);
      const strikesOfType = pitchesOfType.filter(p => p.isStrike).length;
      
      breakdown.push({
        pitchType: pt,
        label: pitchTypes[pt.toString()] || `P${pt}`,
        count: pitchesOfType.length,
        percentage: (pitchesOfType.length / total) * 100,
        strikes: strikesOfType,
        strikePercentage: pitchesOfType.length > 0 ? (strikesOfType / pitchesOfType.length) * 100 : 0,
      });
    });

    return breakdown.sort((a, b) => b.count - a.count);
  }, [pitchLocations, usedPitchTypes, pitchTypes]);

  // Overall stats
  const overallStats = useMemo(() => {
    const total = pitchLocations.length;
    const strikes = pitchLocations.filter(p => p.isStrike).length;
    return {
      total,
      strikes,
      balls: total - strikes,
      strikePercentage: total > 0 ? (strikes / total) * 100 : 0,
    };
  }, [pitchLocations]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (pitchLocations.length === 0 && !isLoading) {
    return (
      <Card className="glass-card">
        <CardHeader className="pb-2">
          <CardTitle className="font-display text-lg flex items-center gap-2">
            <Target className="w-5 h-5 text-primary" />
            Strike Locations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <p>No pitch location data recorded yet.</p>
            <p className="text-sm mt-1">Use the pitch plotter when logging outings to track locations.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-card">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="font-display text-lg flex items-center gap-2">
            <Target className="w-5 h-5 text-primary" />
            Strike Locations
          </CardTitle>

          {/* View Mode Toggle */}
          <div className="flex gap-1">
            {(['session', '7-day', 'year'] as ViewMode[]).map((mode) => (
              <Button
                key={mode}
                variant={viewMode === mode ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode(mode)}
                className="text-xs"
              >
                {mode === 'session' ? 'Session' : mode === '7-day' ? '7-Day' : 'Year'}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Session selector (only for session view) */}
        {viewMode === 'session' && (
          <Select
            value={selectedOutingId || ''}
            onValueChange={(value) => setSelectedOutingId(value)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select outing" />
            </SelectTrigger>
            <SelectContent>
              {sortedOutings.map((outing) => (
                <SelectItem key={outing.id} value={outing.id}>
                  {formatDate(outing.date)} - {outing.eventType} ({outing.pitchCount} pitches)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Pitch Mix Breakdown */}
        {pitchMixStats.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Pitch Mix</p>
            <div className="space-y-2">
              {pitchMixStats.map((stat) => (
                <div 
                  key={stat.pitchType} 
                  className="flex items-center gap-3 cursor-pointer hover:bg-secondary/30 rounded-lg p-2 -mx-2 transition-colors"
                  onClick={() => setFilterPitchType(filterPitchType === stat.pitchType ? null : stat.pitchType)}
                >
                  <div
                    className={`w-3 h-3 rounded-full shrink-0 border ${filterPitchType === stat.pitchType ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : 'border-white/30'}`}
                    style={{ backgroundColor: PITCH_TYPE_COLORS[stat.pitchType.toString()] }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{stat.label}</span>
                      <span className="text-muted-foreground">
                        {stat.count} ({stat.percentage.toFixed(0)}%)
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-secondary/50 rounded-full mt-1 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${stat.percentage}%`,
                          backgroundColor: PITCH_TYPE_COLORS[stat.pitchType.toString()],
                        }}
                      />
                    </div>
                  </div>
                  <div className="text-xs text-right shrink-0">
                    <span className={stat.strikePercentage >= 60 ? 'text-green-500' : stat.strikePercentage >= 50 ? 'text-foreground' : 'text-orange-500'}>
                      {stat.strikePercentage.toFixed(0)}% K
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Result Filter (Strike/Ball) */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Show:</span>
          <div className="flex gap-1">
            <Button
              variant={resultFilter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setResultFilter('all')}
              className="text-xs"
            >
              All ({overallStats.total})
            </Button>
            <Button
              variant={resultFilter === 'strikes' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setResultFilter('strikes')}
              className="text-xs"
            >
              Strikes ({overallStats.strikes})
            </Button>
            <Button
              variant={resultFilter === 'balls' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setResultFilter('balls')}
              className="text-xs"
            >
              Balls ({overallStats.balls})
            </Button>
          </div>
        </div>

        {/* Visualization */}
        <div className="flex justify-center py-2">
          {isLoading ? (
            <div className="w-72 h-80 bg-secondary/30 rounded-lg animate-pulse" />
          ) : viewMode === 'year' ? (
            <StrikeZoneHeatmap
              pitchLocations={filteredLocations}
              pitchTypes={pitchTypes}
              showLegend={false}
              size="lg"
            />
          ) : (
            <StrikeZone
              pitchLocations={filteredLocations}
              pitchTypes={pitchTypes}
              showLegend={false}
              size="md"
            />
          )}
        </div>

        {/* Summary Stats */}
        <div className="text-center text-sm text-muted-foreground border-t border-border/50 pt-3">
          Showing <span className="font-medium text-foreground">{filteredLocations.length}</span> pitches
          {filterPitchType !== null && (
            <span> • Filtered by {pitchTypes[filterPitchType.toString()] || `P${filterPitchType}`}</span>
          )}
          {resultFilter !== 'all' && (
            <span> • {resultFilter === 'strikes' ? 'Strikes only' : 'Balls only'}</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
