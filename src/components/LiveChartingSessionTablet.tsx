import { useState, useCallback, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PitchTypeConfig, DEFAULT_PITCH_TYPES, PITCH_TYPE_COLORS } from '@/types/pitch-location';
import { isStrike, getZoneAspectStyle, STRIKE_ZONE, GRID_CONFIG } from '@/lib/strike-zone';
import { Undo2, Save, X, Video, Pencil } from 'lucide-react';
import { Pitcher, Outing } from '@/types/pitcher';
import { useVideoCapture } from '@/hooks/use-video-capture';
import { VideoSaveDialog } from '@/components/VideoSaveDialog';
import { PitchTypeConfigDialog } from '@/components/PitchTypeConfigDialog';
import { LivePitch } from '@/components/LiveChartingSession';

interface LiveChartingSessionTabletProps {
  pitcher: Pitcher;
  pitchTypes?: PitchTypeConfig;
  onPitchTypesUpdated?: () => void;
  onComplete: (sessionData: {
    pitches: LivePitch[];
    maxVelo: number;
    pitchCount: number;
    strikes: number;
    eventType: Outing['eventType'];
    date: string;
  }) => void;
  onCancel: () => void;
}

function getTodayDateString(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function LiveChartingSessionTablet({
  pitcher,
  pitchTypes = DEFAULT_PITCH_TYPES,
  onPitchTypesUpdated,
  onComplete,
  onCancel,
}: LiveChartingSessionTabletProps) {
  const [plottedPitches, setPlottedPitches] = useState<LivePitch[]>([]);
  const [selectedPitchType, setSelectedPitchType] = useState<number>(1);
  const [velocityInput, setVelocityInput] = useState('');
  const [showVideoDialog, setShowVideoDialog] = useState(false);
  const [showPitchTypeConfig, setShowPitchTypeConfig] = useState(false);
  const velocityInputRef = useRef<HTMLInputElement>(null);

  const { isRecording, startRecording, stopRecording, cancelRecording, capturedVideos, pendingVideo, clearPendingVideo, isNative } = useVideoCapture();

  // Auto-calculate max velo from recorded pitches
  const maxVelo = useMemo(() => {
    const velocities = plottedPitches
      .map(p => p.velocity)
      .filter((v): v is number => v !== undefined && v > 0);
    return velocities.length > 0 ? Math.max(...velocities) : 0;
  }, [plottedPitches]);

  // Stats
  const strikes = plottedPitches.filter(p => p.isStrike).length;
  const balls = plottedPitches.length - strikes;
  const strikePercentage = plottedPitches.length > 0 
    ? ((strikes / plottedPitches.length) * 100).toFixed(0) 
    : '0';

  // Pitch type breakdown
  const pitchTypeBreakdown = useMemo(() => {
    const breakdown: Record<string, { count: number; strikes: number }> = {};
    plottedPitches.forEach(pitch => {
      const key = pitch.pitchType.toString();
      if (!breakdown[key]) {
        breakdown[key] = { count: 0, strikes: 0 };
      }
      breakdown[key].count++;
      if (pitch.isStrike) breakdown[key].strikes++;
    });
    return breakdown;
  }, [plottedPitches]);

  // Handle zone tap - plots pitch immediately with selected type
  const handleZoneTap = useCallback((x: number, y: number, hasVideo: boolean = false) => {
    const velocity = velocityInput ? parseInt(velocityInput) : undefined;
    
    const newPitch: LivePitch = {
      pitchNumber: plottedPitches.length + 1,
      pitchType: selectedPitchType,
      xLocation: x,
      yLocation: y,
      isStrike: isStrike(x, y),
      velocity,
      hasVideo,
    };
    
    setPlottedPitches((prev) => [...prev, newPitch]);
    setVelocityInput(''); // Clear velocity after each pitch
  }, [selectedPitchType, velocityInput, plottedPitches.length]);

  // Handle recording start
  const handleStartRecording = useCallback(() => {
    startRecording();
  }, [startRecording]);

  // Stop recording and plot pitch
  const handleStopRecording = useCallback(async (x: number, y: number) => {
    const pitchNumber = plottedPitches.length + 1;
    const pitchIsStrike = isStrike(x, y);
    
    const capturedVideo = await stopRecording({
      pitcherName: pitcher.name,
      date: getTodayDateString(),
      pitchNumber,
      pitchType: pitchTypes[selectedPitchType.toString()] || 'Unknown',
      velocity: velocityInput ? parseInt(velocityInput) : undefined,
      isStrike: pitchIsStrike,
    });

    handleZoneTap(x, y, !!capturedVideo);
    
    if (capturedVideo && !isNative) {
      setShowVideoDialog(true);
    }
  }, [plottedPitches.length, pitcher.name, pitchTypes, selectedPitchType, velocityInput, stopRecording, handleZoneTap, isNative]);

  const handleUndo = useCallback(() => {
    setPlottedPitches((prev) => prev.slice(0, -1));
  }, []);

  const handleComplete = useCallback(() => {
    if (plottedPitches.length === 0) return;
    
    onComplete({
      pitches: plottedPitches,
      maxVelo,
      pitchCount: plottedPitches.length,
      strikes,
      eventType: 'Bullpen',
      date: getTodayDateString(),
    });
  }, [plottedPitches, maxVelo, strikes, onComplete]);

  // Convert normalized coordinates to percentage for positioning
  const toPercent = (val: number) => ((val + 1) / 2) * 100;

  // Calculate strike zone box position
  const zoneLeft = toPercent(STRIKE_ZONE.ZONE_LEFT);
  const zoneRight = 100 - toPercent(STRIKE_ZONE.ZONE_RIGHT);
  const zoneTop = 100 - toPercent(STRIKE_ZONE.ZONE_TOP);
  const zoneBottom = toPercent(STRIKE_ZONE.ZONE_BOTTOM);

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-card">
        <div className="flex items-center gap-4">
          <h2 className="font-display text-2xl font-bold text-foreground">{pitcher.name}</h2>
          <span className="text-lg text-muted-foreground">Live Session</span>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="lg"
            onClick={handleUndo}
            disabled={plottedPitches.length === 0}
          >
            <Undo2 className="w-5 h-5 mr-2" />
            Undo
          </Button>
          <Button
            size="lg"
            onClick={handleComplete}
            disabled={plottedPitches.length === 0}
            className="px-8"
          >
            <Save className="w-5 h-5 mr-2" />
            Save ({plottedPitches.length})
          </Button>
          <Button variant="ghost" size="icon" onClick={onCancel}>
            <X className="w-6 h-6" />
          </Button>
        </div>
      </div>

      {/* Main Content - Three Column Layout */}
      <div className="flex-1 flex overflow-hidden p-4 gap-4">
        {/* Left Column - Pitch Type Selection & Velocity */}
        <div className="w-64 flex flex-col gap-4">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Pitch Type</CardTitle>
                <button
                  type="button"
                  onClick={() => setShowPitchTypeConfig(true)}
                  className="text-xs text-primary hover:text-primary/80 flex items-center gap-1"
                >
                  <Pencil className="w-3 h-3" />
                  Edit
                </button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {[1, 2, 3, 4, 5].map((pt) => (
                <button
                  key={pt}
                  type="button"
                  onClick={() => setSelectedPitchType(pt)}
                  className={`w-full h-14 text-lg font-bold rounded-lg flex items-center justify-center gap-3 transition-all ${
                    selectedPitchType === pt
                      ? 'ring-2 ring-offset-2 ring-primary scale-[1.02]'
                      : 'opacity-70 hover:opacity-100'
                  }`}
                  style={{
                    backgroundColor: PITCH_TYPE_COLORS[pt.toString()],
                    color: 'white',
                  }}
                >
                  {pitchTypes[pt.toString()] || `Pitch ${pt}`}
                </button>
              ))}
            </CardContent>
          </Card>

          {/* Velocity Input */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Velocity (optional)</CardTitle>
            </CardHeader>
            <CardContent>
              <Input
                ref={velocityInputRef}
                type="tel"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="MPH"
                value={velocityInput}
                onChange={(e) => setVelocityInput(e.target.value)}
                className="h-14 text-2xl text-center font-bold"
              />
              <p className="text-xs text-muted-foreground mt-2 text-center">
                Enter before plotting each pitch
              </p>
            </CardContent>
          </Card>

          {/* Video Recording */}
          <Card>
            <CardContent className="pt-4">
              {!isRecording ? (
                <Button
                  variant="outline"
                  className="w-full h-12 border-accent text-accent hover:bg-accent/10"
                  onClick={handleStartRecording}
                >
                  <Video className="w-5 h-5 mr-2" />
                  Record Video
                </Button>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-center gap-2 p-3 bg-destructive/10 rounded-lg border border-destructive/30">
                    <div className="w-3 h-3 bg-destructive rounded-full animate-pulse" />
                    <span className="text-destructive font-semibold">Recording...</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={cancelRecording}
                    className="w-full text-muted-foreground"
                  >
                    Cancel
                  </Button>
                </div>
              )}
              {capturedVideos.length > 0 && !isRecording && (
                <p className="text-xs text-muted-foreground text-center mt-2">
                  {capturedVideos.length} video{capturedVideos.length !== 1 ? 's' : ''} captured
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center">
          <Label className="text-sm font-medium mb-8">
            {isRecording 
              ? 'Tap to stop recording & plot pitch' 
              : `Tap to plot ${pitchTypes[selectedPitchType.toString()] || 'pitch'} #${plottedPitches.length + 1}`}
          </Label>
          <div
            className={`relative rounded-lg border-2 cursor-crosshair touch-none ${
              isRecording 
                ? 'bg-destructive/10 border-destructive/50' 
                : 'bg-secondary/30 border-border'
            }`}
            style={{
              ...getZoneAspectStyle('lg'),
              width: '100%',
              maxWidth: '400px',
              height: 'auto',
              aspectRatio: '19.94 / 25.79',
            }}
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
              const y = 1 - ((e.clientY - rect.top) / rect.height) * 2;
              if (isRecording) {
                handleStopRecording(x, y);
              } else {
                handleZoneTap(x, y);
              }
            }}
          >
            {/* Background grid */}
            <div className="absolute inset-0 opacity-20 pointer-events-none">
              <div 
                className="w-full h-full grid"
                style={{
                  gridTemplateColumns: `repeat(${GRID_CONFIG.COLS}, 1fr)`,
                  gridTemplateRows: `repeat(${GRID_CONFIG.ROWS}, 1fr)`,
                }}
              >
                {Array.from({ length: GRID_CONFIG.COLS * GRID_CONFIG.ROWS }).map((_, i) => (
                  <div key={i} className="border border-muted-foreground/30" />
                ))}
              </div>
            </div>

            {/* Strike zone box */}
            <div
              className="absolute border-2 border-foreground/80 bg-primary/5 pointer-events-none"
              style={{
                left: `${zoneLeft}%`,
                right: `${zoneRight}%`,
                top: `${zoneTop}%`,
                bottom: `${zoneBottom}%`,
              }}
            />

            {/* Plotted pitches */}
            {plottedPitches.map((pitch, idx) => (
              <div
                key={idx}
                className={`absolute w-7 h-7 rounded-full transform -translate-x-1/2 -translate-y-1/2 border-2 flex items-center justify-center text-xs text-white font-bold shadow-lg pointer-events-none ${
                  pitch.hasVideo ? 'border-accent ring-2 ring-accent/50' : 'border-white/70'
                }`}
                style={{
                  left: `${toPercent(pitch.xLocation)}%`,
                  top: `${100 - toPercent(pitch.yLocation)}%`,
                  backgroundColor: PITCH_TYPE_COLORS[pitch.pitchType.toString()],
                }}
              >
                {pitch.pitchNumber}
              </div>
            ))}

            {/* Zone labels */}
            <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-sm text-muted-foreground pointer-events-none">High</span>
            <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-sm text-muted-foreground pointer-events-none">Low</span>
            <span className="absolute top-1/2 -left-8 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">In</span>
            <span className="absolute top-1/2 -right-10 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">Out</span>
          </div>
        </div>

        {/* Right Column - Stats & Recent Pitches */}
        <div className="w-72 flex flex-col gap-4">
          {/* Session Stats */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Session Stats</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                <div className="text-center p-3 bg-secondary/50 rounded-lg">
                  <p className="text-3xl font-bold text-foreground">{plottedPitches.length}</p>
                  <p className="text-xs text-muted-foreground">Pitches</p>
                </div>
                <div className="text-center p-3 bg-secondary/50 rounded-lg">
                  <p className="text-3xl font-bold text-primary">{maxVelo || '-'}</p>
                  <p className="text-xs text-muted-foreground">Max Velo</p>
                </div>
                <div className="text-center p-3 bg-secondary/50 rounded-lg">
                  <p className="text-3xl font-bold text-foreground">{strikes}</p>
                  <p className="text-xs text-muted-foreground">Strikes</p>
                </div>
                <div className="text-center p-3 bg-secondary/50 rounded-lg">
                  <p className="text-3xl font-bold text-foreground">{balls}</p>
                  <p className="text-xs text-muted-foreground">Balls</p>
                </div>
              </div>
              <div className="mt-3 text-center p-2 bg-primary/10 rounded-lg">
                <p className="text-2xl font-bold text-primary">{strikePercentage}%</p>
                <p className="text-xs text-muted-foreground">Strike Rate</p>
              </div>
            </CardContent>
          </Card>

          {/* Pitch Type Breakdown */}
          <Card className="flex-1 overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Pitch Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="overflow-y-auto max-h-40">
              {Object.entries(pitchTypeBreakdown).length > 0 ? (
                <div className="space-y-2">
                  {Object.entries(pitchTypeBreakdown).map(([pt, data]) => (
                    <div
                      key={pt}
                      className="flex items-center justify-between p-2 rounded-lg text-white"
                      style={{ backgroundColor: PITCH_TYPE_COLORS[pt] }}
                    >
                      <span className="font-medium">{pitchTypes[pt]}</span>
                      <div className="text-sm">
                        <span className="font-bold">{data.count}</span>
                        <span className="text-white/80 ml-1">
                          ({Math.round((data.strikes / data.count) * 100)}% K)
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No pitches recorded yet
                </p>
              )}
            </CardContent>
          </Card>

          {/* Recent Pitches */}
          <Card className="flex-1 overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Recent Pitches</CardTitle>
            </CardHeader>
            <CardContent className="overflow-y-auto max-h-48">
              {plottedPitches.length > 0 ? (
                <div className="space-y-1">
                  {plottedPitches.slice(-8).reverse().map((pitch) => (
                    <div
                      key={pitch.pitchNumber}
                      className="flex items-center justify-between px-2 py-1.5 rounded text-sm text-white"
                      style={{ backgroundColor: PITCH_TYPE_COLORS[pitch.pitchType.toString()] }}
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold bg-white/20">
                          {pitch.pitchNumber}
                        </span>
                        <span>{pitchTypes[pitch.pitchType.toString()]}</span>
                        {pitch.hasVideo && <Video className="w-3 h-3" />}
                      </div>
                      <div className="flex items-center gap-2">
                        {pitch.velocity && <span className="text-white/80">{pitch.velocity}</span>}
                        <span className="font-bold">
                          {pitch.isStrike ? 'K' : 'B'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Tap the zone to plot pitches
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Video Save Dialog */}
      <VideoSaveDialog
        open={showVideoDialog}
        onOpenChange={setShowVideoDialog}
        videoBlob={pendingVideo?.blob || null}
        fileName={pendingVideo?.fileName || ''}
        onDiscard={clearPendingVideo}
      />

      {/* Pitch Type Config Dialog */}
      <PitchTypeConfigDialog
        open={showPitchTypeConfig}
        onOpenChange={(open) => {
          setShowPitchTypeConfig(open);
          if (!open && onPitchTypesUpdated) {
            onPitchTypesUpdated();
          }
        }}
        pitcherId={pitcher.id}
        pitcherName={pitcher.name}
      />
    </div>
  );
}
