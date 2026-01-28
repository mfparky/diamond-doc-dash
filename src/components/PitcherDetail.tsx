import { useState, useEffect, useCallback } from 'react';
import { Pitcher, Outing, getDaysRestNeeded } from '@/types/pitcher';
import { StatusBadge } from './StatusBadge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ArrowLeft, TrendingUp, Target, Gauge, Calendar, Video, ExternalLink, Shield, Pencil, Trash2, Share2, Settings, MapPin } from 'lucide-react';
import { EditOutingDialog } from './EditOutingDialog';
import { DeleteOutingDialog } from './DeleteOutingDialog';
import { OutingPitchMapDialog } from './OutingPitchMapDialog';
import { OutingVideoSection } from './OutingVideoSection';
import { PitchCountChart } from './PitchCountChart';
import { StrikeLocationViewer } from './StrikeLocationViewer';
import { PitchTypeConfigDialog } from './PitchTypeConfigDialog';
import { usePitchLocations } from '@/hooks/use-pitch-locations';
import { PitchTypeConfig, DEFAULT_PITCH_TYPES, PitchLocation } from '@/types/pitch-location';
import { useToast } from '@/hooks/use-toast';
import { useSwipe } from '@/hooks/use-swipe';
interface PitcherDetailProps {
  pitcher: Pitcher;
  onBack: () => void;
  onUpdateOuting: (id: string, data: Partial<Omit<Outing, 'id' | 'timestamp'>>) => Promise<boolean>;
  onDeleteOuting: (id: string) => Promise<boolean>;
}

export function PitcherDetail({ pitcher, onBack, onUpdateOuting, onDeleteOuting }: PitcherDetailProps) {
  const [editingOuting, setEditingOuting] = useState<Outing | null>(null);
  const [deletingOuting, setDeletingOuting] = useState<Outing | null>(null);
  const [pitchMapOuting, setPitchMapOuting] = useState<Outing | null>(null);
  const [videoOuting, setVideoOuting] = useState<Outing | null>(null);
  const [showPitchTypeConfig, setShowPitchTypeConfig] = useState(false);
  const [pitchTypes, setPitchTypes] = useState<PitchTypeConfig>(DEFAULT_PITCH_TYPES);
  const [outingPitchCounts, setOutingPitchCounts] = useState<Record<string, number>>({});
  const [refreshKey, setRefreshKey] = useState(0);
  const { fetchPitchTypes, fetchPitchLocationsForOuting } = usePitchLocations();
  const { toast } = useToast();

  // Load pitch location counts for each outing
  const loadOutingPitchCounts = useCallback(async () => {
    const counts: Record<string, number> = {};
    for (const outing of pitcher.outings) {
      const locations = await fetchPitchLocationsForOuting(outing.id);
      counts[outing.id] = locations.length;
    }
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
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      weekday: 'short',
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  const daysRestNeeded = pitcher.lastPitchCount > 0 ? getDaysRestNeeded(pitcher.lastPitchCount) : 0;

  // Swipe right to go back
  const swipeHandlers = useSwipe({
    onSwipeRight: onBack,
    threshold: 75,
  });

  return (
    <div className="space-y-6 animate-slide-up" {...swipeHandlers}>
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

      {/* Current Focus & Latest Notes - side by side */}
      {(pitcher.focus || pitcher.notes) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {pitcher.focus && (
            <Card className="glass-card border-accent/30 bg-accent/5">
              <CardContent className="p-4">
                <p className="text-sm font-medium text-accent">Current Focus</p>
                <p className="text-foreground mt-1">{pitcher.focus}</p>
              </CardContent>
            </Card>
          )}
          {pitcher.notes && (
            <Card className="glass-card">
              <CardContent className="p-4">
                <p className="text-sm font-medium text-muted-foreground">Latest Notes</p>
                <p className="text-foreground mt-1">{pitcher.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

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
    </div>
  );
}
