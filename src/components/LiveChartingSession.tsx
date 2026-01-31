import { useState, useCallback, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { PitchTypeConfig, DEFAULT_PITCH_TYPES, PITCH_TYPE_COLORS } from '@/types/pitch-location';
import { isStrike, getZoneAspectStyle, STRIKE_ZONE, GRID_CONFIG } from '@/lib/strike-zone';
import { Undo2, Save, X, Video, Check } from 'lucide-react';
import { Pitcher, Outing } from '@/types/pitcher';
import { useVideoCapture } from '@/hooks/use-video-capture';
import { VideoSaveDialog } from '@/components/VideoSaveDialog';
import { useIsTabletOrLarger } from '@/hooks/use-device';
import { LiveChartingSessionTablet } from '@/components/LiveChartingSessionTablet';

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

type PitchEntryStep = 'idle' | 'selectType' | 'enterVelocity';

// Long press threshold in ms
const LONG_PRESS_DURATION = 500;

export function LiveChartingSession({
  pitcher,
  pitchTypes = DEFAULT_PITCH_TYPES,
  onComplete,
  onCancel,
}: LiveChartingSessionProps) {
  const isTabletOrLarger = useIsTabletOrLarger();

  // Render tablet/desktop version for larger screens
  if (isTabletOrLarger) {
    return (
      <LiveChartingSessionTablet
        pitcher={pitcher}
        pitchTypes={pitchTypes}
        onComplete={onComplete}
        onCancel={onCancel}
      />
    );
  }

  // Mobile version continues below
  return (
    <LiveChartingSessionMobile
      pitcher={pitcher}
      pitchTypes={pitchTypes}
      onComplete={onComplete}
      onCancel={onCancel}
    />
  );
}

// Mobile-specific component (existing implementation)
function LiveChartingSessionMobile({
  pitcher,
  pitchTypes = DEFAULT_PITCH_TYPES,
  onComplete,
  onCancel,
}: LiveChartingSessionProps) {
  const [plottedPitches, setPlottedPitches] = useState<LivePitch[]>([]);
  const [showVideoDialog, setShowVideoDialog] = useState(false);
  
  // Pitch entry flow state
  const [pitchEntryStep, setPitchEntryStep] = useState<PitchEntryStep>('idle');
  const [pendingLocation, setPendingLocation] = useState<{x: number, y: number} | null>(null);
  const [selectedPitchType, setSelectedPitchType] = useState<number | null>(null);
  const [velocityInput, setVelocityInput] = useState('');
  const [pendingHasVideo, setPendingHasVideo] = useState(false);
  const velocityInputRef = useRef<HTMLInputElement>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggeredRef = useRef(false);

  const blurActiveElement = useCallback(() => {
    const el = document.activeElement as HTMLElement | null;
    el?.blur?.();
  }, []);
  
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

  // Handle zone tap - starts the pitch entry flow
  const handleZoneTap = useCallback((x: number, y: number, hasVideo: boolean = false) => {
    // Prevent iOS/Android from keeping the previously-tapped pitch type visually highlighted
    blurActiveElement();
    setPendingLocation({ x, y });
    setPendingHasVideo(hasVideo);
    setPitchEntryStep('selectType');
    setSelectedPitchType(null);
    setVelocityInput('');
  }, [blurActiveElement]);

  // Handle pitch type selection - tap to confirm immediately, long-press for velocity
  const handlePitchTypeSelect = useCallback((pitchType: number, wantsVelocity: boolean = false) => {
    setSelectedPitchType(pitchType);
    if (wantsVelocity) {
      setPitchEntryStep('enterVelocity');
    } else {
      // Immediately confirm without velocity
      if (!pendingLocation) return;
      
      const newPitch: LivePitch = {
        pitchNumber: plottedPitches.length + 1,
        pitchType: pitchType,
        xLocation: pendingLocation.x,
        yLocation: pendingLocation.y,
        isStrike: isStrike(pendingLocation.x, pendingLocation.y),
        velocity: undefined,
        hasVideo: pendingHasVideo,
      };
      
      setPlottedPitches((prev) => [...prev, newPitch]);
      setPitchEntryStep('idle');
      setPendingLocation(null);
      setSelectedPitchType(null);
      setVelocityInput('');
      setPendingHasVideo(false);
    }
  }, [pendingLocation, plottedPitches.length, pendingHasVideo]);

  // Long press handlers for pitch type buttons
  const handlePitchTypePointerDown = useCallback((pitchType: number) => {
    blurActiveElement();
    longPressTriggeredRef.current = false;

    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    // Important for mobile: we only OPEN the velocity dialog on pointerUp (a user gesture)
    // so the keyboard can reliably appear when the input is focused.
    longPressTimerRef.current = setTimeout(() => {
      longPressTriggeredRef.current = true;
    }, LONG_PRESS_DURATION);
  }, [blurActiveElement]);

  const handlePitchTypePointerUp = useCallback((pitchType: number) => {
    blurActiveElement();

    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    const wasLongPress = longPressTriggeredRef.current;
    longPressTriggeredRef.current = false;

    handlePitchTypeSelect(pitchType, wasLongPress);
  }, [blurActiveElement, handlePitchTypeSelect]);

  const handlePitchTypePointerLeave = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    longPressTriggeredRef.current = false;
  }, []);

  // Confirm and save the pitch
  const handleConfirmPitch = useCallback(() => {
    if (!pendingLocation || selectedPitchType === null) return;
    
    const newPitch: LivePitch = {
      pitchNumber: plottedPitches.length + 1,
      pitchType: selectedPitchType,
      xLocation: pendingLocation.x,
      yLocation: pendingLocation.y,
      isStrike: isStrike(pendingLocation.x, pendingLocation.y),
      velocity: velocityInput ? parseInt(velocityInput) : undefined,
      hasVideo: pendingHasVideo,
    };
    
    setPlottedPitches((prev) => [...prev, newPitch]);
    setPitchEntryStep('idle');
    setPendingLocation(null);
    setSelectedPitchType(null);
    setVelocityInput('');
    setPendingHasVideo(false);
    blurActiveElement();
  }, [pendingLocation, selectedPitchType, velocityInput, plottedPitches.length, pendingHasVideo, blurActiveElement]);

  // Cancel pitch entry
  const handleCancelPitchEntry = useCallback(() => {
    setPitchEntryStep('idle');
    setPendingLocation(null);
    setSelectedPitchType(null);
    setVelocityInput('');
    setPendingHasVideo(false);
    blurActiveElement();
  }, [blurActiveElement]);

  // Start recording video for next pitch
  // CRITICAL: startRecording must be called synchronously from the click handler
  // to preserve the user gesture context for getUserMedia (browser security requirement)
  const handleStartRecording = useCallback(() => {
    startRecording();
  }, [startRecording]);

  // Stop recording and start pitch entry flow
  const handleStopRecording = useCallback(async (x: number, y: number) => {
    const pitchNumber = plottedPitches.length + 1;
    const pitchIsStrike = isStrike(x, y);
    
    const capturedVideo = await stopRecording({
      pitcherName: pitcher.name,
      date: getTodayDateString(),
      pitchNumber,
      pitchType: 'TBD', // Will be selected in dialog
      velocity: undefined,
      isStrike: pitchIsStrike,
    });

    // Start pitch entry flow with video flag
    handleZoneTap(x, y, !!capturedVideo);
    
    // Show video save dialog for web users (non-native)
    if (capturedVideo && !isNative) {
      setShowVideoDialog(true);
    }
  }, [plottedPitches.length, pitcher.name, stopRecording, handleZoneTap, isNative]);

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

  // Calculate strike zone box position (CSS positioning)
  const zoneLeft = toPercent(STRIKE_ZONE.ZONE_LEFT);
  const zoneRight = 100 - toPercent(STRIKE_ZONE.ZONE_RIGHT);
  const zoneTop = 100 - toPercent(STRIKE_ZONE.ZONE_TOP);
  const zoneBottom = toPercent(STRIKE_ZONE.ZONE_BOTTOM);

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col overflow-x-hidden">
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
      <div className={`flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-4 ${isRecording ? 'flex flex-col justify-center' : ''}`}>
        {/* 1. Live Stats Bar */}
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

        {/* 2. Video Recording Section */}
        {!isRecording ? (
          <div className="space-y-2">
            <Button
              variant="outline"
              className="w-full h-12 text-base border-accent text-accent hover:bg-accent/10"
              onClick={handleStartRecording}
            >
              <Video className="w-5 h-5 mr-2" />
              Record Video for Next Pitch
            </Button>
            {capturedVideos.length > 0 && (
              <p className="text-xs text-muted-foreground text-center">
                {capturedVideos.length} video{capturedVideos.length !== 1 ? 's' : ''} captured
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

        {/* 3. Strike Zone */}
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
                  handleZoneTap(x, y);
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

              {/* Pending location indicator */}
              {pendingLocation && (
                <div
                  className="absolute w-6 h-6 rounded-full transform -translate-x-1/2 -translate-y-1/2 border-2 border-dashed border-foreground bg-foreground/20 pointer-events-none animate-pulse"
                  style={{
                    left: `${toPercent(pendingLocation.x)}%`,
                    top: `${100 - toPercent(pendingLocation.y)}%`,
                  }}
                />
              )}

              {/* Zone labels */}
              <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-xs text-muted-foreground pointer-events-none">High</span>
              <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-xs text-muted-foreground pointer-events-none">Low</span>
            </div>
          </div>
        </div>

        {/* Recent pitches list */}
        {!isRecording && plottedPitches.length > 0 && (
          <div className="space-y-2">
            <Label className="text-sm font-medium">Recent Pitches</Label>
            <div className="flex flex-wrap gap-2 max-h-20 overflow-y-auto">
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

      {/* Fixed Bottom Action Bar */}
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

      {/* Pitch Entry Dialog - Step 1: Select Pitch Type */}
      <Dialog open={pitchEntryStep === 'selectType'} onOpenChange={(open) => !open && handleCancelPitchEntry()}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Select Pitch Type</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-4">
            {[1, 2, 3, 4, 5].map((pt) => (
              <button
                key={pt}
                type="button"
                className="h-16 text-lg font-bold select-none touch-none focus:ring-0 focus:outline-none active:scale-95 transition-transform rounded-md inline-flex items-center justify-center text-foreground bg-background hover:bg-accent/10"
                style={{
                  borderColor: PITCH_TYPE_COLORS[pt.toString()],
                  borderWidth: 2,
                  borderStyle: 'solid',
                  WebkitTapHighlightColor: 'transparent',
                }}
                onPointerDown={() => handlePitchTypePointerDown(pt)}
                onPointerUp={() => handlePitchTypePointerUp(pt)}
                onPointerLeave={handlePitchTypePointerLeave}
                onPointerCancel={handlePitchTypePointerLeave}
              >
                <span
                  className="w-4 h-4 rounded-full mr-2 flex-shrink-0"
                  style={{ backgroundColor: PITCH_TYPE_COLORS[pt.toString()] }}
                />
                {pitchTypes[pt.toString()] || `P${pt}`}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground text-center">
            Tap to confirm • Hold for velocity
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={handleCancelPitchEntry}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pitch Entry Dialog - Step 2: Enter Velocity */}
      <Dialog open={pitchEntryStep === 'enterVelocity'} onOpenChange={(open) => !open && handleCancelPitchEntry()}>
        <DialogContent
          className="sm:max-w-sm"
          onOpenAutoFocus={(e) => {
            // Let *us* decide focus target (Radix will otherwise focus the Close button)
            e.preventDefault();
            velocityInputRef.current?.focus();
          }}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Velocity
              {selectedPitchType && (
                <span
                  className="px-2 py-1 rounded-full text-xs text-white"
                  style={{ backgroundColor: PITCH_TYPE_COLORS[selectedPitchType.toString()] }}
                >
                  {pitchTypes[selectedPitchType.toString()]}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              ref={velocityInputRef}
              type="tel"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="Velo"
              value={velocityInput}
              onChange={(e) => setVelocityInput(e.target.value)}
              className="h-16 text-3xl text-center font-bold"
              enterKeyHint="done"
            />
          </div>
          <DialogFooter className="flex-row gap-2">
            <Button variant="ghost" onClick={() => setPitchEntryStep('selectType')}>
              Back
            </Button>
            <Button onClick={handleConfirmPitch} className="flex-1">
              <Check className="w-4 h-4 mr-2" />
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
