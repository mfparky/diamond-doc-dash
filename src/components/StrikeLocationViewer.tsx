import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StrikeZone } from './StrikeZone';
import { StrikeZoneHeatmap } from './StrikeZoneHeatmap';
import { usePitchLocations } from '@/hooks/use-pitch-locations';
import { PitchLocation, PitchTypeConfig, DEFAULT_PITCH_TYPES } from '@/types/pitch-location';
import { Outing } from '@/types/pitcher';
import { Target } from 'lucide-react';

type ViewMode = 'session' | '7-day' | 'year';

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

  // Filter locations by pitch type if selected
  const filteredLocations = useMemo(() => {
    if (filterPitchType === null) return pitchLocations;
    return pitchLocations.filter(p => p.pitchType === filterPitchType);
  }, [pitchLocations, filterPitchType]);

  // Get unique pitch types in the data
  const usedPitchTypes = useMemo(() => {
    return [...new Set(pitchLocations.map(p => p.pitchType))].sort();
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

        {/* Pitch type filter */}
        {usedPitchTypes.length > 1 && (
          <div className="flex flex-wrap gap-2">
            <Button
              variant={filterPitchType === null ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterPitchType(null)}
              className="text-xs"
            >
              All
            </Button>
            {usedPitchTypes.map((pt) => (
              <Button
                key={pt}
                variant={filterPitchType === pt ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterPitchType(pt)}
                className="text-xs"
              >
                {pitchTypes[pt.toString()] || `P${pt}`}
              </Button>
            ))}
          </div>
        )}

        {/* Visualization */}
        <div className="flex justify-center py-2">
          {isLoading ? (
            <div className="w-72 h-80 bg-secondary/30 rounded-lg animate-pulse" />
          ) : viewMode === 'year' ? (
            <StrikeZoneHeatmap
              pitchLocations={filteredLocations}
              pitchTypes={pitchTypes}
              showLegend={true}
              size="md"
            />
          ) : (
            <StrikeZone
              pitchLocations={filteredLocations}
              pitchTypes={pitchTypes}
              showLegend={true}
              size="md"
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
