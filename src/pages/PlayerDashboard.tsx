import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Pitcher, Outing, getDaysRestNeeded, calculateRestStatus } from '@/types/pitcher';
import { calculatePitcherStats } from '@/lib/pitcher-data';
import { StatusBadge } from '@/components/StatusBadge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PitchCountChart } from '@/components/PitchCountChart';
import { StrikeLocationViewer } from '@/components/StrikeLocationViewer';
import { VideoPlayer } from '@/components/VideoPlayer';
import { usePitchLocations } from '@/hooks/use-pitch-locations';
import { usePageMeta } from '@/hooks/use-page-meta';
import { PitchTypeConfig, DEFAULT_PITCH_TYPES } from '@/types/pitch-location';
import { TrendingUp, Target, Gauge, Calendar, Video, Shield, ArrowLeft, Play, MessageSquare } from 'lucide-react';
import hawksLogo from '@/assets/hawks-logo.png';

export default function PlayerDashboard() {
  const { playerId } = useParams<{ playerId: string }>();
  const [pitcher, setPitcher] = useState<Pitcher | null>(null);
  const [outings, setOutings] = useState<Outing[]>([]);
  const [pitchTypes, setPitchTypes] = useState<PitchTypeConfig>(DEFAULT_PITCH_TYPES);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedVideoOuting, setSelectedVideoOuting] = useState<Outing | null>(null);
  const { fetchPitchTypes } = usePitchLocations();

  const withTimeout = <T,>(promise: Promise<T>, ms = 8000): Promise<T> => {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timeout')), ms);
      promise
        .then((value) => {
          clearTimeout(timer);
          resolve(value);
        })
        .catch((err) => {
          clearTimeout(timer);
          reject(err);
        });
    });
  };

  useEffect(() => {
    let cancelled = false;

    async function fetchPlayerData() {
      if (!playerId) {
        setError('Player ID not provided');
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        // Fetch pitcher by ID
        const { data: pitcherData, error: pitcherError } = await supabase
          .from('pitchers')
          .select('*')
          .eq('id', playerId)
          .maybeSingle();

        if (pitcherError) throw pitcherError;
        
        if (!pitcherData) {
          setError('Player not found');
          setIsLoading(false);
          return;
        }

        // Fetch outings for this pitcher
        const { data: outingsData, error: outingsError } = await supabase
          .from('outings')
          .select('*')
          .eq('pitcher_name', pitcherData.name)
          .order('date', { ascending: false });

        if (outingsError) throw outingsError;

        // Map outings
        const mappedOutings: Outing[] = (outingsData || []).map((row) => ({
          id: row.id,
          timestamp: row.created_at,
          date: row.date,
          pitcherName: row.pitcher_name,
          eventType: row.event_type as Outing['eventType'],
          pitchCount: row.pitch_count,
          strikes: row.strikes,
          maxVelo: row.max_velocity ?? 0,
          notes: row.notes ?? '',
          videoUrl: row.video_url ?? undefined,
          focus: row.focus ?? undefined,
          coachNotes: row.coach_notes ?? undefined,
          videoUrl1: row.video_url_1 ?? undefined,
          videoUrl2: row.video_url_2 ?? undefined,
          video1PitchType: row.video_1_pitch_type ?? undefined,
          video1Velocity: row.video_1_velocity ?? undefined,
          video2PitchType: row.video_2_pitch_type ?? undefined,
          video2Velocity: row.video_2_velocity ?? undefined,
        }));

        setOutings(mappedOutings);

        // Create pitcher object
        const basePitcher: Pitcher = {
          id: pitcherData.id,
          name: pitcherData.name,
          sevenDayPulse: 0,
          strikePercentage: 0,
          maxVelo: 0,
          lastOuting: '',
          lastPitchCount: 0,
          restStatus: { type: 'no-data' },
          notes: '',
          outings: [],
        };

        // Calculate stats
        const calculatedPitcher = calculatePitcherStats(basePitcher, mappedOutings);
        if (!cancelled) {
          setPitcher(calculatedPitcher);
        }

        // Fetch pitch types in the background (don't block page load)
        void withTimeout(fetchPitchTypes(playerId), 8000)
          .then((types) => {
            if (!cancelled) setPitchTypes(types);
          })
          .catch((err) => {
            // If this fails/hangs, we still want the dashboard to be usable.
            console.warn('Pitch types failed to load (fallback to defaults):', err);
          });
      } catch (err) {
        console.error('Error fetching player data:', err);
        setError('Failed to load player data');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    fetchPlayerData();
    return () => {
      cancelled = true;
    };
  }, [playerId, fetchPitchTypes]);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';

    // dateStr is a Postgres DATE (YYYY-MM-DD). Using `new Date(dateStr)` treats it as UTC
    // and can render as the previous day in negative timezones.
    const parts = dateStr.split('-').map(Number);
    const date = parts.length === 3 && parts.every((n) => Number.isFinite(n))
      ? new Date(parts[0], parts[1] - 1, parts[2])
      : new Date(dateStr);

    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Dynamic page meta for sharing
  usePageMeta({
    title: pitcher ? `${pitcher.name} | Player Dashboard` : 'Player Dashboard | Arm Stats',
    description: pitcher 
      ? `View ${pitcher.name}'s pitching stats, arm care status, and performance history.`
      : 'Player pitching stats and arm care tracking.',
    ogTitle: pitcher ? `${pitcher.name} - Player Dashboard` : 'Player Dashboard',
    ogDescription: pitcher 
      ? `${pitcher.name}'s pitching stats: ${pitcher.sevenDayPulse} pitches (7-day), ${pitcher.strikePercentage.toFixed(0)}% strikes${pitcher.maxVelo ? `, ${pitcher.maxVelo} mph max velo` : ''}.`
      : 'Player pitching stats and arm care tracking.',
    ogType: 'profile',
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (error || !pitcher) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <p className="text-destructive">{error || 'Player not found'}</p>
        <Link to="/" className="text-primary hover:underline flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>
      </div>
    );
  }

  const daysRestNeeded = pitcher.lastPitchCount > 0 ? getDaysRestNeeded(pitcher.lastPitchCount) : 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border/50">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={hawksLogo} alt="Hawks" className="w-10 h-10 object-contain" />
            <div>
              <h1 className="font-display text-xl font-bold text-foreground">{pitcher.name}</h1>
              <p className="text-xs text-muted-foreground hidden md:block">Player Dashboard</p>
            </div>
          </div>
          <StatusBadge status={pitcher.restStatus} />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Arm Care Status Card - Hidden on mobile */}
        {(pitcher.lastPitchCount > 0 || pitcher.coachNotes) && (
          <Card className="glass-card border-primary/30 bg-primary/5 hidden md:block">
            <CardContent className="p-4">
              <div className="flex flex-col md:flex-row md:items-start gap-4">
                {/* Arm Care Section */}
                {pitcher.lastPitchCount > 0 && (
                  <div className="flex items-start gap-3 flex-1">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Shield className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-display font-semibold text-foreground">Arm Care Status</h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        Last outing: <span className="text-foreground font-medium">{pitcher.lastPitchCount} pitches</span>
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Rest required: <span className="text-foreground font-medium">{daysRestNeeded} day{daysRestNeeded !== 1 ? 's' : ''}</span>
                      </p>
                    </div>
                  </div>
                )}

                {/* Coach Notes Section */}
                {pitcher.coachNotes && (
                  <div className="flex items-start gap-3 flex-1">
                    <div className="p-2 rounded-lg bg-purple-500/10">
                      <MessageSquare className="w-5 h-5 text-purple-500" />
                    </div>
                    <div>
                      <h4 className="font-display font-semibold text-purple-500">Coach's Notes</h4>
                      <p className="text-sm text-foreground mt-1">{pitcher.coachNotes}</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="stat-card">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <TrendingUp className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">7-Day Pulse</p>
                <p className="text-2xl font-bold text-foreground">{pitcher.sevenDayPulse}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="stat-card">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-accent/10">
                <Target className="w-5 h-5 text-accent" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Strike %</p>
                <p className="text-2xl font-bold text-foreground">{pitcher.strikePercentage.toFixed(1)}%</p>
              </div>
            </CardContent>
          </Card>

          <Card className="stat-card">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-status-danger/10">
                <Gauge className="w-5 h-5 text-status-danger" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Max Velo</p>
                <p className="text-2xl font-bold text-foreground">{pitcher.maxVelo || '-'}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="stat-card">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted">
                <Calendar className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Last Outing</p>
                <p className="text-sm font-bold text-foreground">{formatDate(pitcher.lastOuting)}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Focus/Notes & Latest Video Section - Side by Side */}
        {(() => {
          const sortedOutings = [...outings].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          const outingWithVideo = sortedOutings.find(o => o.videoUrl1 || o.videoUrl2 || o.videoUrl);
          
          const latestVideoUrl = outingWithVideo?.videoUrl1 || outingWithVideo?.videoUrl2 || outingWithVideo?.videoUrl;
          const latestPitchType = outingWithVideo?.videoUrl1
            ? outingWithVideo?.video1PitchType
            : outingWithVideo?.videoUrl2
              ? outingWithVideo?.video2PitchType
              : undefined;
          const latestVelocity = outingWithVideo?.videoUrl1
            ? outingWithVideo?.video1Velocity
            : outingWithVideo?.videoUrl2
              ? outingWithVideo?.video2Velocity
              : undefined;

          const hasVideo = !!latestVideoUrl;
          const hasFocus = !!pitcher.focus;
          const hasNotes = !!pitcher.notes;

          // If we have video OR focus/notes, show the section
          if (hasVideo || hasFocus || hasNotes) {
            // If video exists: 2-column layout with stacked focus/notes on left, video on right
            if (hasVideo) {
              return (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                  {/* Stacked Focus & Notes on left */}
                  {(hasFocus || hasNotes) && (
                    <div className="flex flex-col gap-4">
                      {hasFocus && (
                        <Card className="glass-card border-accent/30 bg-accent/5">
                          <CardContent className="p-4">
                            <p className="text-sm font-medium text-accent">Current Focus</p>
                            <p className="text-foreground mt-1">{pitcher.focus}</p>
                          </CardContent>
                        </Card>
                      )}
                      {hasNotes && (
                        <Card className="glass-card">
                          <CardContent className="p-4">
                            <p className="text-sm font-medium text-muted-foreground">Latest Notes</p>
                            <p className="text-foreground mt-1">{pitcher.notes}</p>
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  )}

                  {/* Latest Video on right */}
                  <Card className="glass-card">
                    <CardHeader className="pb-2">
                      <CardTitle className="font-display text-lg flex items-center gap-2">
                        <Play className="w-5 h-5 text-primary" />
                        Latest Video
                      </CardTitle>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(outingWithVideo!.date)} - {outingWithVideo!.eventType}
                      </p>
                    </CardHeader>
                    <CardContent>
                      <VideoPlayer
                        url={latestVideoUrl!}
                        pitchType={latestPitchType}
                        velocity={latestVelocity}
                        pitchTypes={pitchTypes}
                      />
                    </CardContent>
                  </Card>
                </div>
              );
            }

            // No video: Focus and Notes side by side
            return (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                {hasFocus && (
                  <Card className="glass-card border-accent/30 bg-accent/5">
                    <CardContent className="p-4">
                      <p className="text-sm font-medium text-accent">Current Focus</p>
                      <p className="text-foreground mt-1">{pitcher.focus}</p>
                    </CardContent>
                  </Card>
                )}
                {hasNotes && (
                  <Card className="glass-card">
                    <CardContent className="p-4">
                      <p className="text-sm font-medium text-muted-foreground">Latest Notes</p>
                      <p className="text-foreground mt-1">{pitcher.notes}</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            );
          }

          return null;
        })()}

        {/* Season Pitch Count Chart */}
        <PitchCountChart outings={pitcher.outings} />

        {/* Strike Location Viewer */}
        <StrikeLocationViewer 
          pitcherId={pitcher.id} 
          outings={pitcher.outings}
          pitchTypes={pitchTypes}
        />

        {/* Outing History - Read Only */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="font-display text-lg">Outing History</CardTitle>
          </CardHeader>
          <CardContent>
            {pitcher.outings.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No outings recorded yet.</p>
            ) : (
              <div className="space-y-3">
                {pitcher.outings
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .map((outing) => (
                    <div 
                      key={outing.id} 
                      className="p-4 rounded-lg bg-secondary/50 border border-border/30"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-semibold text-foreground">{formatDate(outing.date)}</p>
                          <p className="text-sm text-accent">{outing.eventType}</p>
                        </div>
                        {/* Video indicators */}
                        <div className="flex items-center gap-2">
                          {(outing.videoUrl1 || outing.videoUrl2 || outing.videoUrl) && (
                            <button
                              onClick={() => setSelectedVideoOuting(outing)}
                              className="flex items-center gap-1 text-sm text-primary hover:text-primary/80 transition-colors"
                            >
                              <Video className="w-4 h-4" />
                              <span className="text-xs">
                                {outing.videoUrl1 && outing.videoUrl2 ? '2' : '1'}
                              </span>
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Pitches: </span>
                          <span className="font-medium text-foreground">{outing.pitchCount}</span>
                          <span className="text-xs text-muted-foreground ml-1">
                            ({getDaysRestNeeded(outing.pitchCount)}d rest)
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Strikes: </span>
                          {outing.strikes !== null ? (
                            <>
                              <span className="font-medium text-foreground">{outing.strikes}</span>
                              <span className="text-xs text-muted-foreground ml-1">
                                ({outing.pitchCount > 0 ? ((outing.strikes / outing.pitchCount) * 100).toFixed(0) : 0}%)
                              </span>
                            </>
                          ) : (
                            <span className="text-muted-foreground italic">N/A</span>
                          )}
                        </div>
                        <div>
                          <span className="text-muted-foreground">Velo: </span>
                          <span className="font-medium text-foreground">{outing.maxVelo || '-'}</span>
                        </div>
                      </div>
                      {outing.focus && (
                        <p className="mt-2 text-sm text-primary border-t border-border/30 pt-2">
                          <span className="font-medium">Focus:</span> {outing.focus}
                        </p>
                      )}
                      {outing.notes && (
                        <p className="mt-2 text-sm text-muted-foreground border-t border-border/30 pt-2">
                          {outing.notes}
                        </p>
                      )}
                      {outing.coachNotes && (
                        <div className="mt-2 text-sm border-t border-border/30 pt-2 flex items-start gap-2">
                          <MessageSquare className="w-4 h-4 text-purple-500 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-medium text-purple-500">Coach's Notes:</span>
                            <p className="text-foreground mt-0.5">{outing.coachNotes}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-xs text-muted-foreground pt-4 pb-8">
          <p>Powered by Diamond Doc Dash</p>
        </div>
      </main>

      {/* Video Dialog */}
      <Dialog open={!!selectedVideoOuting} onOpenChange={() => setSelectedVideoOuting(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Video className="w-5 h-5 text-primary" />
              Session Videos
            </DialogTitle>
            {selectedVideoOuting && (
              <p className="text-sm text-muted-foreground">
                {formatDate(selectedVideoOuting.date)} - {selectedVideoOuting.eventType}
              </p>
            )}
          </DialogHeader>
          
          {selectedVideoOuting && (
            <div className="space-y-4">
              {selectedVideoOuting.videoUrl1 && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Video 1</p>
                  <VideoPlayer
                    url={selectedVideoOuting.videoUrl1}
                    pitchType={selectedVideoOuting.video1PitchType}
                    velocity={selectedVideoOuting.video1Velocity}
                    pitchTypes={pitchTypes}
                  />
                </div>
              )}
              {selectedVideoOuting.videoUrl2 && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Video 2</p>
                  <VideoPlayer
                    url={selectedVideoOuting.videoUrl2}
                    pitchType={selectedVideoOuting.video2PitchType}
                    velocity={selectedVideoOuting.video2Velocity}
                    pitchTypes={pitchTypes}
                  />
                </div>
              )}

              {selectedVideoOuting.videoUrl && !selectedVideoOuting.videoUrl1 && !selectedVideoOuting.videoUrl2 && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Video</p>
                  <VideoPlayer
                    url={selectedVideoOuting.videoUrl}
                    pitchTypes={pitchTypes}
                  />
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
