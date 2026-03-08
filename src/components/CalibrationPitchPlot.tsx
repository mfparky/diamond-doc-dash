import { useRef, useState, useCallback, useEffect } from 'react';
import { ScannedPitch } from '@/lib/scan-form';
import { PITCH_TYPE_COLORS, PitchTypeConfig, DEFAULT_PITCH_TYPES } from '@/types/pitch-location';

const toPercent = (v: number) => ((v + 1) / 2) * 100;

function pitchColor(pitchType: string, pitchTypes: PitchTypeConfig): string {
  const asInt = parseInt(pitchType);
  if (!isNaN(asInt) && PITCH_TYPE_COLORS[asInt.toString()]) return PITCH_TYPE_COLORS[asInt.toString()];
  for (const [key, val] of Object.entries(pitchTypes)) {
    if (val.toUpperCase() === pitchType.toUpperCase()) return PITCH_TYPE_COLORS[key] ?? '#888';
  }
  return '#888';
}

interface Props {
  imageDataUrl: string;
  pitches: ScannedPitch[];
  onChange: (updated: ScannedPitch[]) => void;
  pitchTypes?: PitchTypeConfig;
}

export function CalibrationPitchPlot({ imageDataUrl, pitches, onChange, pitchTypes = DEFAULT_PITCH_TYPES }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [imgAspect, setImgAspect] = useState(4 / 3);
  const dragRef = useRef<{ idx: number; moved: boolean } | null>(null);

  // Detect image aspect ratio so the overlay matches the image dimensions
  useEffect(() => {
    const img = new Image();
    img.onload = () => setImgAspect(img.naturalWidth / img.naturalHeight);
    img.src = imageDataUrl;
  }, [imageDataUrl]);

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
    onChange(pitches.map((p, i) => i === idx ? { ...p, xLocation: x, yLocation: y } : p));
  }, [pitches, onChange]);

  const handlePitchPointerDown = useCallback((e: React.PointerEvent, idx: number) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { idx, moved: false };
    setSelectedIdx(idx);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return;
    dragRef.current.moved = true;
    const { x, y } = clientToNorm(e.clientX, e.clientY);
    movePitch(dragRef.current.idx, x, y);
  }, [clientToNorm, movePitch]);

  const handlePointerUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  // Tap on image background → move selected pitch there
  const handleCanvasClick = useCallback((e: React.MouseEvent) => {
    if (selectedIdx === null) return;
    if (dragRef.current?.moved) return;
    const { x, y } = clientToNorm(e.clientX, e.clientY);
    movePitch(selectedIdx, x, y);
  }, [selectedIdx, clientToNorm, movePitch]);

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        {selectedIdx !== null
          ? `Pitch #${pitches[selectedIdx]?.pitchNumber} selected — drag it or tap anywhere on the image to move it`
          : 'Tap a pitch dot to select it, then drag or tap its true location on the image'}
      </p>

      <div
        ref={containerRef}
        className="relative w-full overflow-hidden rounded border border-border select-none touch-none cursor-crosshair"
        style={{ aspectRatio: `${imgAspect} / 1` }}
        onClick={handleCanvasClick}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        {/* Form image as the background */}
        <img
          src={imageDataUrl}
          alt="Scanned form"
          className="absolute inset-0 w-full h-full object-fill pointer-events-none"
          draggable={false}
        />

        {/* Dark overlay to make dots more visible */}
        <div className="absolute inset-0 bg-black/20 pointer-events-none" />

        {/* Pitch dots overlaid on image */}
        {pitches.map((pitch, idx) => {
          const color = pitchColor(pitch.pitchType, pitchTypes);
          const isSelected = selectedIdx === idx;
          return (
            <div
              key={idx}
              className="absolute flex items-center justify-center rounded-full font-bold cursor-grab active:cursor-grabbing"
              style={{
                left: `${toPercent(pitch.xLocation)}%`,
                top: `${100 - toPercent(pitch.yLocation)}%`,
                transform: 'translate(-50%, -50%)',
                width: isSelected ? 30 : 24,
                height: isSelected ? 30 : 24,
                fontSize: isSelected ? 10 : 9,
                color: 'white',
                backgroundColor: color,
                border: isSelected ? '2.5px solid white' : '1.5px solid rgba(255,255,255,0.6)',
                boxShadow: isSelected
                  ? `0 0 0 3px ${color}80, 0 2px 6px rgba(0,0,0,0.5)`
                  : '0 1px 4px rgba(0,0,0,0.5)',
                zIndex: isSelected ? 10 : 1,
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
