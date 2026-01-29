import { useMemo } from 'react';
import { Outing } from '@/types/pitcher';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, Legend } from 'recharts';

interface PitchCountChartProps {
  outings: Outing[];
}

const EVENT_COLORS: Record<string, string> = {
  'Bullpen': 'hsl(220, 70%, 45%)',      // dark blue
  'Game': 'hsl(142, 70%, 45%)',          // green
  'External': 'hsl(200, 80%, 60%)',      // light blue
  'Practice': 'hsl(25, 90%, 55%)',       // orange
};

const EVENT_LEGEND_COLORS: Record<string, string> = {
  'Bullpen': '220, 70%, 45%',            // dark blue
  'Game': '142, 70%, 45%',               // green
  'External': '200, 80%, 60%',           // light blue
  'Practice': '25, 90%, 55%',            // orange
};

export function PitchCountChart({ outings }: PitchCountChartProps) {
  const chartData = useMemo(() => {
    // Filter to 2026 season and sort by date ascending
    const seasonOutings = outings
      .filter((o) => {
        const date = new Date(o.date);
        return date.getFullYear() === 2026;
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return seasonOutings.map((outing) => ({
      date: new Date(outing.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      pitches: outing.pitchCount,
      eventType: outing.eventType,
      fullDate: outing.date,
    }));
  }, [outings]);

  // Get unique event types present in the data for legend
  const eventTypesInData = useMemo(() => {
    const types = new Set(chartData.map((d) => d.eventType));
    return Array.from(types);
  }, [chartData]);

  if (chartData.length === 0) {
    return null;
  }

  return (
    <Card className="glass-card">
      <CardHeader className="pb-2">
        <CardTitle className="font-display text-lg">Season Pitch Count</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[250px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart 
              data={chartData} 
              margin={{ top: 10, right: 10, left: -10, bottom: 20 }}
              style={{ backgroundColor: 'transparent' }}
            >
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
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  color: 'hsl(var(--foreground))',
                }}
                labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 600 }}
                formatter={(value: number, name: string, props: any) => [
                  `${value} pitches`,
                  props.payload.eventType,
                ]}
              />
              <Bar dataKey="pitches" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={EVENT_COLORS[entry.eventType] || 'hsl(var(--muted))'} 
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        
        {/* Custom Legend */}
        <div className="flex flex-wrap justify-center gap-4 mt-4 text-sm">
          {eventTypesInData.map((type) => (
            <div key={type} className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-sm" 
                style={{ backgroundColor: `hsl(${EVENT_LEGEND_COLORS[type]})` }}
              />
              <span className="text-muted-foreground">{type}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
