import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Undo2, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';
import { PitchTypeConfig, DEFAULT_PITCH_TYPES, PITCH_TYPE_COLORS } from '@/types/pitch-location';
import { AtBat, AbOutcome, AB_OUTCOMES, AB_OUTCOME_COLOR, AB_OUTCOME_LABELS } from '@/types/at-bats';
import { isStrike, getZoneAspectStyle, STRIKE_ZONE, GRID_CONFIG } from '@/lib/strike-zone';

interface PlottedPitch {
  pitchNumber: number;
  pitchType: number;
  xLocation: number;
  yLocation: number;
  isStrike: boolean;
}

export interface LiveAbData {
  pitches: PlottedPitch[];
  atBats: AtBat[];
}

interface LiveAbCharterProps {
  pitchTypes?: PitchTypeConfig;
  onChange: (data: LiveAbData) => void;
  initialData?: LiveAbData;
}

const toPercent = (v: number) => ((v + 1) / 2) * 100;

const zoneLeft   = toPercent(STRIKE_ZONE.ZONE_LEFT);
const zoneRight  = 100 - toPercent(STRIKE_ZONE.ZONE_RIGHT);
const zoneTop    = 100 - toPercent(STRIKE_ZONE.ZONE_TOP);
const zoneBottom = toPercent(STRIKE_ZONE.ZONE_BOTTOM);

function abStartPitch(atBats: AtBat[], idx: number): number {
  return idx === 0 ? 1 : atBats[idx - 1].endPitch + 1;
}

