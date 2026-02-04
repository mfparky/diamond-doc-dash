import { useState, useEffect, useCallback } from 'react';
import { Pitcher, Outing, getDaysRestNeeded } from '@/types/pitcher';
import { StatusBadge } from './StatusBadge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ArrowLeft, TrendingUp, Target, Gauge, Calendar, Video, ExternalLink, Shield, Pencil, Trash2, Share2, Settings, MapPin, Play, Activity, ClipboardList, MessageSquare } from 'lucide-react';
import { EditOutingDialog } from './EditOutingDialog';
import { OutingForm } from './OutingForm';
import { DeleteOutingDialog } from './DeleteOutingDialog';
import { OutingPitchMapDialog } from './OutingPitchMapDialog';
import { OutingVideoSection } from './OutingVideoSection';
import { PitchCountChart } from './PitchCountChart';
import { VideoPlayer } from './VideoPlayer';
import { StrikeLocationViewer } from './StrikeLocationViewer';
import { PitchTypeConfigDialog } from './PitchTypeConfigDialog';
import { HomeButton } from './HomeButton';
import { LiveChartingSession, LivePitch } from './LiveChartingSession';
import { usePitchLocations } from '@/hooks/use-pitch-locations';
import { PitchTypeConfig, DEFAULT_PITCH_TYPES, PitchLocation } from '@/types/pitch-location';
import { useToast } from '@/hooks/use-toast';
import { WorkoutCompletionDisplay } from './WorkoutCompletionDisplay';


interface PitcherDetailProps {
  pitcher: Pitcher;
  onBack: () => void;
  onUpdateOuting: (id: string, data: Partial<Omit<Outing, 'id' | 'timestamp'>>) => Promise<boolean>;
  onDeleteOuting: (id: string) => Promise<boolean>;
  onAddOuting?: (outing: Omit<Outing, 'id' | 'timestamp'>, pitchLocations?: Array<{
    pitchNumber: number;
    pitchType: number;
    xLocation: number;
    yLocation: number;
    isStrike: boolean;
  }>) => Promise<Outing | null>;
}

