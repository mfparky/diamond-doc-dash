import { useState } from 'react';
import { PitchLocation, PITCH_TYPE_COLORS, DEFAULT_PITCH_TYPES, PitchTypeConfig } from '@/types/pitch-location';
import { parseLiveAbsData, abPitchRange, AB_OUTCOME_COLOR } from '@/types/at-bats';
import { STRIKE_ZONE } from '@/lib/strike-zone';

interface LiveAbsSessionZoneProps {
  notes: string | undefined | null;
  pitchLocations: PitchLocation[];
  pitchTypes?: PitchTypeConfig;
}

const toPercent = (val: number) => ((val + 1) / 2) * 100;

const zoneLeft   = toPercent(STRIKE_ZONE.ZONE_LEFT);
const zoneRight  = 100 - toPercent(STRIKE_ZONE.ZONE_RIGHT);
const zoneTop    = 100 - toPercent(STRIKE_ZONE.ZONE_TOP);
const zoneBottom = toPercent(STRIKE_ZONE.ZONE_BOTTOM);

export function LiveAbsSessionZone({ notes, pitchLocations, pitchTypes = DEFAULT_PITCH_TYPES }: LiveAbsSessionZoneProps) {
  const [selectedAb, setSelectedAb] = useState<'all' | number>('all');

  const data = parseLiveAbsData(notes);

  // Nothing to show if no pitches were tracked
  if (pitchLocations.length === 0) return null;

  // Pitches to render
  const displayed = selectedAb === 'all'
    ? pitchLocations
    : (() => {
        if (!data) return pitchLocations;
        const abIdx = data.atBats.findIndex((ab) => ab.ab === selectedAb);
        if (abIdx === -1) return [];
        const [start, end] = abPitchRange(data.atBats, abIdx);
        return pitchLocations.filter((p) => p.pitchNumber >= start && p.pitchNumber <= end);
      })();

  // Sequence number within the current view (1-indexed per displayed set)
  const seqMap = new Map<number, number>(); // pitchNumber -> seq
  [...displayed]
    .sort((a, b) => a.pitchNumber - b.pitchNumber)
    .forEach((p, i) => seqMap.set(p.pitchNumber, i + 1));

  const showSequence = selectedAb !== 'all';

  // For the active AB's outcome color (tint the zone header)
  const activeOutcome = showSequence && data
    ? data.atBats.find((ab) => ab.ab === selectedAb)?.outcome ?? null
    : null;

  const usedPitchTypes = [...new Set(pitchLocations.map((p) => p.pitchType))].sort();

  return (
    <div className="space-y-3 pt-1">
      {/* Batter selector */}
      {data && data.atBats.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setSelectedAb('all')}
            className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
              selectedAb === 'all'
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border text-muted-foreground hover:border-primary/50'
            }`}
          >
            All
          </button>
          {data.atBats.map((ab) => {
            const color = ab.outcome ? AB_OUTCOME_COLOR[ab.outcome] : undefined;
            const isActive = selectedAb === ab.ab;
            return (
              <button
                key={ab.ab}
                onClick={() => setSelectedAb(isActive ? 'all' : ab.ab)}
                className={`px-2.5 py-1 rounded-full text-xs font-bold border transition-colors ${
                  isActive ? 'text-white border-transparent' : 'border-border text-muted-foreground hover:border-primary/50'
                }`}
                style={isActive && color ? { backgroundColor: color, borderColor: color } : undefined}
              >
                AB{ab.ab}
                {ab.outcome && (
                  <span className={`ml-1 font-normal ${isActive ? 'opacity-80' : ''}`}
                    style={!isActive && color ? { color } : undefined}>
                    {ab.outcome}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Strike zone */}
      <div className="flex justify-center">
        <div
          className="relative bg-secondary/30 rounded-lg border border-border/50"
          style={{ width: 220, height: 285 }}
        >
          {/* Grid */}
          <div className="absolute inset-0 opacity-10 pointer-events-none">
            <div className="w-full h-full grid" style={{ gridTemplateColumns: 'repeat(12, 1fr)', gridTemplateRows: 'repeat(16, 1fr)' }}>
              {Array.from({ length: 192 }).map((_, i) => (
                <div key={i} className="border border-muted-foreground/40" />
              ))}
            </div>
          </div>

          {/* Strike zone box */}
          <div
            className="absolute border-2 border-foreground/70 bg-primary/5"
            style={{ left: `${zoneLeft}%`, right: `${zoneRight}%`, top: `${zoneTop}%`, bottom: `${zoneBottom}%` }}
          />

          {/* Dimmed pitches when a single AB is selected */}
          {showSequence && pitchLocations
            .filter((p) => !displayed.find((d) => d.pitchNumber === p.pitchNumber))
            .map((pitch) => (
              <div
                key={pitch.id}
                className="absolute w-4 h-4 rounded-full transform -translate-x-1/2 -translate-y-1/2 opacity-15"
                style={{
                  left: `${toPercent(pitch.xLocation)}%`,
                  top: `${100 - toPercent(pitch.yLocation)}%`,
                  backgroundColor: PITCH_TYPE_COLORS[pitch.pitchType.toString()] ?? PITCH_TYPE_COLORS["1"],
                }}
              />
            ))}

          {/* Active pitches */}
          {displayed.map((pitch) => {
            const seq = seqMap.get(pitch.pitchNumber) ?? 1;
            const color = PITCH_TYPE_COLORS[pitch.pitchType.toString()] ?? PITCH_TYPE_COLORS["1"];
            const borderColor = pitch.isStrike ? 'rgba(255,255,255,0.8)' : 'rgba(255,80,80,0.8)';
            return (
              <div
                key={pitch.id}
                className={`absolute rounded-full transform -translate-x-1/2 -translate-y-1/2 flex items-center justify-center border-2 ${showSequence ? 'w-6 h-6' : 'w-4 h-4'}`}
                style={{
                  left: `${toPercent(pitch.xLocation)}%`,
                  top: `${100 - toPercent(pitch.yLocation)}%`,
                  backgroundColor: color,
                  borderColor,
                  zIndex: 10,
                }}
                title={`#${pitch.pitchNumber} ${pitchTypes[pitch.pitchType.toString()] ?? `P${pitch.pitchType}`} – ${pitch.isStrike ? 'Strike' : 'Ball'}`}
              >
                {showSequence && (
                  <span className="text-white font-bold leading-none" style={{ fontSize: 9 }}>
                    {seq}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend: pitch type + ball/strike indicator */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs justify-center">
        {usedPitchTypes.map((pt) => (
          <div key={pt} className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PITCH_TYPE_COLORS[pt.toString()] }} />
            <span className="text-muted-foreground">{pitchTypes[pt.toString()] ?? `P${pt}`}</span>
          </div>
        ))}
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full border-2 border-white/80 bg-transparent" />
          <span className="text-muted-foreground">Strike</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full border-2 border-red-400 bg-transparent" />
          <span className="text-muted-foreground">Ball</span>
        </div>
      </div>
    </div>
  );
}
