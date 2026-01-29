import { useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PitchTypeConfig, DEFAULT_PITCH_TYPES, PITCH_TYPE_COLORS } from '@/types/pitch-location';
import { isStrike, getZoneAspectStyle, STRIKE_ZONE, GRID_CONFIG } from '@/lib/strike-zone';
import { Undo2, Save, X, Zap, Video, Square } from 'lucide-react';
import { Pitcher, Outing } from '@/types/pitcher';
import { useVideoCapture } from '@/hooks/use-video-capture';
import { VideoSaveDialog } from '@/components/VideoSaveDialog';

export interface LivePitch {
  pitchNumber: number;
  pitchType: number;
  xLocation: number;
  yLocation: number;
  isStrike: boolean;
  velocity?: number;
  hasVideo?: boolean;
}

interface LiveChartingSessionProps {
  pitcher: Pitcher;
  pitchTypes?: PitchTypeConfig;
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

// Helper to get today's date as YYYY-MM-DD
function getTodayDateString(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function LiveChartingSession({
  pitcher,
  pitchTypes = DEFAULT_PITCH_TYPES,
  onComplete,
  onCancel,
}: LiveChartingSessionProps) {
  const [selectedPitchType, setSelectedPitchType] = useState<number>(1);
  const [plottedPitches, setPlottedPitches] = useState<LivePitch[]>([]);
  const [currentVelocity, setCurrentVelocity] = useState<string>('');
  const [pendingVideoLocation, setPendingVideoLocation] = useState<{x: number, y: number} | null>(null);
  const [showVideoDialog, setShowVideoDialog] = useState(false);
  
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
  const strikePercentage = plottedPitches.length > 0 
    ? ((strikes / plottedPitches.length) * 100).toFixed(0) 
    : '0';

  const handlePlotPitch = useCallback((x: number, y: number, hasVideo: boolean = false) => {
    const newPitch: LivePitch = {
      pitchNumber: plottedPitches.length + 1,
      pitchType: selectedPitchType,
      xLocation: x,
      yLocation: y,
      isStrike: isStrike(x, y),
      velocity: currentVelocity ? parseInt(currentVelocity) : undefined,
      hasVideo,
    };
    setPlottedPitches((prev) => [...prev, newPitch]);
    // Clear velocity after each pitch for fresh entry
    setCurrentVelocity('');
  }, [plottedPitches.length, selectedPitchType, currentVelocity]);

  // Start recording video for next pitch
  const handleStartRecording = useCallback(async () => {
    const success = await startRecording();
    if (success) {
      // Recording started - user will plot pitch location after stopping
    }
  }, [startRecording]);

  // Stop recording and save with pitch metadata
  const handleStopRecording = useCallback(async (x: number, y: number) => {
    const pitchNumber = plottedPitches.length + 1;
    const pitchIsStrike = isStrike(x, y);
    
    const capturedVideo = await stopRecording({
      pitcherName: pitcher.name,
      date: getTodayDateString(),
      pitchNumber,
      pitchType: pitchTypes[selectedPitchType.toString()] || `P${selectedPitchType}`,
      velocity: currentVelocity ? parseInt(currentVelocity) : undefined,
      isStrike: pitchIsStrike,
    });

    // Add the pitch with video flag
    handlePlotPitch(x, y, !!capturedVideo);
    setPendingVideoLocation(null);
    
    // Show video save dialog for web users (non-native)
    if (capturedVideo && !isNative) {
      setShowVideoDialog(true);
    }
  }, [plottedPitches.length, pitcher.name, selectedPitchType, pitchTypes, currentVelocity, stopRecording, handlePlotPitch, isNative]);

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
      eventType: 'Bullpen', // Default for live charting
      date: getTodayDateString(),
    });
  }, [plottedPitches, maxVelo, strikes, onComplete]);

  // Convert normalized coordinates to percentage for positioning
  const toPercent = (val: number) => ((val + 1) / 2) * 100;

  // Calculate strike zone box position (CSS positioning)
  const zoneLeft = toPercent(STRIKE_ZONE.ZONE_LEFT);
  const zoneRight = 100 - toPercent(STRIKE_ZONE.ZONE_RIGHT);
  const zoneTop = 100 - toPercent(STRIKE_ZONE.ZONE_TOP);
  const zoneBottom = toPercent(STRIKE_ZONE.ZONE_BOTTOM);

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div>
          <h2 className="font-display text-xl font-bold text-foreground">{pitcher.name}</h2>
          <p className="text-sm text-muted-foreground">Live Session</p>
        </div>
        <Button variant="ghost" size="icon" onClick={onCancel}>
          <X className="w-6 h-6" />
        </Button>
      </div>

      {/* Main Content - Scrollable */}
      <div className={`flex-1 overflow-y-auto p-4 space-y-4 ${isRecording ? 'flex flex-col justify-center' : ''}`}>
        {/* Live Stats Bar - Hide when recording to center strike zone */}
        {!isRecording && (
          <div className="grid grid-cols-4 gap-2">
            <Card className="bg-secondary/50">
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold text-foreground">{plottedPitches.length}</p>
                <p className="text-xs text-muted-foreground">Pitches</p>
              </CardContent>
            </Card>
            <Card className="bg-secondary/50">
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold text-foreground">{strikes}</p>
                <p className="text-xs text-muted-foreground">Strikes</p>
              </CardContent>
            </Card>
            <Card className="bg-secondary/50">
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold text-foreground">{strikePercentage}%</p>
                <p className="text-xs text-muted-foreground">K%</p>
              </CardContent>
            </Card>
            <Card className="bg-primary/10 border-primary/30">
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold text-primary">{maxVelo || '-'}</p>
                <p className="text-xs text-muted-foreground">Max Velo</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Pitch Type Selector - Hide when recording */}
        {!isRecording && (
          <div className="space-y-2">
            <Label className="text-sm font-medium">Pitch Type</Label>
            <div className="grid grid-cols-5 gap-2">
              {[1, 2, 3, 4, 5].map((pt) => (
                <Button
                  key={pt}
                  variant={selectedPitchType === pt ? 'default' : 'outline'}
                  className="h-14 text-lg font-bold"
                  style={{
                    backgroundColor: selectedPitchType === pt ? PITCH_TYPE_COLORS[pt.toString()] : undefined,
                    borderColor: PITCH_TYPE_COLORS[pt.toString()],
                    borderWidth: selectedPitchType === pt ? 0 : 2,
                  }}
                  onClick={() => setSelectedPitchType(pt)}
                >
                  {pitchTypes[pt.toString()] || `P${pt}`}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Velocity Input - Hide when recording */}
        {!isRecording && (
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary" />
              Velocity (optional)
            </Label>
            <Input
              type="number"
              inputMode="numeric"
              placeholder="Enter velo..."
              value={currentVelocity}
              onChange={(e) => setCurrentVelocity(e.target.value)}
              className="h-14 text-2xl text-center font-bold"
            />
          </div>
        )}

        {/* Video Recording Section */}
        {!isRecording ? (
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Video className="w-4 h-4 text-accent" />
              Video Capture
            </Label>
            <Button
              variant="outline"
              className="w-full h-14 text-lg border-accent text-accent hover:bg-accent/10"
              onClick={handleStartRecording}
            >
              <Video className="w-5 h-5 mr-2" />
              Start Recording for Next Pitch
            </Button>
            {capturedVideos.length > 0 && (
              <p className="text-xs text-muted-foreground text-center">
                {capturedVideos.length} video{capturedVideos.length !== 1 ? 's' : ''} captured this session
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3 text-center">
            <div className="flex items-center justify-center gap-2 p-4 bg-destructive/10 rounded-lg border border-destructive/30">
              <div className="w-4 h-4 bg-destructive rounded-full animate-pulse" />
              <span className="text-destructive font-semibold text-lg">Recording...</span>
            </div>
            <p className="text-muted-foreground">Tap the zone below to stop & save</p>
          </div>
        )}

        {/* Strike Zone */}
        <div className={`space-y-2 ${isRecording ? 'flex-1 flex flex-col justify-center' : ''}`}>
          <Label className="text-sm font-medium">
            {isRecording 
              ? 'Tap location to stop recording & plot pitch' 
              : `Tap to plot pitch #${plottedPitches.length + 1}`}
          </Label>
          <div className="flex justify-center py-2">
            <div
              className={`relative rounded-lg border-2 cursor-crosshair active:bg-secondary/50 touch-none ${
                isRecording 
                  ? 'bg-destructive/10 border-destructive/50' 
                  : 'bg-secondary/30 border-border'
              }`}
              style={getZoneAspectStyle('lg')}
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
                const y = 1 - ((e.clientY - rect.top) / rect.height) * 2;
                if (isRecording) {
                  handleStopRecording(x, y);
                } else {
                  handlePlotPitch(x, y);
                }
              }}
              onTouchEnd={(e) => {
                e.preventDefault();
                const touch = e.changedTouches[0];
                const rect = e.currentTarget.getBoundingClientRect();
                const x = ((touch.clientX - rect.left) / rect.width) * 2 - 1;
                const y = 1 - ((touch.clientY - rect.top) / rect.height) * 2;
                if (isRecording) {
                  handleStopRecording(x, y);
                } else {
                  handlePlotPitch(x, y);
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
                  className={`absolute w-6 h-6 rounded-full transform -translate-x-1/2 -translate-y-1/2 border-2 flex items-center justify-center text-[10px] text-white font-bold shadow-lg pointer-events-none ${
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

              {/* Zone labels - only top/bottom to save horizontal space */}
              <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-xs text-muted-foreground pointer-events-none">High</span>
              <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-xs text-muted-foreground pointer-events-none">Low</span>
            </div>
          </div>
        </div>

        {/* Recent pitches list - Hide when recording */}
        {!isRecording && plottedPitches.length > 0 && (
          <div className="space-y-2">
            <Label className="text-sm font-medium">Recent Pitches</Label>
            <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto">
              {plottedPitches.slice(-10).reverse().map((pitch) => (
                <div
                  key={pitch.pitchNumber}
                  className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium text-white"
                  style={{ backgroundColor: PITCH_TYPE_COLORS[pitch.pitchType.toString()] }}
                >
                  {pitch.hasVideo && <Video className="w-3 h-3" />}
                  #{pitch.pitchNumber} {pitchTypes[pitch.pitchType.toString()]}
                  {pitch.velocity && <span className="ml-1 opacity-80">{pitch.velocity}</span>}
                  {pitch.isStrike && <span className="ml-1">✓</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Fixed Bottom Action Bar - Show cancel when recording, normal actions otherwise */}
      <div className="p-4 border-t border-border bg-background safe-area-bottom">
        {isRecording ? (
          <Button
            variant="outline"
            size="lg"
            onClick={cancelRecording}
            className="w-full h-14 text-muted-foreground"
          >
            Cancel Recording
          </Button>
        ) : (
          <div className="flex gap-3">
            <Button
              variant="outline"
              size="lg"
              onClick={handleUndo}
              disabled={plottedPitches.length === 0}
              className="flex-1 h-14"
            >
              <Undo2 className="w-5 h-5 mr-2" />
              Undo
            </Button>
            <Button
              size="lg"
              onClick={handleComplete}
              disabled={plottedPitches.length === 0}
              className="flex-[2] h-14 text-lg font-bold"
            >
              <Save className="w-5 h-5 mr-2" />
              Save Session ({plottedPitches.length})
            </Button>
          </div>
        )}
      </div>

      {/* Video Save Dialog for Web Users */}
      <VideoSaveDialog
        open={showVideoDialog}
        onOpenChange={setShowVideoDialog}
        videoBlob={pendingVideo?.blob || null}
        fileName={pendingVideo?.fileName || ''}
        onDiscard={clearPendingVideo}
      />
    </div>
  );
}
