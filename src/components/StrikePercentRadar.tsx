import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Tooltip,
} from 'recharts';
import { Target } from 'lucide-react';

interface PitcherSeasonSummary {
  id: string;
  name: string;
  strikePercent: number;
  strikePitches: number;
}

interface StrikePercentRadarProps {
  pitcherSeasons: PitcherSeasonSummary[];
}

export function StrikePercentRadar({ pitcherSeasons }: StrikePercentRadarProps) {
  const radarData = useMemo(() => {
    return pitcherSeasons
      .filter((p) => p.strikePitches >= 10) // Only show pitchers with enough data
      .map((p) => ({
        name: p.name.split(' ').pop() || p.name,
        fullName: p.name,
        strikePercent: Math.round(p.strikePercent * 10) / 10,
      }));
  }, [pitcherSeasons]);

  if (radarData.length < 3) return null;

  return (
    <Card className="glass-card">
      <CardHeader className="pb-2">
        <CardTitle className="font-display text-lg flex items-center gap-2">
          <Target className="w-5 h-5 text-accent" />
          Strike % Distribution
        </CardTitle>
        <p className="text-xs text-muted-foreground">Season strike percentage by player</p>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
              <PolarGrid stroke="hsl(var(--border))" />
              <PolarAngleAxis
                dataKey="name"
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              />
              <PolarRadiusAxis
                angle={90}
                domain={[0, 100]}
                tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                tickFormatter={(v: number) => `${v}%`}
              />
              <Radar
                name="Strike %"
                dataKey="strikePercent"
                stroke="hsl(var(--primary))"
                fill="hsl(var(--primary))"
                fillOpacity={0.25}
                strokeWidth={2}
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
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
