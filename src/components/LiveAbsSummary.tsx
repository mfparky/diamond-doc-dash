import { parseLiveAbsData, AB_OUTCOME_COLOR, abPitchRange } from '@/types/at-bats';

interface LiveAbsSummaryProps {
  notes: string | undefined | null;
  pitchCount?: number;
}

export function LiveAbsSummary({ notes, pitchCount }: LiveAbsSummaryProps) {
  const data = parseLiveAbsData(notes);
  if (!data || data.atBats.length === 0) return null;

  return (
    <div className="mt-2 border-t border-border/30 pt-2 space-y-1">
      <p className="text-xs text-muted-foreground font-medium">
        {data.atBats.length} AB{data.atBats.length !== 1 ? 's' : ''}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {data.atBats.map((ab, i) => {
          const [start, end] = abPitchRange(data.atBats, i);
          const pitches = end - start + 1;
          const color = ab.outcome ? AB_OUTCOME_COLOR[ab.outcome] : 'hsl(0,0%,50%)';
          return (
            <span
              key={ab.ab}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold text-white"
              style={{ backgroundColor: color }}
              title={`AB ${ab.ab}: ${pitches} pitch${pitches !== 1 ? 'es' : ''}`}
            >
              {ab.outcome ?? '?'}
              <span className="opacity-70 font-normal">{pitches}p</span>
            </span>
          );
        })}
      </div>
      {data.text && (
        <p className="text-xs text-muted-foreground">{data.text}</p>
      )}
    </div>
  );
}
