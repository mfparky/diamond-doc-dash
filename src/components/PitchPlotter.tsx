import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { PitchTypeConfig, DEFAULT_PITCH_TYPES, PITCH_TYPE_COLORS } from '@/types/pitch-location';
import { Undo2, Save, X } from 'lucide-react';

interface PlottedPitch {
  pitchNumber: number;
  pitchType: number;
  xLocation: number;
  yLocation: number;
  isStrike: boolean;
}

interface PitchPlotterProps {
  pitchTypes?: PitchTypeConfig;
  onSave: (pitches: PlottedPitch[]) => void;
  onCancel: () => void;
}

export function PitchPlotter({
  pitchTypes = DEFAULT_PITCH_TYPES,
  onSave,
  onCancel,
}: PitchPlotterProps) {
  const [selectedPitchType, setSelectedPitchType] = useState<number>(1);
  const [plottedPitches, setPlottedPitches] = useState<PlottedPitch[]>([]);

  // Check if a point is within the strike zone
  const isInStrikeZone = useCallback((x: number, y: number) => {
    return x >= -0.4 && x <= 0.4 && y >= -0.3 && y <= 0.5;
  }, []);

  const handlePlotPitch = useCallback((x: number, y: number) => {
    const newPitch: PlottedPitch = {
      pitchNumber: plottedPitches.length + 1,
      pitchType: selectedPitchType,
      xLocation: x,
      yLocation: y,
      isStrike: isInStrikeZone(x, y),
    };
    setPlottedPitches((prev) => [...prev, newPitch]);
  }, [plottedPitches.length, selectedPitchType, isInStrikeZone]);

  const handleUndo = useCallback(() => {
    setPlottedPitches((prev) => prev.slice(0, -1));
  }, []);

  const handleSave = useCallback(() => {
    if (plottedPitches.length > 0) {
      onSave(plottedPitches);
    }
  }, [plottedPitches, onSave]);

  // Convert normalized coordinates to percentage for positioning
  const toPercent = (val: number) => ((val + 1) / 2) * 100;

  return (
    <Card className="glass-card border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="font-display text-lg">Plot Pitch Locations</CardTitle>
          <Button variant="ghost" size="icon" onClick={onCancel}>
            <X className="w-5 h-5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Pitch Type Selection */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Select Pitch Type</Label>
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4, 5].map((pt) => (
              <Button
                key={pt}
                variant={selectedPitchType === pt ? 'default' : 'outline'}
                size="sm"
                className="min-w-[60px]"
                style={{
                  backgroundColor: selectedPitchType === pt ? PITCH_TYPE_COLORS[pt.toString()] : undefined,
                  borderColor: PITCH_TYPE_COLORS[pt.toString()],
                }}
                onClick={() => setSelectedPitchType(pt)}
              >
                {pitchTypes[pt.toString()] || `P${pt}`}
              </Button>
            ))}
          </div>
        </div>

        {/* Strike Zone for plotting */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">
            Tap to plot pitches ({plottedPitches.length} plotted)
          </Label>
          <div className="flex justify-center py-4">
            <div
              className="w-64 h-72 relative bg-secondary/30 rounded-lg border border-border/50 cursor-crosshair hover:bg-secondary/40"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
                const y = 1 - ((e.clientY - rect.top) / rect.height) * 2;
                handlePlotPitch(x, y);
              }}
            >
              {/* Background grid */}
              <div className="absolute inset-0 opacity-20">
                <div className="w-full h-full grid grid-cols-5 grid-rows-5">
                  {Array.from({ length: 25 }).map((_, i) => (
                    <div key={i} className="border border-muted-foreground/30" />
                  ))}
                </div>
              </div>

              {/* Strike zone box */}
              <div
                className="absolute border-2 border-foreground/80 bg-primary/5"
                style={{
                  left: '30%',
                  right: '30%',
                  top: '25%',
                  bottom: '35%',
                }}
              />

              {/* Plotted pitches */}
              {plottedPitches.map((pitch, idx) => (
                <div
                  key={idx}
                  className="absolute w-4 h-4 rounded-full transform -translate-x-1/2 -translate-y-1/2 border border-white/50 flex items-center justify-center text-[8px] text-white font-bold"
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
              <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-xs text-muted-foreground">High</span>
              <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-xs text-muted-foreground">Low</span>
              <span className="absolute top-1/2 -left-6 -translate-y-1/2 text-xs text-muted-foreground">In</span>
              <span className="absolute top-1/2 -right-8 -translate-y-1/2 text-xs text-muted-foreground">Out</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleUndo}
            disabled={plottedPitches.length === 0}
            className="flex-1"
          >
            <Undo2 className="w-4 h-4 mr-2" />
            Undo
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={plottedPitches.length === 0}
            className="flex-1"
          >
            <Save className="w-4 h-4 mr-2" />
            Save ({plottedPitches.length})
          </Button>
        </div>

        {/* Stats summary */}
        {plottedPitches.length > 0 && (
          <div className="text-xs text-muted-foreground text-center">
            Strikes: {plottedPitches.filter(p => p.isStrike).length} / {plottedPitches.length}
            {' '}({((plottedPitches.filter(p => p.isStrike).length / plottedPitches.length) * 100).toFixed(0)}%)
          </div>
        )}
      </CardContent>
    </Card>
  );
}
