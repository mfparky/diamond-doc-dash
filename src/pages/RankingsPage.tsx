import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from 'recharts';
import { ArrowLeft, Trophy, Upload, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { usePitchers } from '@/hooks/use-pitchers';
import { useAllStatSnapshots } from '@/hooks/use-stat-snapshots';
import {
  buildRankings,
  METRIC_LABELS,
  type PlayerRanking,
  type ReefMode,
  type RankingInput,
} from '@/lib/team-rankings';
import { cn } from '@/lib/utils';

type ReefChoice = ReefMode;

export default function RankingsPage() {
  const { pitchers, isLoading: pitchersLoading } = usePitchers();
  const pitcherIds = useMemo(() => pitchers.map((p) => p.id), [pitchers]);
  const { byPitcher, isLoading: snapshotsLoading, mostRecentUploadedAt } = useAllStatSnapshots(pitcherIds);

  const [includePitchingVolume, setIncludePitchingVolume] = useState(false);
  const [reefMode, setReefMode] = useState<ReefChoice>('25');

  const inputs = useMemo<RankingInput[]>(() => {
    return pitchers.map((p) => ({
      pitcherId: p.id,
      pitcherName: p.name,
      latest: byPitcher.get(p.id)?.[0]?.stats ?? null,
    }));
  }, [pitchers, byPitcher]);

  const { rankings, reefThreshold, reefPercentile } = useMemo(
    () => buildRankings(inputs, { includePitchingVolume, reefMode }),
    [inputs, includePitchingVolume, reefMode],
  );

  const chartData = useMemo(() => {
    return rankings.map((r) => ({
      name: r.pitcherName,
      offense: r.offenseScore !== null ? Number(r.offenseScore.toFixed(1)) : 0,
      defense: r.defenseScore !== null ? Number(r.defenseScore.toFixed(1)) : 0,
      pv: Number(r.playerValue.toFixed(1)),
      belowReef: r.belowReef,
    }));
  }, [rankings]);

  const isLoading = pitchersLoading || snapshotsLoading;
  const hasAnyData = rankings.some((r) => r.hasOffense || r.hasDefense);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6 max-w-5xl space-y-6">
        {/* Header */}
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/" aria-label="Back to dashboard">
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </Button>
          <div className="flex-1">
            <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
              <Trophy className="w-6 h-6 text-amber-500" />
              Player Rankings
            </h1>
            <p className="text-sm text-muted-foreground">
              Composite Player Value drawn from each player's most recent stat snapshot.
              {mostRecentUploadedAt && ` Last upload: ${new Date(mostRecentUploadedAt).toLocaleDateString()}.`}
            </p>
          </div>
        </div>

        {isLoading && (
          <Card className="glass-card">
            <CardContent className="p-6 text-sm text-muted-foreground">Loading rankings…</CardContent>
          </Card>
        )}

        {!isLoading && !hasAnyData && (
          <Card className="glass-card">
            <CardContent className="p-6 space-y-3">
              <p className="text-sm text-muted-foreground">
                No season stats have been uploaded yet. Upload a GameChanger CSV to power
                rankings.
              </p>
              <Button asChild size="sm">
                <Link to="/">
                  <Upload className="w-4 h-4 mr-2" />
                  Back to dashboard
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {!isLoading && hasAnyData && (
          <>
            {/* Controls */}
            <Card className="glass-card">
              <CardContent className="p-4 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">Reef line (replacement threshold)</p>
                    <p className="text-xs text-muted-foreground">Players below the line are candidates to develop or sub.</p>
                  </div>
                  <Tabs
                    value={reefMode}
                    onValueChange={(value) => setReefMode(value as ReefChoice)}
                  >
                    <TabsList>
                      <TabsTrigger value="15">Bottom 15%</TabsTrigger>
                      <TabsTrigger value="25">Bottom 25%</TabsTrigger>
                      <TabsTrigger value="50">Median</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
                <div className="flex items-start justify-between gap-4 pt-2 border-t border-border/40">
                  <div className="flex-1">
                    <Label htmlFor="pitching-volume" className="text-sm font-medium">
                      Weight pitching volume
                    </Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Adds a 15% bonus for innings-eaters. Turn off for a pure skills view
                      (12U dominance doesn't always translate forward).
                    </p>
                  </div>
                  <Switch
                    id="pitching-volume"
                    checked={includePitchingVolume}
                    onCheckedChange={setIncludePitchingVolume}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Chart */}
            <Card className="glass-card">
              <CardHeader className="pb-2">
                <CardTitle className="font-display text-lg flex items-center gap-2">
                  Player Value
                  <span className="text-xs text-muted-foreground font-normal">
                    Reef at {reefThreshold.toFixed(1)} ({reefPercentile}th percentile)
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="w-full" style={{ height: Math.max(320, rankings.length * 32 + 80) }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={chartData}
                      layout="vertical"
                      margin={{ top: 8, right: 24, left: 8, bottom: 8 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-border/40" />
                      <XAxis type="number" domain={[0, 100]} className="text-xs" />
                      <YAxis
                        dataKey="name"
                        type="category"
                        width={120}
                        className="text-xs"
                      />
                      <Tooltip
                        formatter={(value: number, name: string) => [`${value.toFixed(1)}`, name]}
                        labelFormatter={(label) => label}
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: 6,
                          fontSize: 12,
                        }}
                      />
                      <ReferenceLine
                        x={reefThreshold}
                        stroke="hsl(var(--destructive))"
                        strokeDasharray="6 3"
                        label={{ value: 'Reef', position: 'top', fill: 'hsl(var(--destructive))', fontSize: 11 }}
                      />
                      <Bar dataKey="pv" name="Player Value" radius={[0, 4, 4, 0]}>
                        {chartData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={entry.belowReef ? 'hsl(var(--muted-foreground))' : 'hsl(var(--primary))'}
                            fillOpacity={entry.belowReef ? 0.45 : 1}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Detail breakdown */}
            <Card className="glass-card">
              <CardHeader className="pb-2">
                <CardTitle className="font-display text-lg flex items-center gap-2">
                  Breakdown
                  <Info className="w-3.5 h-3.5 text-muted-foreground" />
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Each column is the player's 0–100 rank within the team for that metric.
                  Empty cells mean no data for that metric.
                </p>
              </CardHeader>
              <CardContent className="overflow-x-auto px-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky left-0 bg-background z-10">Player</TableHead>
                      <TableHead className="text-right">PV</TableHead>
                      <TableHead className="text-right">Off</TableHead>
                      <TableHead className="text-right">Def</TableHead>
                      {METRIC_LABELS.map((m) => (
                        <TableHead key={m.key} className="text-right text-[10px] uppercase tracking-wider">
                          {m.label}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rankings.map((r) => (
                      <RankingRow key={r.pitcherId} ranking={r} />
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Legend */}
            <Card className="glass-card">
              <CardHeader className="pb-2">
                <CardTitle className="font-display text-base">Legend</CardTitle>
                <p className="text-xs text-muted-foreground">
                  What each column represents.
                </p>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <LegendBlock title="Composite scores" rows={[
                  { label: 'PV', description: "Player Value — weighted composite of Off + Def (0–100)" },
                  { label: 'Off', description: 'Offense score (0–100), team-relative' },
                  { label: 'Def', description: 'Defense score (0–100), team-relative' },
                ]} />
                <LegendBlock
                  title="Offense"
                  rows={METRIC_LABELS.filter((m) => m.bucket === 'offense').map((m) => ({
                    label: m.label,
                    description: m.description,
                  }))}
                />
                <LegendBlock
                  title="Defense"
                  rows={METRIC_LABELS.filter((m) => m.bucket === 'defense').map((m) => ({
                    label: m.label,
                    description: m.description,
                  }))}
                />
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}

function LegendBlock({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ label: string; description: string }>;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
        {title}
      </p>
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
        {rows.map((row) => (
          <div key={row.label} className="flex items-baseline gap-2">
            <dt className="font-mono text-xs font-semibold text-foreground shrink-0 w-12">
              {row.label}
            </dt>
            <dd className="text-xs text-muted-foreground">{row.description}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function RankingRow({ ranking }: { ranking: PlayerRanking }) {
  return (
    <TableRow className={cn(ranking.belowReef && 'opacity-60')}>
      <TableCell className="sticky left-0 bg-background z-10 font-medium">
        {ranking.pitcherName}
        {ranking.belowReef && <span className="ml-2 text-[10px] text-destructive">below reef</span>}
      </TableCell>
      <TableCell className="text-right font-semibold">{ranking.playerValue.toFixed(1)}</TableCell>
      <TableCell className="text-right">{ranking.offenseScore?.toFixed(1) ?? '—'}</TableCell>
      <TableCell className="text-right">{ranking.defenseScore?.toFixed(1) ?? '—'}</TableCell>
      {METRIC_LABELS.map((m) => {
        const value = ranking.metricBreakdown[m.key];
        return (
          <TableCell key={m.key} className="text-right text-xs text-muted-foreground">
            {value === null || value === undefined ? '—' : value.toFixed(0)}
          </TableCell>
        );
      })}
    </TableRow>
  );
}
