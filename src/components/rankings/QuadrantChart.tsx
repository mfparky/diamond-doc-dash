import { useMemo } from 'react';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Cell,
  LabelList,
} from 'recharts';
import type { PlayerRanking } from '@/lib/team-rankings';

interface QuadrantChartProps {
  rankings: PlayerRanking[];
}

/**
 * Offense × Defense scatter — coaches instantly see two-way stars (top-right),
 * specialists, and develop-list players. Dot size scales with IP volume so
 * starters pop visually.
 */
export function QuadrantChart({ rankings }: QuadrantChartProps) {
  const data = useMemo(() => {
    return rankings.map((r) => ({
      name: r.pitcherName,
      x: r.offenseScore ?? 0,
      y: r.defenseScore ?? 0,
      z: Math.max(60, (r.pitchingVolumeScore ?? 0) * 4 + 80), // 80–480 dot range
      belowReef: r.belowReef,
      pv: r.playerValue,
    }));
  }, [rankings]);

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2 text-[10px] text-muted-foreground">
        <div>
          <span className="font-semibold text-foreground">Arms</span> — strong defense, weaker offense (top-left)
        </div>
        <div className="text-right">
          <span className="font-semibold text-foreground">Two-way stars</span> — both (top-right)
        </div>
        <div>
          <span className="font-semibold text-foreground">Develop</span> — both low (bottom-left)
        </div>
        <div className="text-right">
          <span className="font-semibold text-foreground">Sluggers</span> — strong bat, weak arm (bottom-right)
        </div>
      </div>

      <div className="w-full" style={{ height: 480 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 20, right: 24, left: 12, bottom: 28 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
            <XAxis
              type="number"
              dataKey="x"
              name="Offense"
              domain={[0, 100]}
              label={{ value: 'Offense', position: 'insideBottom', offset: -10, fontSize: 11 }}
              className="text-xs"
            />
            <YAxis
              type="number"
              dataKey="y"
              name="Defense"
              domain={[0, 100]}
              label={{ value: 'Defense', angle: -90, position: 'insideLeft', fontSize: 11 }}
              className="text-xs"
            />
            <ZAxis type="number" dataKey="z" range={[80, 480]} />
            <Tooltip
              cursor={{ strokeDasharray: '3 3' }}
              content={({ active, payload }) => {
                if (!active || !payload || payload.length === 0) return null;
                const p = payload[0].payload as typeof data[number];
                return (
                  <div className="rounded-md border border-border bg-card p-2 text-xs shadow-md">
                    <p className="font-semibold text-foreground">{p.name}</p>
                    <p className="text-muted-foreground">PV {p.pv.toFixed(1)}</p>
                    <p className="text-muted-foreground">Off {p.x.toFixed(0)} · Def {p.y.toFixed(0)}</p>
                  </div>
                );
              }}
            />
            <ReferenceLine x={50} strokeDasharray="4 4" stroke="hsl(var(--border))" />
            <ReferenceLine y={50} strokeDasharray="4 4" stroke="hsl(var(--border))" />
            <Scatter data={data}>
              {data.map((entry, idx) => (
                <Cell
                  key={`cell-${idx}`}
                  fill={entry.belowReef ? 'hsl(var(--muted-foreground))' : 'hsl(var(--primary))'}
                  fillOpacity={entry.belowReef ? 0.5 : 0.85}
                  stroke="hsl(var(--background))"
                  strokeWidth={1.5}
                />
              ))}
              <LabelList
                dataKey="name"
                position="top"
                style={{ fontSize: 10, fill: 'hsl(var(--foreground))' }}
              />
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
