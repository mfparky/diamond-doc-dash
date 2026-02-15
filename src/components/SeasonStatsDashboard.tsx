import { useMemo, useState } from 'react';
import { Outing } from '@/types/pitcher';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SeasonTrendsChart } from './SeasonTrendsChart';
import { PitchTypeConfig, DEFAULT_PITCH_TYPES, PITCH_TYPE_COLORS } from '@/types/pitch-location';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
  PieChart, Pie, Legend,
} from 'recharts';
import {
  TrendingUp, TrendingDown, Minus, Trophy, Calendar, Target, Gauge, Activity,
  ChevronDown, ChevronUp, Award,
} from 'lucide-react';

interface SeasonStatsDashboardProps {
  outings: Outing[];
  pitchTypes?: PitchTypeConfig;
  pitcherName?: string;
}

interface MilestoneEvent {
  date: string;
  label: string;
  type: 'positive' | 'negative' | 'neutral';
}

export function SeasonStatsDashboard({
  outings,
  pitchTypes = DEFAULT_PITCH_TYPES,
  pitcherName,
}: SeasonStatsDashboardProps) {
  const [showAllOutings, setShowAllOutings] = useState(false);

  // Filter to 2026 season
  const seasonOutings = useMemo(
    () =>
      outings
        .filter((o) => new Date(o.date).getFullYear() === 2026)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [outings]
  );

  // Season summary stats
  const summary = useMemo(() => {
    if (seasonOutings.length === 0) return null;

    const totalPitches = seasonOutings.reduce((s, o) => s + o.pitchCount, 0);
    const withStrikes = seasonOutings.filter((o) => o.strikes !== null);
    const totalStrikePitches = withStrikes.reduce((s, o) => s + o.pitchCount, 0);
    const totalStrikes = withStrikes.reduce((s, o) => s + (o.strikes ?? 0), 0);
    const strikePercent = totalStrikePitches > 0 ? (totalStrikes / totalStrikePitches) * 100 : 0;

    const velocities = seasonOutings.map((o) => o.maxVelo).filter((v) => v > 0);
    const maxVelo = velocities.length > 0 ? Math.max(...velocities) : 0;
    const avgVelo = velocities.length > 0 ? velocities.reduce((a, b) => a + b, 0) / velocities.length : 0;

    const eventCounts: Record<string, number> = {};
    seasonOutings.forEach((o) => {
      eventCounts[o.eventType] = (eventCounts[o.eventType] || 0) + 1;
    });

    // Monthly breakdown
    const monthlyData: Record<string, { pitches: number; outings: number; strikes: number; strikePitches: number; maxVelo: number }> = {};
    seasonOutings.forEach((o) => {
      const [year, month] = o.date.split('-');
      const key = `${year}-${month}`;
      if (!monthlyData[key]) monthlyData[key] = { pitches: 0, outings: 0, strikes: 0, strikePitches: 0, maxVelo: 0 };
      monthlyData[key].pitches += o.pitchCount;
      monthlyData[key].outings += 1;
      if (o.strikes !== null) {
        monthlyData[key].strikes += o.strikes;
        monthlyData[key].strikePitches += o.pitchCount;
      }
      monthlyData[key].maxVelo = Math.max(monthlyData[key].maxVelo, o.maxVelo || 0);
    });

    const monthlyBreakdown = Object.entries(monthlyData)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, data]) => {
        const [y, m] = key.split('-').map(Number);
        const monthDate = new Date(y, m - 1, 1);
        return {
          month: monthDate.toLocaleDateString('en-US', { month: 'short' }),
          ...data,
          strikePercent: data.strikePitches > 0 ? Math.round((data.strikes / data.strikePitches) * 100) : 0,
        };
      });

    return {
      totalOutings: seasonOutings.length,
      totalPitches,
      totalStrikes,
      strikePercent,
      maxVelo,
      avgVelo,
      eventCounts,
      monthlyBreakdown,
    };
  }, [seasonOutings]);

  // Milestones detection
  const milestones = useMemo((): MilestoneEvent[] => {
    const events: MilestoneEvent[] = [];
    let maxVeloSoFar = 0;
    let bestStrikePercent = 0;

    seasonOutings.forEach((o) => {
      // New max velo
      if (o.maxVelo > maxVeloSoFar && o.maxVelo > 0) {
        if (maxVeloSoFar > 0) {
          events.push({
            date: o.date,
            label: `New max velo: ${o.maxVelo} mph`,
            type: 'positive',
          });
        }
        maxVeloSoFar = o.maxVelo;
      }

      // Best strike percentage (min 15 pitches)
      if (o.strikes !== null && o.pitchCount >= 15) {
        const pct = (o.strikes / o.pitchCount) * 100;
        if (pct > bestStrikePercent) {
          if (bestStrikePercent > 0) {
            events.push({
              date: o.date,
              label: `Best strike %: ${pct.toFixed(0)}%`,
              type: 'positive',
            });
          }
          bestStrikePercent = pct;
        }
      }

      // High pitch count warning
      if (o.pitchCount >= 76) {
        events.push({
          date: o.date,
          label: `High pitch count: ${o.pitchCount}`,
          type: 'negative',
        });
      }
    });

    return events.slice(-8); // Last 8 milestones
  }, [seasonOutings]);

  // Improvement indicators (compare first half to second half)
  const improvements = useMemo(() => {
    if (seasonOutings.length < 4) return null;
    const mid = Math.floor(seasonOutings.length / 2);
    const firstHalf = seasonOutings.slice(0, mid);
    const secondHalf = seasonOutings.slice(mid);

    const calcAvgVelo = (outings: Outing[]) => {
      const velos = outings.map((o) => o.maxVelo).filter((v) => v > 0);
      return velos.length > 0 ? velos.reduce((a, b) => a + b, 0) / velos.length : 0;
    };

    const calcStrikePercent = (outings: Outing[]) => {
      const with_s = outings.filter((o) => o.strikes !== null);
      const pitches = with_s.reduce((s, o) => s + o.pitchCount, 0);
      const strikes = with_s.reduce((s, o) => s + (o.strikes ?? 0), 0);
      return pitches > 0 ? (strikes / pitches) * 100 : 0;
    };

    const calcAvgPitchCount = (outings: Outing[]) =>
      outings.length > 0 ? outings.reduce((s, o) => s + o.pitchCount, 0) / outings.length : 0;

    return {
      velocity: { first: calcAvgVelo(firstHalf), second: calcAvgVelo(secondHalf) },
      strikePercent: { first: calcStrikePercent(firstHalf), second: calcStrikePercent(secondHalf) },
      pitchCount: { first: calcAvgPitchCount(firstHalf), second: calcAvgPitchCount(secondHalf) },
    };
  }, [seasonOutings]);

  // Outing-by-outing table data
  const outingTableData = useMemo(
    () =>
      [...seasonOutings]
        .reverse()
        .slice(0, showAllOutings ? undefined : 10),
    [seasonOutings, showAllOutings]
  );

  if (seasonOutings.length === 0) {
    return (
      <Card className="glass-card">
        <CardContent className="p-8 text-center">
          <Activity className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No 2026 season outings yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-display text-xl font-bold text-foreground">
          {pitcherName ? `${pitcherName}'s ` : ''}Season Dashboard
        </h3>
        <span className="text-xs text-muted-foreground bg-secondary px-2 py-1 rounded">
          2026 Season
        </span>
      </div>

      {/* Summary Cards Row */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          <SummaryCard label="Outings" value={summary.totalOutings.toString()} icon={<Calendar className="w-4 h-4" />} />
          <SummaryCard label="Total Pitches" value={summary.totalPitches.toString()} icon={<Activity className="w-4 h-4" />} />
          <SummaryCard label="Strike %" value={`${summary.strikePercent.toFixed(1)}%`} icon={<Target className="w-4 h-4" />} />
          <SummaryCard label="Max Velo" value={summary.maxVelo > 0 ? `${summary.maxVelo}` : '-'} icon={<Gauge className="w-4 h-4" />} />
          <SummaryCard label="Avg Velo" value={summary.avgVelo > 0 ? `${summary.avgVelo.toFixed(1)}` : '-'} icon={<Gauge className="w-4 h-4" />} />
          <SummaryCard label="Total Strikes" value={summary.totalStrikes.toString()} icon={<Trophy className="w-4 h-4" />} />
        </div>
      )}

      {/* Improvement Indicators */}
      {improvements && (
        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="font-display text-lg flex items-center gap-2">
              <Award className="w-5 h-5 text-primary" />
              Season Progress
            </CardTitle>
            <p className="text-xs text-muted-foreground">Comparing first half vs second half of season</p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <ImprovementCard
                label="Avg Velocity"
                first={improvements.velocity.first}
                second={improvements.velocity.second}
                formatter={(v) => `${v.toFixed(1)} mph`}
                higherIsBetter
              />
              <ImprovementCard
                label="Strike %"
                first={improvements.strikePercent.first}
                second={improvements.strikePercent.second}
                formatter={(v) => `${v.toFixed(1)}%`}
                higherIsBetter
              />
              <ImprovementCard
                label="Avg Pitches/Outing"
                first={improvements.pitchCount.first}
                second={improvements.pitchCount.second}
                formatter={(v) => `${v.toFixed(0)}`}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Season Trends Chart (existing) */}
      <SeasonTrendsChart outings={outings} />

      {/* Monthly Breakdown */}
      {summary && summary.monthlyBreakdown.length > 1 && (
        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="font-display text-lg">Monthly Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={summary.monthlyBreakdown} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    tickLine={{ stroke: 'hsl(var(--border))' }}
                    axisLine={{ stroke: 'hsl(var(--border))' }}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    tickLine={{ stroke: 'hsl(var(--border))' }}
                    axisLine={{ stroke: 'hsl(var(--border))' }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      color: 'hsl(var(--foreground))',
                    }}
                    formatter={(value: number, name: string) => {
                      const labels: Record<string, string> = {
                        pitches: 'Total Pitches',
                        outings: 'Outings',
                        strikePercent: 'Strike %',
                      };
                      return [name === 'strikePercent' ? `${value}%` : value, labels[name] || name];
                    }}
                  />
                  <Bar dataKey="pitches" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            {/* Monthly stats table */}
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-muted-foreground border-b border-border/30">
                    <th className="text-left py-2 font-medium">Month</th>
                    <th className="text-center py-2 font-medium">Outings</th>
                    <th className="text-center py-2 font-medium">Pitches</th>
                    <th className="text-center py-2 font-medium">Strike %</th>
                    <th className="text-center py-2 font-medium">Max Velo</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.monthlyBreakdown.map((m) => (
                    <tr key={m.month} className="border-b border-border/20">
                      <td className="py-2 font-medium text-foreground">{m.month}</td>
                      <td className="text-center text-foreground">{m.outings}</td>
                      <td className="text-center text-foreground">{m.pitches}</td>
                      <td className="text-center text-foreground">{m.strikePercent > 0 ? `${m.strikePercent}%` : '-'}</td>
                      <td className="text-center text-foreground">{m.maxVelo > 0 ? m.maxVelo : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Event Type Distribution */}
      {summary && (
        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="font-display text-lg">Outing Types</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={Object.entries(summary.eventCounts).map(([name, value]) => ({ name, value }))}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={70}
                    label={({ name, value }) => `${name}: ${value}`}
                    labelLine={{ stroke: 'hsl(var(--muted-foreground))' }}
                  >
                    {Object.entries(summary.eventCounts).map(([name], index) => {
                      const colors = ['hsl(var(--primary))', 'hsl(38, 92%, 50%)', 'hsl(142, 50%, 40%)', 'hsl(280, 70%, 55%)'];
                      return <Cell key={name} fill={colors[index % colors.length]} />;
                    })}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      color: 'hsl(var(--foreground))',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Milestones Timeline */}
      {milestones.length > 0 && (
        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="font-display text-lg flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-500" />
              Season Milestones
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {milestones.map((m, i) => {
                const [year, month, day] = m.date.split('-').map(Number);
                const date = new Date(year, month - 1, day, 12, 0, 0, 0);
                const dateLabel = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                return (
                  <div key={i} className="flex items-center gap-3 text-sm">
                    <span className="text-xs text-muted-foreground w-16 shrink-0">{dateLabel}</span>
                    <div
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        m.type === 'positive'
                          ? 'bg-[hsl(142,70%,45%)]'
                          : m.type === 'negative'
                          ? 'bg-[hsl(0,72%,55%)]'
                          : 'bg-muted-foreground'
                      }`}
                    />
                    <span className="text-foreground">{m.label}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Outing-by-Outing Table */}
      <Card className="glass-card">
        <CardHeader className="pb-2">
          <CardTitle className="font-display text-lg">Outing-by-Outing</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-muted-foreground border-b border-border/30">
                  <th className="text-left py-2 font-medium">Date</th>
                  <th className="text-left py-2 font-medium">Type</th>
                  <th className="text-center py-2 font-medium">Pitches</th>
                  <th className="text-center py-2 font-medium">Strikes</th>
                  <th className="text-center py-2 font-medium">Strike %</th>
                  <th className="text-center py-2 font-medium">Max Velo</th>
                  <th className="text-left py-2 font-medium">Notes</th>
                </tr>
              </thead>
              <tbody>
                {outingTableData.map((o) => {
                  const [year, month, day] = o.date.split('-').map(Number);
                  const date = new Date(year, month - 1, day, 12, 0, 0, 0);
                  const dateLabel = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                  const strikePct =
                    o.strikes !== null && o.pitchCount > 0
                      ? `${((o.strikes / o.pitchCount) * 100).toFixed(0)}%`
                      : '-';
                  return (
                    <tr key={o.id} className="border-b border-border/20 hover:bg-secondary/30">
                      <td className="py-2 text-foreground font-medium">{dateLabel}</td>
                      <td className="py-2">
                        <span className="px-1.5 py-0.5 rounded bg-secondary text-foreground text-[10px]">
                          {o.eventType}
                        </span>
                      </td>
                      <td className="text-center text-foreground">{o.pitchCount}</td>
                      <td className="text-center text-foreground">{o.strikes ?? '-'}</td>
                      <td className="text-center text-foreground">{strikePct}</td>
                      <td className="text-center text-foreground">{o.maxVelo > 0 ? o.maxVelo : '-'}</td>
                      <td className="py-2 text-muted-foreground max-w-[120px] truncate">{o.notes || o.focus || '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {seasonOutings.length > 10 && (
            <button
              onClick={() => setShowAllOutings(!showAllOutings)}
              className="mt-3 flex items-center gap-1 text-xs text-primary hover:underline mx-auto"
            >
              {showAllOutings ? (
                <>
                  <ChevronUp className="w-3 h-3" /> Show less
                </>
              ) : (
                <>
                  <ChevronDown className="w-3 h-3" /> Show all {seasonOutings.length} outings
                </>
              )}
            </button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Helper components

function SummaryCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <Card className="glass-card">
      <CardContent className="p-3 flex items-center gap-2">
        <div className="p-1.5 rounded-md bg-primary/10 text-primary shrink-0">{icon}</div>
        <div className="min-w-0">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider truncate">{label}</p>
          <p className="text-lg font-bold text-foreground leading-tight">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function ImprovementCard({
  label,
  first,
  second,
  formatter,
  higherIsBetter = false,
}: {
  label: string;
  first: number;
  second: number;
  formatter: (v: number) => string;
  higherIsBetter?: boolean;
}) {
  const diff = second - first;
  const isImproved = higherIsBetter ? diff > 0 : diff < 0;
  const isDeclined = higherIsBetter ? diff < 0 : diff > 0;
  const isStable = Math.abs(diff) < 0.5;

  return (
    <div className="text-center space-y-1">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
      <div className="flex items-center justify-center gap-1">
        {isStable ? (
          <Minus className="w-3.5 h-3.5 text-muted-foreground" />
        ) : isImproved ? (
          <TrendingUp className="w-3.5 h-3.5 text-[hsl(142,70%,45%)]" />
        ) : (
          <TrendingDown className="w-3.5 h-3.5 text-[hsl(0,72%,55%)]" />
        )}
        <span
          className={`text-sm font-bold ${
            isStable
              ? 'text-muted-foreground'
              : isImproved
              ? 'text-[hsl(142,70%,45%)]'
              : 'text-[hsl(0,72%,55%)]'
          }`}
        >
          {formatter(second)}
        </span>
      </div>
      <p className="text-[10px] text-muted-foreground">
        was {formatter(first)}
      </p>
    </div>
  );
}
