import { useMemo, useState } from 'react';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { PlayerRanking } from '@/lib/team-rankings';

interface RadarOverlayProps {
  rankings: PlayerRanking[];
}

const PALETTE = [
  'hsl(var(--primary))',
  'hsl(var(--accent))',
  'hsl(var(--chart-4))',
];

const AXES: Array<{ key: 'offenseScore' | 'defenseScore' | 'intangiblesScore' | 'pitchingVolumeScore'; label: string }> = [
  { key: 'offenseScore', label: 'Offense' },
  { key: 'defenseScore', label: 'Defense' },
  { key: 'intangiblesScore', label: 'Intangibles' },
  { key: 'pitchingVolumeScore', label: 'Volume' },
];

/**
 * Up to 3 players overlaid on a 4-axis radar (Off / Def / Intangibles /
 * Volume). Lets a coach compare specific kids head-to-head.
 */
export function RadarOverlay({ rankings }: RadarOverlayProps) {
  // Default selection: top 2 by Player Value.
  const [selectedIds, setSelectedIds] = useState<string[]>(() =>
    rankings.slice(0, 2).map((r) => r.pitcherId),
  );

  const data = useMemo(() => {
    return AXES.map(({ key, label }) => {
      const row: Record<string, number | string> = { axis: label };
      for (const r of rankings.filter((p) => selectedIds.includes(p.pitcherId))) {
        const v = r[key];
        row[r.pitcherName] = typeof v === 'number' ? Number(v.toFixed(1)) : 0;
      }
      return row;
    });
  }, [rankings, selectedIds]);

  const togglePlayer = (id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((p) => p !== id);
      if (prev.length >= 3) return [...prev.slice(1), id]; // FIFO when at limit
      return [...prev, id];
    });
  };

  const selectedPlayers = rankings.filter((r) => selectedIds.includes(r.pitcherId));

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          Compare players (up to 3)
        </p>
        <div className="flex flex-wrap gap-1.5">
          {rankings.map((r) => {
            const isOn = selectedIds.includes(r.pitcherId);
            return (
              <Button
                key={r.pitcherId}
                variant={isOn ? 'default' : 'outline'}
                size="sm"
                className="h-7 text-xs"
                onClick={() => togglePlayer(r.pitcherId)}
              >
                {r.pitcherName}
              </Button>
            );
          })}
        </div>
      </div>

      {selectedPlayers.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          Pick at least one player above to render the radar.
        </p>
      ) : (
        <div className="w-full h-[380px] sm:h-[420px]">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={data} outerRadius="75%">
              <PolarGrid stroke="hsl(var(--border))" />
              <PolarAngleAxis dataKey="axis" tick={{ fontSize: 11, fill: 'hsl(var(--foreground))' }} />
              <PolarRadiusAxis
                angle={90}
                domain={[0, 100]}
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                stroke="hsl(var(--border))"
              />
              {selectedPlayers.map((p, idx) => (
                <Radar
                  key={p.pitcherId}
                  name={p.pitcherName}
                  dataKey={p.pitcherName}
                  stroke={PALETTE[idx % PALETTE.length]}
                  fill={PALETTE[idx % PALETTE.length]}
                  fillOpacity={0.25}
                />
              ))}
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 6,
                  fontSize: 12,
                  color: 'hsl(var(--foreground))',
                }}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
                itemStyle={{ color: 'hsl(var(--foreground))' }}
              />
              <Legend wrapperStyle={{ fontSize: 12, color: 'hsl(var(--foreground))' }} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
