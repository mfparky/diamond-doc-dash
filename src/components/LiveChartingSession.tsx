import { useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PitchTypeConfig, DEFAULT_PITCH_TYPES, PITCH_TYPE_COLORS } from '@/types/pitch-location';
import { isStrike, getZoneAspectStyle, STRIKE_ZONE, GRID_CONFIG } from '@/lib/strike-zone';
import { Undo2, Save, X, Zap } from 'lucide-react';
import { Pitcher, Outing } from '@/types/pitcher';

export interface LivePitch {
  pitchNumber: number;
  pitchType: number;
  xLocation: number;
  yLocation: number;
  isStrike: boolean;
  velocity?: number;
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

  const handlePlotPitch = useCallback((x: number, y: number) => {
    const newPitch: LivePitch = {
      pitchNumber: plottedPitches.length + 1,
      pitchType: selectedPitchType,
      xLocation: x,
      yLocation: y,
      isStrike: isStrike(x, y),
      velocity: currentVelocity ? parseInt(currentVelocity) : undefined,
    };
    setPlottedPitches((prev) => [...prev, newPitch]);
    // Clear velocity after each pitch for fresh entry
    setCurrentVelocity('');
  }, [plottedPitches.length, selectedPitchType, currentVelocity]);

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
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Live Stats Bar */}
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

        {/* Pitch Type Selector - Large touch targets */}
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

        {/* Velocity Input - Optional, large for touch */}
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

        {/* Strike Zone - Large for easy tapping */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">
            Tap to plot pitch #{plottedPitches.length + 1}
          </Label>
          <div className="flex justify-center py-2">
            <div
              className="relative bg-secondary/30 rounded-lg border-2 border-border cursor-crosshair active:bg-secondary/50 touch-none"
              style={getZoneAspectStyle('lg')}
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
                const y = 1 - ((e.clientY - rect.top) / rect.height) * 2;
                handlePlotPitch(x, y);
              }}
              onTouchEnd={(e) => {
                e.preventDefault();
                const touch = e.changedTouches[0];
                const rect = e.currentTarget.getBoundingClientRect();
                const x = ((touch.clientX - rect.left) / rect.width) * 2 - 1;
                const y = 1 - ((touch.clientY - rect.top) / rect.height) * 2;
                handlePlotPitch(x, y);
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
                  className="absolute w-6 h-6 rounded-full transform -translate-x-1/2 -translate-y-1/2 border-2 border-white/70 flex items-center justify-center text-[10px] text-white font-bold shadow-lg pointer-events-none"
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
              <span className="absolute top-1/2 -right-8 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">Out</span>
            </div>
          </div>
        </div>

        {/* Recent pitches list */}
        {plottedPitches.length > 0 && (
          <div className="space-y-2">
            <Label className="text-sm font-medium">Recent Pitches</Label>
            <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto">
              {plottedPitches.slice(-10).reverse().map((pitch) => (
                <div
                  key={pitch.pitchNumber}
                  className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium text-white"
                  style={{ backgroundColor: PITCH_TYPE_COLORS[pitch.pitchType.toString()] }}
                >
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
      </div>
    </div>
  );
}
