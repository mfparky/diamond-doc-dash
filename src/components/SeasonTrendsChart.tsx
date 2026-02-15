import { useMemo, useState } from 'react';
import { Outing } from '@/types/pitcher';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import { TrendingUp, Target, Gauge } from 'lucide-react';

interface SeasonTrendsChartProps {
  outings: Outing[];
}

type MetricKey = 'velocity' | 'strikePercent' | 'pitchCount';

interface MetricConfig {
  key: MetricKey;
  label: string;
  shortLabel: string;
  color: string;
  icon: React.ReactNode;
  unit: string;
  valueFormatter: (v: number) => string;
}

const METRICS: MetricConfig[] = [
  {
    key: 'velocity',
    label: 'Max Velocity',
    shortLabel: 'Velo',
    color: 'hsl(0, 72%, 55%)',
    icon: <Gauge className="w-3.5 h-3.5" />,
    unit: ' mph',
    valueFormatter: (v: number) => `${v} mph`,
  },
  {
    key: 'strikePercent',
    label: 'Strike %',
    shortLabel: 'Strike %',
    color: 'hsl(38, 92%, 50%)',
    icon: <Target className="w-3.5 h-3.5" />,
    unit: '%',
    valueFormatter: (v: number) => `${v.toFixed(1)}%`,
  },
  {
    key: 'pitchCount',
    label: 'Pitch Count',
    shortLabel: 'Pitches',
    color: 'hsl(142, 50%, 40%)',
    icon: <TrendingUp className="w-3.5 h-3.5" />,
    unit: '',
    valueFormatter: (v: number) => `${v}`,
  },
];

export function SeasonTrendsChart({ outings }: SeasonTrendsChartProps) {
  const [activeMetric, setActiveMetric] = useState<MetricKey>('velocity');

  const chartData = useMemo(() => {
    const sorted = [...outings]
      .filter((o) => {
        const d = new Date(o.date);
        return d.getFullYear() === 2026;
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return sorted.map((outing) => {
      const strikePercent =
        outing.strikes !== null && outing.pitchCount > 0
          ? (outing.strikes / outing.pitchCount) * 100
          : null;

      // Parse as local date
      const [year, month, day] = outing.date.split('-').map(Number);
      const date = new Date(year, month - 1, day, 12, 0, 0, 0);

      return {
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        fullDate: outing.date,
        velocity: outing.maxVelo > 0 ? outing.maxVelo : null,
        strikePercent: strikePercent !== null ? Math.round(strikePercent * 10) / 10 : null,
        pitchCount: outing.pitchCount,
        eventType: outing.eventType,
      };
    });
  }, [outings]);

  const metric = METRICS.find((m) => m.key === activeMetric)!;

  // Calculate average for reference line
  const average = useMemo(() => {
    const values = chartData
      .map((d) => d[activeMetric] as number | null)
      .filter((v): v is number => v !== null);
    if (values.length === 0) return null;
    return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
  }, [chartData, activeMetric]);

  // Calculate trend direction
  const trend = useMemo(() => {
    const values = chartData
      .map((d) => d[activeMetric] as number | null)
      .filter((v): v is number => v !== null);
    if (values.length < 3) return null;
    const recentHalf = values.slice(Math.floor(values.length / 2));
    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const recentAvg = recentHalf.reduce((a, b) => a + b, 0) / recentHalf.length;
    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const diff = recentAvg - firstAvg;
    if (Math.abs(diff) < 0.5) return 'stable';
    return diff > 0 ? 'up' : 'down';
  }, [chartData, activeMetric]);

  if (chartData.length < 2) {
    return null;
  }

  return (
    <Card className="glass-card">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="font-display text-lg">Season Trends</CardTitle>
          {trend && (
            <span
              className={`text-xs font-medium px-2 py-1 rounded-full ${
                trend === 'up'
                  ? 'bg-[hsl(142,70%,45%)]/15 text-[hsl(142,70%,45%)]'
                  : trend === 'down'
                  ? 'bg-[hsl(0,72%,55%)]/15 text-[hsl(0,72%,55%)]'
                  : 'bg-[hsl(200,10%,45%)]/15 text-[hsl(200,10%,45%)]'
              }`}
            >
              {trend === 'up' ? 'Trending Up' : trend === 'down' ? 'Trending Down' : 'Stable'}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {/* Metric Selector Tabs */}
        <div className="flex gap-1 mb-4 bg-secondary rounded-lg p-1">
          {METRICS.map((m) => (
            <button
              key={m.key}
              onClick={() => setActiveMetric(m.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-md text-xs font-medium transition-colors ${
                activeMetric === m.key
                  ? 'bg-card shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {m.icon}
              <span className="hidden sm:inline">{m.label}</span>
              <span className="sm:hidden">{m.shortLabel}</span>
            </button>
          ))}
        </div>

        {/* Chart */}
        <div className="h-[220px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 10, right: 10, left: -10, bottom: 20 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(var(--border))"
                opacity={0.3}
              />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={{ stroke: 'hsl(var(--border))' }}
                axisLine={{ stroke: 'hsl(var(--border))' }}
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={{ stroke: 'hsl(var(--border))' }}
                axisLine={{ stroke: 'hsl(var(--border))' }}
                allowDecimals={activeMetric === 'strikePercent'}
                domain={activeMetric === 'strikePercent' ? [0, 100] : ['auto', 'auto']}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  color: 'hsl(var(--foreground))',
                }}
                labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 600 }}
                formatter={(value: number) => [metric.valueFormatter(value), metric.label]}
              />
              {average !== null && (
                <ReferenceLine
                  y={average}
                  stroke={metric.color}
                  strokeDasharray="4 4"
                  strokeOpacity={0.5}
                  label={{
                    value: `Avg: ${metric.valueFormatter(average)}`,
                    position: 'right',
                    fill: 'hsl(var(--muted-foreground))',
                    fontSize: 10,
                  }}
                />
              )}
              <Line
                type="monotone"
                dataKey={activeMetric}
                stroke={metric.color}
                strokeWidth={2.5}
                dot={{ fill: metric.color, strokeWidth: 0, r: 4 }}
                activeDot={{ fill: metric.color, strokeWidth: 2, stroke: 'hsl(var(--card))', r: 6 }}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Summary Stats Row */}
        {(() => {
          const values = chartData
            .map((d) => d[activeMetric] as number | null)
            .filter((v): v is number => v !== null);
          if (values.length === 0) return null;
          const min = Math.min(...values);
          const max = Math.max(...values);
          const latest = values[values.length - 1];

          return (
            <div className="flex justify-between mt-4 text-xs text-muted-foreground border-t border-border/30 pt-3">
              <div>
                <span className="block text-[10px] uppercase tracking-wider">Low</span>
                <span className="font-semibold text-foreground">{metric.valueFormatter(min)}</span>
              </div>
              <div className="text-center">
                <span className="block text-[10px] uppercase tracking-wider">Average</span>
                <span className="font-semibold text-foreground">
                  {average !== null ? metric.valueFormatter(average) : '-'}
                </span>
              </div>
              <div className="text-center">
                <span className="block text-[10px] uppercase tracking-wider">High</span>
                <span className="font-semibold text-foreground">{metric.valueFormatter(max)}</span>
              </div>
              <div className="text-right">
                <span className="block text-[10px] uppercase tracking-wider">Latest</span>
                <span className="font-semibold text-foreground">{metric.valueFormatter(latest)}</span>
              </div>
            </div>
          );
        })()}
      </CardContent>
    </Card>
  );
}