export function PitcherDetail({ pitcher, onBack, onUpdateOuting, onDeleteOuting, onAddOuting }: PitcherDetailProps) {
  const [editingOuting, setEditingOuting] = useState<Outing | null>(null);
  const [deletingOuting, setDeletingOuting] = useState<Outing | null>(null);
  const [pitchMapOuting, setPitchMapOuting] = useState<Outing | null>(null);
  const [videoOuting, setVideoOuting] = useState<Outing | null>(null);
  const [showPitchTypeConfig, setShowPitchTypeConfig] = useState(false);
  const [showLiveCharting, setShowLiveCharting] = useState(false);
  const [showLogOuting, setShowLogOuting] = useState(false);
  const [pitchTypes, setPitchTypes] = useState<PitchTypeConfig>(DEFAULT_PITCH_TYPES);
  const [outingPitchCounts, setOutingPitchCounts] = useState<Record<string, number>>({});
  const [refreshKey, setRefreshKey] = useState(0);
  const { fetchPitchTypes, fetchPitchLocationsForOuting, addPitchLocations } = usePitchLocations();
  const { toast } = useToast();

  // Load pitch location counts for each outing - fetch in parallel
  const loadOutingPitchCounts = useCallback(async () => {
    const countPromises = pitcher.outings.map(async (outing) => {
      const locations = await fetchPitchLocationsForOuting(outing.id);
      return { id: outing.id, count: locations.length };
    });
    
    const results = await Promise.all(countPromises);
    const counts: Record<string, number> = {};
    results.forEach(({ id, count }) => {
      counts[id] = count;
    });
    setOutingPitchCounts(counts);
  }, [pitcher.outings, fetchPitchLocationsForOuting]);

  useEffect(() => {
    loadOutingPitchCounts();
  }, [loadOutingPitchCounts, refreshKey]);

  // Load pitcher's pitch type config
  useEffect(() => {
    if (pitcher.id) {
      fetchPitchTypes(pitcher.id).then(setPitchTypes);
    }
  }, [pitcher.id, fetchPitchTypes]);

  const handleShare = () => {
    const url = `${window.location.origin}/player/${pitcher.id}`;
    navigator.clipboard.writeText(url);
    toast({
      title: 'Link copied!',
      description: `Share this link with ${pitcher.name.split(' ')[0]}'s parents.`,
    });
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    // Parse as local date to avoid timezone shift (YYYY-MM-DD → local noon)
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day, 12, 0, 0, 0);
    return date.toLocaleDateString('en-US', { 
      weekday: 'short',
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  const daysRestNeeded = pitcher.lastPitchCount > 0 ? getDaysRestNeeded(pitcher.lastPitchCount) : 0;

  // Handle live charting session completion
  const handleLiveSessionComplete = useCallback(async (sessionData: {
    pitches: LivePitch[];
    maxVelo: number;
    pitchCount: number;
    strikes: number;
    eventType: Outing['eventType'];
    date: string;
  }) => {
    if (!onAddOuting) {
      toast({
        title: 'Error',
        description: 'Unable to save session. Please try again.',
        variant: 'destructive',
      });
      return;
    }

    // Create the outing first
    const newOuting = await onAddOuting({
      pitcherName: pitcher.name,
      date: sessionData.date,
      eventType: sessionData.eventType,
      pitchCount: sessionData.pitchCount,
      strikes: sessionData.strikes,
      maxVelo: sessionData.maxVelo,
      notes: `Live charted session - ${sessionData.pitches.length} pitches`,
    });

    if (newOuting) {
      // Convert LivePitch to pitch location format
      const pitchLocations = sessionData.pitches.map(p => ({
        pitchNumber: p.pitchNumber,
        pitchType: p.pitchType,
        xLocation: p.xLocation,
        yLocation: p.yLocation,
        isStrike: p.isStrike,
      }));

      // Add pitch locations
      const success = await addPitchLocations(newOuting.id, pitcher.id, pitchLocations);
      
      if (success) {
        toast({
          title: 'Session saved!',
          description: `${sessionData.pitchCount} pitches recorded${sessionData.maxVelo ? ` • Max velo: ${sessionData.maxVelo}` : ''}.`,
        });
        setRefreshKey(k => k + 1);
      }
    }

    setShowLiveCharting(false);
  }, [onAddOuting, pitcher.name, pitcher.id, addPitchLocations, toast]);


  // Show live charting session if active
  if (showLiveCharting) {
    return (
      <LiveChartingSession
        pitcher={pitcher}
        pitchTypes={pitchTypes}
        onPitchTypesUpdated={() => fetchPitchTypes(pitcher.id).then(setPitchTypes)}
        onComplete={handleLiveSessionComplete}
        onCancel={() => setShowLiveCharting(false)}
      />
    );
  }

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Floating home button for mobile/tablet */}
      <button
        onClick={onBack}
        className="fixed bottom-20 right-4 z-50 sm:hidden h-12 w-12 rounded-full shadow-lg bg-primary hover:bg-primary/90 text-primary-foreground flex items-center justify-center"
        aria-label="Back to players"
      >
        <ArrowLeft className="h-5 w-5" />
      </button>
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h2 className="font-display text-2xl font-bold text-foreground">{pitcher.name}</h2>
          <StatusBadge status={pitcher.restStatus} className="mt-1" />
        </div>
        <div className="flex gap-2 shrink-0">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setShowPitchTypeConfig(true)}
            title="Configure pitch types"
          >
            <Settings className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={handleShare}>
            <Share2 className="w-4 h-4 mr-2" />
            Share
          </Button>
        </div>
      </div>

      {/* Action Buttons - Live Session & Log Outing */}
      {onAddOuting && (
        <div className="flex gap-3">
          <Button 
            onClick={() => setShowLiveCharting(true)}
            className="flex-1 h-14 text-lg font-bold bg-primary hover:bg-primary/90"
          >
            <Activity className="w-5 h-5 mr-2" />
            Live Session
          </Button>
          <Button 
            onClick={() => setShowLogOuting(true)}
            variant="outline"
            className="flex-1 h-14 text-lg font-bold border-accent text-accent hover:bg-accent/10"
          >
            <ClipboardList className="w-5 h-5 mr-2" />
            Log Outing
          </Button>
        </div>
      )}
      {/* Arm Care Status Card */}
      {(pitcher.lastPitchCount > 0 || pitcher.coachNotes) && (
        <Card className="glass-card border-primary/30 bg-primary/5">
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
                    <div className="mt-2 text-xs text-muted-foreground">
                      <p className="font-medium mb-1">Pitch Count Rules:</p>
                      <div className="grid grid-cols-2 gap-1">
                        <span>76+ pitches → 4 days</span>
                        <span>61-75 pitches → 3 days</span>
                        <span>46-60 pitches → 2 days</span>
                        <span>31-45 pitches → 1 day</span>
                      </div>
                    </div>
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

      {/* Weekly Accountability - Coach View */}
      <WorkoutCompletionDisplay pitcherId={pitcher.id} />

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
        const sortedOutings = [...pitcher.outings].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
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
        
        const formatVideoDate = (dateStr: string) => {
          // Parse as local date to avoid timezone shift
          const [year, month, day] = dateStr.split('-').map(Number);
          const date = new Date(year, month - 1, day, 12, 0, 0, 0);
          return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        };
        
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
                      {formatVideoDate(outingWithVideo!.date)} - {outingWithVideo!.eventType}
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

      {/* Outing History */}
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
                      <div className="flex items-center gap-2">
                        {/* Video button */}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setVideoOuting(outing)}
                          title={outing.videoUrl1 || outing.videoUrl2 ? 'View/edit videos' : 'Add videos'}
                        >
                          <Video className={`w-4 h-4 ${outing.videoUrl1 || outing.videoUrl2 ? 'text-primary' : ''}`} />
                        </Button>
                        {outing.videoUrl && !outing.videoUrl1 && !outing.videoUrl2 && (
                          <a 
                            href={outing.videoUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-sm text-primary hover:text-primary/80 transition-colors"
                            title="External video link"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setPitchMapOuting(outing)}
                          title={outingPitchCounts[outing.id] ? `${outingPitchCounts[outing.id]} pitches mapped` : 'Add pitch map'}
                        >
                          <MapPin className={`w-4 h-4 ${outingPitchCounts[outing.id] ? 'text-primary' : ''}`} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setEditingOuting(outing)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => setDeletingOuting(outing)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
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
                        <span className="font-medium text-foreground">{outing.strikes}</span>
                        <span className="text-xs text-muted-foreground ml-1">
                          ({outing.pitchCount > 0 ? ((outing.strikes / outing.pitchCount) * 100).toFixed(0) : 0}%)
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Velo: </span>
                        <span className="font-medium text-foreground">{outing.maxVelo}</span>
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

      {/* Edit Dialog */}
      <EditOutingDialog
        outing={editingOuting}
        open={!!editingOuting}
        onOpenChange={(open) => !open && setEditingOuting(null)}
        onSave={onUpdateOuting}
      />

      {/* Delete Dialog */}
      <DeleteOutingDialog
        open={!!deletingOuting}
        onOpenChange={(open) => !open && setDeletingOuting(null)}
        onConfirm={() => deletingOuting ? onDeleteOuting(deletingOuting.id) : Promise.resolve(false)}
        outingDate={deletingOuting ? formatDate(deletingOuting.date) : undefined}
      />

      {/* Pitch Map Dialog */}
      <OutingPitchMapDialog
        outing={pitchMapOuting}
        pitcherId={pitcher.id}
        pitchTypes={pitchTypes}
        open={!!pitchMapOuting}
        onOpenChange={(open) => !open && setPitchMapOuting(null)}
        onPitchMapUpdated={() => setRefreshKey(k => k + 1)}
      />

      {/* Pitch Type Config Dialog */}
      <PitchTypeConfigDialog
        open={showPitchTypeConfig}
        onOpenChange={setShowPitchTypeConfig}
        pitcherId={pitcher.id}
        pitcherName={pitcher.name}
      />

      {/* Video Dialog */}
      <Dialog open={!!videoOuting} onOpenChange={(open) => !open && setVideoOuting(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Session Videos</DialogTitle>
            {videoOuting && (
              <p className="text-sm text-muted-foreground">
                {formatDate(videoOuting.date)} - {videoOuting.eventType}
              </p>
            )}
          </DialogHeader>
          
          {videoOuting && (
            <OutingVideoSection
              outingId={videoOuting.id}
              pitcherId={pitcher.id}
              pitchTypes={pitchTypes}
              videoUrl1={videoOuting.videoUrl1}
              videoUrl2={videoOuting.videoUrl2}
              video1PitchType={videoOuting.video1PitchType}
              video1Velocity={videoOuting.video1Velocity}
              video2PitchType={videoOuting.video2PitchType}
              video2Velocity={videoOuting.video2Velocity}
              onVideosUpdated={() => setRefreshKey(k => k + 1)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Log Outing Dialog */}
      <Dialog open={showLogOuting} onOpenChange={setShowLogOuting}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto p-0">
          <OutingForm
            pitchers={[pitcher]}
            defaultPitcherName={pitcher.name}
            onSubmit={async (outingData, pitchLocations) => {
              if (onAddOuting) {
                const newOuting = await onAddOuting(outingData, pitchLocations);
                if (newOuting) {
                  toast({
                    title: 'Outing logged!',
                    description: `${outingData.pitchCount} pitches recorded.`,
                  });
                  setShowLogOuting(false);
                  setRefreshKey(k => k + 1);
                }
              }
            }}
            onCancel={() => setShowLogOuting(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
