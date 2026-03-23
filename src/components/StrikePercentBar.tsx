import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, ReferenceLine,
} from 'recharts';
import { Target } from 'lucide-react';

interface PitcherSeasonSummary {
  id: string;
  name: string;
  strikePercent: number;
  strikePitches: number;
}

interface StrikePercentBarProps {
  pitcherSeasons: PitcherSeasonSummary[];
}

export function StrikePercentBar({ pitcherSeasons }: StrikePercentBarProps) {
  const chartData = useMemo(() => {
    return pitcherSeasons
      .filter((p) => p.strikePitches >= 10)
      .sort((a, b) => b.strikePercent - a.strikePercent)
      .map((p) => ({
        name: p.name.split(' ').pop() || p.name,
        fullName: p.name,
        strikePercent: Math.round(p.strikePercent * 10) / 10,
      }));
  }, [pitcherSeasons]);

  const average = useMemo(() => {
    if (chartData.length === 0) return 0;
    return Math.round((chartData.reduce((s, d) => s + d.strikePercent, 0) / chartData.length) * 10) / 10;
  }, [chartData]);

  if (chartData.length < 2) return null;

  return (
    <Card className="glass-card">
      <CardHeader className="pb-2 px-3 sm:px-6">
        <CardTitle className="font-display text-base sm:text-lg flex items-center gap-2">
          <Target className="w-4 h-4 sm:w-5 sm:h-5 text-accent" />
          Strike %
        </CardTitle>
      </CardHeader>
      <CardContent className="px-2 sm:px-6">
        <div className="h-[200px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 5, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} horizontal={false} />
              <XAxis
                type="number"
                domain={[0, 100]}
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={{ stroke: 'hsl(var(--border))' }}
                axisLine={{ stroke: 'hsl(var(--border))' }}
                tickFormatter={(v: number) => `${v}%`}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={{ stroke: 'hsl(var(--border))' }}
                width={70}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  color: 'hsl(var(--foreground))',
                }}
                formatter={(value: number, _: string, props: any) => [
                  `${value}%`,
                  props.payload.fullName,
                ]}
              />
              <ReferenceLine
                x={average}
                stroke="hsl(var(--muted-foreground))"
                strokeDasharray="4 4"
                strokeOpacity={0.6}
                label={{
                  value: `Avg: ${average}%`,
                  position: 'top',
                  fill: 'hsl(var(--muted-foreground))',
                  fontSize: 10,
                }}
              />
              <Bar dataKey="strikePercent" radius={[0, 4, 4, 0]} maxBarSize={24}>
                {chartData.map((entry) => (
                  <Cell
                    key={entry.name}
                    fill={
                      entry.strikePercent >= 60
                        ? 'hsl(var(--success))'
                        : entry.strikePercent >= 50
                        ? 'hsl(var(--warning))'
                        : 'hsl(var(--destructive))'
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
