import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { parseLocalDateAtNoon } from '@/types/pitcher';

export interface GameSummary {
  id: string;
  date: string;
  opponent: string | null;
  pitches: number;
  strikePct: number | null;
  pitcherCount: number;
  topVelo: number;
}

interface GameByGameChartProps {
  games: GameSummary[];
}

function formatShortDate(date: string): string {
  return parseLocalDateAtNoon(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Replaces the old per-game data list with a combined bar (pitches) + line
 * (strike %) chart, so a coach can read the season's game-to-game trend at a
 * glance instead of scanning rows. Full per-game detail still lives one tap
 * away via the tooltip, or the "Review" link into the game log for anyone
 * who wants the raw table.
 */
export function GameByGameChart({ games }: GameByGameChartProps) {
  const navigate = useNavigate();

  const chartData = useMemo(
    () =>
      [...games]
        .sort((a, b) => parseLocalDateAtNoon(a.date).getTime() - parseLocalDateAtNoon(b.date).getTime())
        .map((g) => ({ ...g, label: formatShortDate(g.date) })),
    [games],
  );

  if (chartData.length === 0) return null;

  const handleClick = (state: { activePayload?: Array<{ payload: GameSummary }> }) => {
    const id = state?.activePayload?.[0]?.payload?.id;
    if (!id) return;
    navigate(id.startsWith('outing-') ? '/game-log' : `/game-log/${id}`);
  };

  return (
    <Card className="glass-card">
      <CardHeader className="pb-2 px-3 sm:px-6">
        <CardTitle className="font-display text-base sm:text-lg">Game-by-Game</CardTitle>
        <p className="text-xs text-muted-foreground">
          Pitches and strike % across the selected range — tap a game for details
        </p>
      </CardHeader>
      <CardContent className="px-2 sm:px-6">
        <div className="h-[260px] w-full cursor-pointer">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 20 }} onClick={handleClick}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={{ stroke: 'hsl(var(--border))' }}
                axisLine={{ stroke: 'hsl(var(--border))' }}
                angle={-45}
                textAnchor="end"
                height={50}
              />
              <YAxis
                yAxisId="pitches"
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={{ stroke: 'hsl(var(--border))' }}
                axisLine={{ stroke: 'hsl(var(--border))' }}
                allowDecimals={false}
                width={32}
              />
              <YAxis
                yAxisId="strike"
                orientation="right"
                domain={[0, 100]}
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={false}
                width={32}
              />
              <Tooltip content={<GameTooltip />} cursor={{ fill: 'hsl(var(--muted))', opacity: 0.3 }} />
              <Bar
                yAxisId="pitches"
                dataKey="pitches"
                name="Pitches"
                fill="hsl(var(--status-active))"
                radius={[4, 4, 0, 0]}
                maxBarSize={36}
              />
              <Line
                yAxisId="strike"
                type="monotone"
                dataKey="strikePct"
                name="Strike %"
                stroke="hsl(var(--accent))"
                strokeWidth={2.5}
                dot={{ fill: 'hsl(var(--accent))', strokeWidth: 0, r: 4 }}
                activeDot={{ r: 6 }}
                connectNulls
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: 'hsl(var(--status-active))' }} />
            Pitches
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: 'hsl(var(--accent))' }} />
            Strike %
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function GameTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: GameSummary & { label: string } }> }) {
  if (!active || !payload || !payload.length) return null;
  const g = payload[0].payload;
  return (
    <div
      className="rounded-lg border p-3 text-sm shadow-md"
      style={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }}
    >
      <p className="font-semibold text-foreground">
        {g.label}
        {g.opponent ? ` vs ${g.opponent}` : ''}
      </p>
      <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
        <p>Pitches: <span className="text-foreground font-medium">{g.pitches || '—'}</span></p>
        <p>Strike %: <span className="text-foreground font-medium">{g.strikePct !== null ? `${g.strikePct}%` : '—'}</span></p>
        <p>Top velo: <span className="text-foreground font-medium">{g.topVelo > 0 ? g.topVelo : '—'}</span></p>
        <p>Arms used: <span className="text-foreground font-medium">{g.pitcherCount || '—'}</span></p>
      </div>
    </div>
  );
}
