import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Pitcher, Outing, getDaysRestNeeded, calculateRestStatus } from '@/types/pitcher';
import { calculatePitcherStats } from '@/lib/pitcher-data';
import { StatusBadge } from '@/components/StatusBadge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PitchCountChart } from '@/components/PitchCountChart';
import { TrendingUp, Target, Gauge, Calendar, Video, ExternalLink, Shield, ArrowLeft } from 'lucide-react';
import hawksLogo from '@/assets/hawks-logo.png';

export default function PlayerDashboard() {
  const { playerId } = useParams<{ playerId: string }>();
  const [pitcher, setPitcher] = useState<Pitcher | null>(null);
  const [outings, setOutings] = useState<Outing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPlayerData() {
      if (!playerId) {
        setError('Player ID not provided');
        setIsLoading(false);
        return;
      }

      try {
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
        setPitcher(calculatedPitcher);
      } catch (err) {
        console.error('Error fetching player data:', err);
        setError('Failed to load player data');
      } finally {
        setIsLoading(false);
      }
    }

    fetchPlayerData();
  }, [playerId]);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      weekday: 'short',
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

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
              <p className="text-xs text-muted-foreground">Player Dashboard</p>
            </div>
          </div>
          <StatusBadge status={pitcher.restStatus} />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Arm Care Status Card */}
        {pitcher.lastPitchCount > 0 && (
          <Card className="glass-card border-primary/30 bg-primary/5">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
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
            </CardContent>
          </Card>
        )}

        {/* Current Focus */}
        {pitcher.focus && (
          <Card className="glass-card border-accent/30 bg-accent/5">
            <CardContent className="p-4">
              <p className="text-sm font-medium text-accent">Current Focus</p>
              <p className="text-foreground mt-1">{pitcher.focus}</p>
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

        {/* Season Pitch Count Chart */}
        <PitchCountChart outings={pitcher.outings} />

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
                        {outing.videoUrl && (
                          <a 
                            href={outing.videoUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-sm text-primary hover:text-primary/80 transition-colors"
                          >
                            <Video className="w-4 h-4" />
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
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
    </div>
  );
}
