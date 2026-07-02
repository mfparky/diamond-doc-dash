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

interface QuadrantPoint {
  name: string;
  x: number;
  y: number;
  z: number;
  belowReef: boolean;
  pv: number;
  labelDy: number;
  labelAnchor: 'start' | 'middle' | 'end';
}

function getLabelPlacement(x: number, y: number, index: number) {
  if (y >= 70) {
    return {
      labelDy: index % 2 === 0 ? -18 : -32,
      labelAnchor: 'middle' as const,
    };
  }

  if (x >= 78) {
    return {
      labelDy: y <= 12 ? -14 : -18,
      labelAnchor: 'end' as const,
    };
  }

  if (x <= 22) {
    return {
      labelDy: -18,
      labelAnchor: 'start' as const,
    };
  }

  return {
    labelDy: index % 2 === 0 ? -18 : 18,
    labelAnchor: 'middle' as const,
  };
}

function QuadrantPointLabel(props: Record<string, unknown>) {
  const x = Number(props.x ?? 0);
  const y = Number(props.y ?? 0);
  const payload = props.payload as QuadrantPoint | undefined;
  const name = String(props.value ?? payload?.name ?? '');
  if (!name) return null;

  const labelDy = payload?.labelDy ?? -22;
  const labelAnchor = payload?.labelAnchor ?? 'middle';

  const words = name.split(' ');
  const lines = words.length > 1 ? [words[0], words.slice(1).join(' ')] : [name];
  const textWidth = Math.min(76, Math.max(...lines.map((line) => line.length)) * 5.7 + 10);
  const boxHeight = lines.length * 12 + 8;
  const boxX =
    payload.labelAnchor === 'end'
      ? x - textWidth
      : payload.labelAnchor === 'start'
        ? x
        : x - textWidth / 2;
  const boxY = y + labelDy - boxHeight / 2;
  const textX =
    labelAnchor === 'end'
      ? x - 5
      : labelAnchor === 'start'
        ? x + 5
        : x;

  return (
    <g pointerEvents="none">
      <rect
        x={boxX}
        y={boxY}
        width={textWidth}
        height={boxHeight}
        rx={4}
        fill="hsl(var(--background))"
        fillOpacity={0.88}
        stroke="hsl(var(--border))"
        strokeOpacity={0.75}
      />
      <text
        x={textX}
        y={boxY + 13}
        textAnchor={labelAnchor}
        fill="hsl(var(--foreground))"
        fontSize={10}
        fontWeight={700}
      >
        {lines.map((line, lineIdx) => (
          <tspan key={line} x={textX} dy={lineIdx === 0 ? 0 : 11}>
            {line}
          </tspan>
        ))}
      </text>
    </g>
  );
}

/**
 * Offense × Defense scatter — coaches instantly see two-way stars (top-right),
 * specialists, and develop-list players. Dot size scales with IP volume so
 * starters pop visually.
 */
export function QuadrantChart({ rankings }: QuadrantChartProps) {
  const data = useMemo(() => {
    return rankings.map((r, index) => {
      const x = r.offenseScore ?? 0;
      const y = r.defenseScore ?? 0;
      return {
        name: r.pitcherName,
        x,
        y,
        z: Math.max(60, (r.pitchingVolumeScore ?? 0) * 4 + 80), // 80–480 dot range
        belowReef: r.belowReef,
        pv: r.playerValue,
        ...getLabelPlacement(x, y, index),
      };
    });
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

      <div className="w-full h-[420px] sm:h-[480px] [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-label]:fill-foreground">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 34, right: 30, left: 4, bottom: 28 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
            <XAxis
              type="number"
              dataKey="x"
              name="Offense"
              domain={[0, 100]}
              label={{ value: 'Offense', position: 'insideBottom', offset: -10, fontSize: 11, fill: 'hsl(var(--foreground))' }}
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              stroke="hsl(var(--border))"
            />
            <YAxis
              type="number"
              dataKey="y"
              name="Defense"
              domain={[0, 100]}
              label={{ value: 'Defense', angle: -90, position: 'insideLeft', fontSize: 11, fill: 'hsl(var(--foreground))' }}
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              stroke="hsl(var(--border))"
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
                content={QuadrantPointLabel}
              />
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