export function LiveAbCharter({ pitchTypes = DEFAULT_PITCH_TYPES, onChange, initialData }: LiveAbCharterProps) {
  const [allPitches, setAllPitches] = useState<PlottedPitch[]>(initialData?.pitches ?? []);
  const [completedAbs, setCompletedAbs] = useState<AtBat[]>(initialData?.atBats ?? []);
  const [selectedPitchType, setSelectedPitchType] = useState<number>(1);
  const [showOutcomeSelector, setShowOutcomeSelector] = useState(false);
  const [showAbHistory, setShowAbHistory] = useState(false);

  const currentAbNumber = completedAbs.length + 1;
  const lastAbEndPitch = completedAbs.length > 0 ? completedAbs[completedAbs.length - 1].endPitch : 0;
  const pitchesInCurrentAb = allPitches.slice(lastAbEndPitch);
  const ballsInAb = pitchesInCurrentAb.filter(p => !p.isStrike).length;
  const strikesInAb = pitchesInCurrentAb.filter(p => p.isStrike).length;

  const emit = useCallback((pitches: PlottedPitch[], abs: AtBat[]) => {
    onChange({ pitches, atBats: abs });
  }, [onChange]);

  const handlePlotPitch = useCallback((x: number, y: number) => {
    const newPitch: PlottedPitch = {
      pitchNumber: allPitches.length + 1,
      pitchType: selectedPitchType,
      xLocation: x,
      yLocation: y,
      isStrike: isStrike(x, y),
    };
    const updated = [...allPitches, newPitch];
    setAllPitches(updated);
    emit(updated, completedAbs);
  }, [allPitches, selectedPitchType, completedAbs, emit]);

  const handleUndo = useCallback(() => {
    if (allPitches.length === 0) return;
    const updated = allPitches.slice(0, -1);
    setAllPitches(updated);
    emit(updated, completedAbs);
  }, [allPitches, completedAbs, emit]);

  const handleEndAb = useCallback(() => {
    if (pitchesInCurrentAb.length === 0) return;
    setShowOutcomeSelector(true);
  }, [pitchesInCurrentAb.length]);

  const handleSelectOutcome = useCallback((outcome: AbOutcome) => {
    const newAb: AtBat = {
      ab: currentAbNumber,
      outcome,
      endPitch: allPitches.length,
    };
    const updatedAbs = [...completedAbs, newAb];
    setCompletedAbs(updatedAbs);
    setShowOutcomeSelector(false);
    emit(allPitches, updatedAbs);
  }, [currentAbNumber, allPitches, completedAbs, emit]);

  const canUndo = allPitches.length > lastAbEndPitch; // only undo within current AB

  return (
    <div className="space-y-3">
      {/* AB status bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 bg-secondary rounded-lg px-3 py-1.5">
          <span className="text-xs font-medium text-muted-foreground">AB</span>
          <span className="text-sm font-bold text-foreground">#{currentAbNumber}</span>
        </div>
        <div className="flex gap-1.5">
          <span className="inline-flex items-center gap-1 text-xs bg-secondary rounded px-2 py-1">
            <span className="text-blue-400 font-bold">{ballsInAb}B</span>
          </span>
          <span className="inline-flex items-center gap-1 text-xs bg-secondary rounded px-2 py-1">
            <span className="text-red-400 font-bold">{strikesInAb}S</span>
          </span>
          <span className="inline-flex items-center gap-1 text-xs bg-secondary rounded px-2 py-1">
            <span className="text-muted-foreground">P{pitchesInCurrentAb.length}</span>
          </span>
        </div>
        {completedAbs.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {allPitches.length} total pitches · {completedAbs.length} ABs done
          </span>
        )}
      </div>

      {/* Pitch type selector */}
      <div className="flex flex-wrap gap-1.5">
        {[1, 2, 3, 4, 5].map(pt => (
          <Button
            key={pt}
            variant={selectedPitchType === pt ? 'default' : 'outline'}
            size="sm"
            className="min-w-[54px] h-8 text-xs"
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

      {/* Strike zone plot */}
      <div className="flex justify-center">
        <div
          className="relative bg-secondary/30 rounded-lg border border-border/50 cursor-crosshair hover:bg-secondary/40"
          style={getZoneAspectStyle('md')}
          onClick={e => {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            const y = 1 - ((e.clientY - rect.top) / rect.height) * 2;
            handlePlotPitch(x, y);
          }}
        >
          {/* Grid */}
          <div className="absolute inset-0 opacity-20">
            <div className="w-full h-full grid" style={{
              gridTemplateColumns: `repeat(${GRID_CONFIG.COLS}, 1fr)`,
              gridTemplateRows: `repeat(${GRID_CONFIG.ROWS}, 1fr)`,
            }}>
              {Array.from({ length: GRID_CONFIG.COLS * GRID_CONFIG.ROWS }).map((_, i) => (
                <div key={i} className="border border-muted-foreground/30" />
              ))}
            </div>
          </div>

          {/* Strike zone box */}
          <div className="absolute border-2 border-foreground/80 bg-primary/5"
            style={{ left: `${zoneLeft}%`, right: `${zoneRight}%`, top: `${zoneTop}%`, bottom: `${zoneBottom}%` }} />

          {/* Completed AB pitches — shown faded */}
          {allPitches.slice(0, lastAbEndPitch).map((pitch, idx) => (
            <div
              key={`prev-${idx}`}
              className="absolute rounded-full transform -translate-x-1/2 -translate-y-1/2 border border-white/20 flex items-center justify-center text-[7px] text-white/50 font-bold pointer-events-none"
              style={{
                left: `${toPercent(pitch.xLocation)}%`,
                top: `${100 - toPercent(pitch.yLocation)}%`,
                width: 14, height: 14,
                backgroundColor: PITCH_TYPE_COLORS[pitch.pitchType.toString()] + '55',
              }}
            >
              {pitch.pitchNumber}
            </div>
          ))}

          {/* Current AB pitches — full opacity */}
          {pitchesInCurrentAb.map((pitch, idx) => (
            <div
              key={`cur-${idx}`}
              className="absolute rounded-full transform -translate-x-1/2 -translate-y-1/2 border border-white/60 flex items-center justify-center text-[8px] text-white font-bold shadow pointer-events-none"
              style={{
                left: `${toPercent(pitch.xLocation)}%`,
                top: `${100 - toPercent(pitch.yLocation)}%`,
                width: 16, height: 16,
                backgroundColor: PITCH_TYPE_COLORS[pitch.pitchType.toString()],
              }}
            >
              {pitch.pitchNumber}
            </div>
          ))}
        </div>
      </div>

      {/* Outcome selector — shown after "End AB" */}
      {showOutcomeSelector ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            AB #{currentAbNumber} outcome ({pitchesInCurrentAb.length} pitches):
          </p>
          <div className="grid grid-cols-4 gap-1.5">
            {AB_OUTCOMES.map(outcome => (
              <button
                key={outcome}
                className="h-9 rounded-md text-xs font-semibold text-white transition-opacity hover:opacity-90 active:opacity-75"
                style={{ backgroundColor: AB_OUTCOME_COLOR[outcome] }}
                onClick={() => handleSelectOutcome(outcome)}
                title={AB_OUTCOME_LABELS[outcome]}
              >
                {outcome}
              </button>
            ))}
          </div>
          <Button variant="ghost" size="sm" className="w-full text-xs h-7"
            onClick={() => setShowOutcomeSelector(false)}>
            Cancel — keep pitching
          </Button>
        </div>
      ) : (
        /* Controls row */
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={handleUndo}
            disabled={!canUndo}
          >
            <Undo2 className="w-3.5 h-3.5 mr-1.5" />
            Undo
          </Button>
          <Button
            size="sm"
            className="flex-1"
            onClick={handleEndAb}
            disabled={pitchesInCurrentAb.length === 0}
          >
            <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
            End AB
          </Button>
        </div>
      )}

      {/* Completed AB history */}
      {completedAbs.length > 0 && (
        <div className="border border-border rounded-lg overflow-hidden">
          <button
            className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium bg-secondary/40 hover:bg-secondary/60 transition-colors"
            onClick={() => setShowAbHistory(v => !v)}
          >
            <span>AB History ({completedAbs.length} at-bats)</span>
            {showAbHistory ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          {showAbHistory && (
            <div className="divide-y divide-border">
              {completedAbs.map((ab, abIdx) => {
                const startPitch = abStartPitch(completedAbs, abIdx);
                const pitchesForAb = allPitches.slice(startPitch - 1, ab.endPitch);
                const strikes = pitchesForAb.filter(p => p.isStrike).length;
                return (
                  <div key={ab.ab} className="flex items-center gap-2 px-3 py-2">
                    <span className="text-xs text-muted-foreground w-10 shrink-0">AB #{ab.ab}</span>
                    {ab.outcome && (
                      <Badge
                        variant="outline"
                        className="text-[10px] h-5 px-1.5 shrink-0 font-semibold border-0"
                        style={{
                          backgroundColor: AB_OUTCOME_COLOR[ab.outcome] + '33',
                          color: AB_OUTCOME_COLOR[ab.outcome],
                        }}
                      >
                        {ab.outcome}
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {pitchesForAb.length}p · {strikes}K
                    </span>
                    {/* Mini pitch type dots */}
                    <div className="flex gap-0.5 flex-wrap">
                      {pitchesForAb.map((p, i) => (
                        <div
                          key={i}
                          className="w-2.5 h-2.5 rounded-full border border-white/20"
                          style={{ backgroundColor: PITCH_TYPE_COLORS[p.pitchType.toString()] }}
                          title={`#${p.pitchNumber} ${pitchTypes[p.pitchType.toString()] ?? ''} ${p.isStrike ? '✓' : '✗'}`}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
