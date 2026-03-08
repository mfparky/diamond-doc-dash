import { useRef, useState, useCallback } from 'react';
import { ScannedPitch } from '@/lib/scan-form';
import { PITCH_TYPE_COLORS, PitchTypeConfig, DEFAULT_PITCH_TYPES } from '@/types/pitch-location';
import { STRIKE_ZONE } from '@/lib/strike-zone';

const toPercent = (v: number) => ((v + 1) / 2) * 100;
const zoneLeft   = toPercent(STRIKE_ZONE.ZONE_LEFT);
const zoneRight  = 100 - toPercent(STRIKE_ZONE.ZONE_RIGHT);
const zoneTop    = 100 - toPercent(STRIKE_ZONE.ZONE_TOP);
const zoneBottom = toPercent(STRIKE_ZONE.ZONE_BOTTOM);

function pitchColor(pitchType: string, pitchTypes: PitchTypeConfig): string {
  const asInt = parseInt(pitchType);
  if (!isNaN(asInt) && PITCH_TYPE_COLORS[asInt.toString()]) return PITCH_TYPE_COLORS[asInt.toString()];
  for (const [key, val] of Object.entries(pitchTypes)) {
    if (val.toUpperCase() === pitchType.toUpperCase()) return PITCH_TYPE_COLORS[key] ?? '#888';
  }
  return '#888';
}

interface Props {
  pitches: ScannedPitch[];
  onChange: (updated: ScannedPitch[]) => void;
  pitchTypes?: PitchTypeConfig;
}

export function CalibrationPitchPlot({ pitches, onChange, pitchTypes = DEFAULT_PITCH_TYPES }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const dragRef = useRef<{ idx: number; startX: number; startY: number } | null>(null);
  const movedRef = useRef(false);

  const clientToNorm = useCallback((clientX: number, clientY: number) => {
    const rect = containerRef.current!.getBoundingClientRect();
    const nx = ((clientX - rect.left) / rect.width) * 2 - 1;
    const ny = 1 - ((clientY - rect.top) / rect.height) * 2;
    return {
      x: Math.max(-1, Math.min(1, nx)),
      y: Math.max(-1, Math.min(1, ny)),
    };
  }, []);

  const movePitch = useCallback((idx: number, x: number, y: number) => {
    const updated = pitches.map((p, i) => i === idx ? { ...p, xLocation: x, yLocation: y } : p);
    onChange(updated);
  }, [pitches, onChange]);

  // Pointer events for drag
  const handlePitchPointerDown = useCallback((e: React.PointerEvent, idx: number) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { idx, startX: e.clientX, startY: e.clientY };
    movedRef.current = false;
    setSelectedIdx(idx);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    if (Math.sqrt(dx * dx + dy * dy) > 4) {
      movedRef.current = true;
      const { x, y } = clientToNorm(e.clientX, e.clientY);
      movePitch(dragRef.current.idx, x, y);
    }
  }, [clientToNorm, movePitch]);

  const handlePointerUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  // Tap on canvas (not on a pitch dot) → move selected pitch there
  const handleCanvasClick = useCallback((e: React.MouseEvent) => {
    if (selectedIdx === null) return;
    if (movedRef.current) return; // was a drag, not a tap
    const { x, y } = clientToNorm(e.clientX, e.clientY);
    movePitch(selectedIdx, x, y);
  }, [selectedIdx, clientToNorm, movePitch]);

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        {selectedIdx !== null
          ? `Pitch #${pitches[selectedIdx]?.pitchNumber} selected — tap anywhere to move it, or drag it directly`
          : 'Tap a pitch to select it, then tap to reposition'}
      </p>
      <div
        ref={containerRef}
        className="relative bg-secondary/30 border border-border rounded select-none touch-none"
        style={{ width: '100%', aspectRatio: '1 / 1' }}
        onClick={handleCanvasClick}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        {/* Strike zone grid */}
        <div
          className="absolute border border-foreground/60 bg-primary/5 pointer-events-none"
          style={{ left: `${zoneLeft}%`, right: `${zoneRight}%`, top: `${zoneTop}%`, bottom: `${zoneBottom}%` }}
        >
          {/* 3×3 grid lines */}
          {[1, 2].map(i => (
            <div key={`v${i}`} className="absolute top-0 bottom-0 border-l border-foreground/20"
              style={{ left: `${(i / 3) * 100}%` }} />
          ))}
          {[1, 2].map(i => (
            <div key={`h${i}`} className="absolute left-0 right-0 border-t border-foreground/20"
              style={{ top: `${(i / 3) * 100}%` }} />
          ))}
        </div>

        {/* Pitches */}
        {pitches.map((pitch, idx) => {
          const color = pitchColor(pitch.pitchType, pitchTypes);
          const isSelected = selectedIdx === idx;
          return (
            <div
              key={idx}
              className="absolute flex items-center justify-center rounded-full border text-white font-bold cursor-grab active:cursor-grabbing"
              style={{
                left: `${toPercent(pitch.xLocation)}%`,
                top: `${100 - toPercent(pitch.yLocation)}%`,
                transform: 'translate(-50%, -50%)',
                width: isSelected ? 28 : 22,
                height: isSelected ? 28 : 22,
                fontSize: isSelected ? 9 : 8,
                backgroundColor: color,
                borderColor: isSelected ? 'white' : 'rgba(255,255,255,0.5)',
                borderWidth: isSelected ? 2 : 1,
                boxShadow: isSelected ? `0 0 0 3px ${color}60` : undefined,
                zIndex: isSelected ? 10 : 1,
                transition: 'width 0.1s, height 0.1s',
              }}
              onPointerDown={e => handlePitchPointerDown(e, idx)}
            >
              {pitch.pitchNumber}
            </div>
          );
        })}
      </div>

      {selectedIdx !== null && (
        <button
          className="text-xs text-muted-foreground underline underline-offset-2"
          onClick={() => setSelectedIdx(null)}
        >
          Deselect
        </button>
      )}
    </div>
  );
}
