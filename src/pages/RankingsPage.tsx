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
import { ArrowLeft, Trophy, Upload, Info, Minus, Equal, Plus, Eye, ChevronDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { usePitchers, type CoachRating, type PitcherRecord } from '@/hooks/use-pitchers';
import { useAllStatSnapshots } from '@/hooks/use-stat-snapshots';
import { QuadrantChart } from '@/components/rankings/QuadrantChart';
import { TierList } from '@/components/rankings/TierList';
import { RadarOverlay } from '@/components/rankings/RadarOverlay';
import { WeightingChart } from '@/components/rankings/WeightingChart';
import {
  buildRankings,
  METRIC_LABELS,
  type PlayerRanking,
  type ReefMode,
  type RankingFilter,
  type RankingInput,
} from '@/lib/team-rankings';
import { cn } from '@/lib/utils';

const MIN_PA = 10; // hard sample-size floor; documented in the UI
const MIN_IP_FLOOR = 5; // pitching-participation floor; matches DEFAULT_PITCHING_PARTICIPATION_FLOOR

type RatingDimension = 'effort' | 'coachability' | 'baseball_iq';
type ChartView = 'bar' | 'quadrant' | 'tier' | 'radar';

export default function RankingsPage() {
  const { pitchers, isLoading: pitchersLoading, setCoachRating } = usePitchers();
  const pitcherIds = useMemo(() => pitchers.map((p) => p.id), [pitchers]);
  const { byPitcher, isLoading: snapshotsLoading, mostRecentUploadedAt } = useAllStatSnapshots(pitcherIds);

  const [reefMode, setReefMode] = useState<ReefMode>('25');
  const [filter, setFilter] = useState<RankingFilter>('all');
  const [chartView, setChartView] = useState<ChartView>('bar');

  const inputs = useMemo<RankingInput[]>(() => {
    return pitchers.map((p) => ({
      pitcherId: p.id,
      pitcherName: p.name,
      latest: byPitcher.get(p.id)?.[0]?.stats ?? null,
      effortRating: p.effortRating,
      coachabilityRating: p.coachabilityRating,
      baseballIqRating: p.baseballIqRating,
    }));
  }, [pitchers, byPitcher]);

  const { rankings, excluded, reefThreshold, reefPercentile } = useMemo(
    () =>
      buildRankings(inputs, {
        reefMode,
        minPlateAppearances: MIN_PA,
        filter,
      }),
    [inputs, reefMode, filter],
  );

  const chartData = useMemo(() => {
    return rankings.map((r) => ({
      name: r.pitcherName,
      pv: Number(r.playerValue.toFixed(1)),
      belowReef: r.belowReef,
    }));
  }, [rankings]);

  const isLoading = pitchersLoading || snapshotsLoading;
  const hasAnyData = rankings.length > 0 || excluded.length > 0;

  const pitcherById = useMemo(() => {
    const m = new Map<string, PitcherRecord>();
    for (const p of pitchers) m.set(p.id, p);
    return m;
  }, [pitchers]);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-3 sm:px-4 py-6 max-w-5xl space-y-6">
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
            {/* Toolbar — compact single-row controls */}
            <Card className="glass-card">
              <CardContent className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground shrink-0">View</span>
                  <Tabs value={filter} onValueChange={(v) => setFilter(v as RankingFilter)}>
                    <TabsList className="h-8">
                      <TabsTrigger value="all" className="text-xs px-2.5">All</TabsTrigger>
                      <TabsTrigger value="hitters" className="text-xs px-2.5">Hitters</TabsTrigger>
                      <TabsTrigger value="pitchers" className="text-xs px-2.5">Pitchers</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>

                <div className="hidden sm:block h-6 w-px bg-border/60" />

                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground shrink-0">Reef</span>
                  <Tabs value={reefMode} onValueChange={(value) => setReefMode(value as ReefMode)}>
                    <TabsList className="h-8">
                      <TabsTrigger value="15" className="text-xs px-2.5">B15%</TabsTrigger>
                      <TabsTrigger value="25" className="text-xs px-2.5">B25%</TabsTrigger>
                      <TabsTrigger value="50" className="text-xs px-2.5">Median</TabsTrigger>
                    </TabsList>
                  </Tabs>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="About these controls">
                        <Info className="w-3.5 h-3.5 text-muted-foreground" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-72 text-xs space-y-2" align="start">
                      <div>
                        <p className="font-semibold text-foreground mb-1">Reef line</p>
                        <p className="text-muted-foreground">Replacement threshold. Players below the line are candidates to develop or sub.</p>
                      </div>
                      <div>
                        <p className="font-semibold text-foreground mb-1">Pitching participation</p>
                        <p className="text-muted-foreground">Defense score is scaled by IP up to {MIN_IP_FLOOR} innings. Kids who barely pitch are damped so they can't lean on FPCT alone.</p>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              </CardContent>
            </Card>

            {/* Chart — switchable across four views */}
            <Card className="glass-card">
              <CardHeader className="pb-2">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <CardTitle className="font-display text-lg flex items-center gap-2">
                    Player Value
                    <span className="text-xs text-muted-foreground font-normal">
                      Reef {reefThreshold.toFixed(1)} · p{reefPercentile}
                    </span>
                  </CardTitle>
                  <Tabs value={chartView} onValueChange={(v) => setChartView(v as ChartView)}>
                    <TabsList className="h-8">
                      <TabsTrigger value="bar" className="text-xs px-2.5">Bar</TabsTrigger>
                      <TabsTrigger value="quadrant" className="text-xs px-2.5">Quadrant</TabsTrigger>
                      <TabsTrigger value="tier" className="text-xs px-2.5">Tier</TabsTrigger>
                      <TabsTrigger value="radar" className="text-xs px-2.5">Radar</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
              </CardHeader>
              <CardContent className="px-2 sm:px-6">
                {chartView === 'bar' && (
                  <div
                    className="w-full"
                    style={{ height: Math.max(380, rankings.length * 44 + 80) }}
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={chartData}
                        layout="vertical"
                        margin={{ top: 8, right: 24, left: 0, bottom: 8 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-border/40" />
                        <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12 }} />
                        <YAxis
                          dataKey="name"
                          type="category"
                          width={96}
                          tick={{ fontSize: 12 }}
                          interval={0}
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
                )}
                {chartView === 'quadrant' && <QuadrantChart rankings={rankings} />}
                {chartView === 'tier' && <TierList rankings={rankings} />}
                {chartView === 'radar' && <RadarOverlay rankings={rankings} />}
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
                  Click <Eye className="inline w-3 h-3" /> to see the top drivers for a player.
                </p>
              </CardHeader>
              <CardContent className="overflow-x-auto px-0">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/40 hover:bg-transparent">
                      <TableHead className="sticky left-0 bg-background z-10 text-[10px] uppercase tracking-wider">Player</TableHead>
                      <TableHead className="text-center w-10 text-[10px] uppercase tracking-wider">Why</TableHead>
                      <TableHead className="text-right text-[10px] uppercase tracking-wider text-foreground">PV</TableHead>
                      <TableHead className="text-right text-[10px] uppercase tracking-wider">Off</TableHead>
                      <TableHead className="text-right text-[10px] uppercase tracking-wider">Def</TableHead>
                      <TableHead className="text-right text-[10px] uppercase tracking-wider">Eff</TableHead>
                      <TableHead className="text-right text-[10px] uppercase tracking-wider">Coach</TableHead>
                      <TableHead className="text-right text-[10px] uppercase tracking-wider">BB IQ</TableHead>
                      {METRIC_LABELS.filter((m) => m.bucket !== 'intangibles').map((m) => (
                        <TableHead key={m.key} className="text-right text-[10px] uppercase tracking-wider">
                          {m.label}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rankings.map((r) => (
                      <RankingRow
                        key={r.pitcherId}
                        ranking={r}
                        pitcher={pitcherById.get(r.pitcherId)}
                        onSetRating={setCoachRating}
                      />
                    ))}
                  </TableBody>
                </Table>

                {excluded.length > 0 && (
                  <div className="px-4 pt-6 pb-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                      Below sample-size floor ({MIN_PA} PA)
                    </p>
                    <p className="text-xs text-muted-foreground mb-2">
                      These players don't have enough plate appearances to be ranked fairly. They appear
                      separately so a small sample doesn't out-rank a regular.
                    </p>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      {excluded.map((r) => (
                        <li key={r.pitcherId}>
                          {r.pitcherName}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Legend — collapsible to keep the page lean */}
            <Card className="glass-card">
              <details className="group">
                <summary className="flex items-center justify-between cursor-pointer list-none p-4 hover:bg-secondary/20 transition-colors rounded-lg">
                  <div className="flex items-center gap-2">
                    <Info className="w-4 h-4 text-muted-foreground" />
                    <span className="font-display text-base text-foreground">Legend</span>
                    <span className="text-xs text-muted-foreground">— what each column means</span>
                  </div>
                  <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform group-open:rotate-180" />
                </summary>
                <div className="px-4 pb-4 space-y-4 text-sm">
                  <LegendBlock title="Composite scores" rows={[
                    { label: 'PV', description: "Player Value — weighted composite (0–100)" },
                    { label: 'Off', description: 'Offense score (0–100), team-relative' },
                    { label: 'Def', description: 'Defense score (0–100), team-relative' },
                    { label: 'Why', description: 'Top 3 metric drivers for this player' },
                  ]} />
                  <LegendBlock title="Offense" rows={legendRows('offense')} />
                  <LegendBlock title="Defense" rows={legendRows('defense')} />
                  <LegendBlock title="Intangibles (coach ratings)" rows={[
                    { label: 'Eff', description: 'Effort — minus / even / plus' },
                    { label: 'Coach', description: 'Coachability — takes instruction, applies feedback' },
                    { label: 'BB IQ', description: 'Baseball IQ — situational awareness, decisions' },
                  ]} />
                </div>
              </details>
            </Card>

            {/* Weighting reference — auditable view of what drives PV */}
            <WeightingChart />
          </>
        )}
      </div>
    </div>
  );
}

function legendRows(bucket: 'offense' | 'defense') {
  return METRIC_LABELS.filter((m) => m.bucket === bucket).map((m) => ({
    label: m.label,
    description: m.description,
  }));
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

function RankingRow({
  ranking,
  pitcher,
  onSetRating,
}: {
  ranking: PlayerRanking;
  pitcher: PitcherRecord | undefined;
  onSetRating: (id: string, dim: RatingDimension, rating: CoachRating) => Promise<boolean>;
}) {
  const visibleMetrics = METRIC_LABELS.filter((m) => m.bucket !== 'intangibles');
  return (
    <TableRow className={cn('border-border/30 hover:bg-primary/5 transition-colors', ranking.belowReef && 'opacity-60')}>
      <TableCell className="sticky left-0 bg-background z-10 font-medium">
        {ranking.pitcherName}
        {ranking.belowReef && <span className="ml-2 text-[10px] text-destructive">below reef</span>}
        {ranking.belowParticipationFloor && (
          <span
            className="ml-2 text-[10px] text-amber-600 dark:text-amber-400"
            title={`${ranking.inningsPitched.toFixed(1)} IP — defense damped to ${(ranking.participationFactor * 100).toFixed(0)}%`}
          >
            limited pitching
          </span>
        )}
      </TableCell>
      <TableCell className="text-center">
        <WhyPopover ranking={ranking} />
      </TableCell>
      <TableCell className="text-right font-semibold text-foreground tabular-nums">{ranking.playerValue.toFixed(1)}</TableCell>
      <TableCell className="text-right tabular-nums">{ranking.offenseScore?.toFixed(1) ?? '—'}</TableCell>
      <TableCell className="text-right tabular-nums">{ranking.defenseScore?.toFixed(1) ?? '—'}</TableCell>
      <TableCell className="text-right">
        <RatingControl
          rating={pitcher?.effortRating ?? null}
          onChange={(r) => pitcher && onSetRating(pitcher.id, 'effort', r)}
          disabled={!pitcher}
        />
      </TableCell>
      <TableCell className="text-right">
        <RatingControl
          rating={pitcher?.coachabilityRating ?? null}
          onChange={(r) => pitcher && onSetRating(pitcher.id, 'coachability', r)}
          disabled={!pitcher}
        />
      </TableCell>
      <TableCell className="text-right">
        <RatingControl
          rating={pitcher?.baseballIqRating ?? null}
          onChange={(r) => pitcher && onSetRating(pitcher.id, 'baseball_iq', r)}
          disabled={!pitcher}
        />
      </TableCell>
      {visibleMetrics.map((m) => {
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

function WhyPopover({ ranking }: { ranking: PlayerRanking }) {
  if (ranking.topDrivers.length === 0) return <span className="text-muted-foreground text-xs">—</span>;
  // Friendly framing — use first name if there is one, otherwise the full name.
  const firstName = ranking.pitcherName.split(' ')[0] ?? ranking.pitcherName;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Why ranked here?">
          <Eye className="w-3.5 h-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          What's driving {firstName}'s rank
        </p>
        <ul className="space-y-3">
          {ranking.topDrivers.map((d) => {
            // Tier the framing by how high the player ranks on this metric
            // within the team — "excels" only when they're clearly above average.
            const verb =
              d.score >= 75 ? 'excels at' :
              d.score >= 55 ? 'is solid at' :
              'leans on';
            return (
              <li key={d.key} className="space-y-0.5">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-semibold text-foreground">{d.label}</span>
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                    rank {d.score.toFixed(0)} · w{d.weight.toFixed(2)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground leading-snug">
                  {firstName} {verb} {d.narration}.
                </p>
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

function RatingControl({
  rating,
  onChange,
  disabled,
}: {
  rating: CoachRating;
  onChange: (next: CoachRating) => void;
  disabled?: boolean;
}) {
  const display =
    rating === 'plus' ? <Plus className="w-3.5 h-3.5" /> :
    rating === 'minus' ? <Minus className="w-3.5 h-3.5" /> :
    rating === 'even' ? <Equal className="w-3.5 h-3.5" /> :
    <span className="text-muted-foreground text-xs">—</span>;

  const color =
    rating === 'plus' ? 'text-emerald-600 dark:text-emerald-400' :
    rating === 'minus' ? 'text-red-600 dark:text-red-400' :
    'text-foreground';

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn('h-7 w-7', color)}
          disabled={disabled}
          aria-label="Set rating"
        >
          {display}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2" align="end">
        <div className="flex gap-1">
          <Button
            variant={rating === 'minus' ? 'destructive' : 'ghost'}
            size="icon"
            className="h-8 w-8"
            onClick={() => onChange('minus')}
            aria-label="Minus"
          >
            <Minus className="w-4 h-4" />
          </Button>
          <Button
            variant={rating === 'even' ? 'secondary' : 'ghost'}
            size="icon"
            className="h-8 w-8"
            onClick={() => onChange('even')}
            aria-label="Even"
          >
            <Equal className="w-4 h-4" />
          </Button>
          <Button
            variant={rating === 'plus' ? 'default' : 'ghost'}
            size="icon"
            className="h-8 w-8"
            onClick={() => onChange('plus')}
            aria-label="Plus"
          >
            <Plus className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-2 text-xs"
            onClick={() => onChange(null)}
            aria-label="Clear rating"
          >
            Clear
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
