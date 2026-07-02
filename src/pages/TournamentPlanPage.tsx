import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Save, CheckCircle2, AlertTriangle, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { usePitchers } from '@/hooks/use-pitchers';
import {
  useTournamentPlan,
  entryKey,
  type PitchCell,
  type PitchEntries,
} from '@/hooks/use-tournament-plan';
import {
  COOPERSTOWN_2025,
  COOPERSTOWN_TOURNAMENT_NAME,
  COOPERSTOWN_TOURNAMENT_SLUG,
  dayLabel,
  type TournamentGameSlot,
} from '@/lib/cooperstown-schedule';
import {
  isEligibleForGame,
  summarizeByDay,
  getTier,
  DAILY_MAX,
  type PitchEntry,
} from '@/lib/tournament-pitch-rules';

/**
 * Effective pitch count for a cell — `actual` supersedes `planned` once logged,
 * so eligibility math tracks reality as games run.
 */
function effectivePitches(cell: PitchCell | undefined): number {
  if (!cell) return 0;
  if (typeof cell.actual === 'number') return cell.actual;
  if (typeof cell.planned === 'number') return cell.planned;
  return 0;
}

function pitcherEntries(entries: PitchEntries, pitcherId: string, schedule: TournamentGameSlot[]): PitchEntry[] {
  return schedule.map((slot) => ({
    day: slot.dayIndex,
    gameIndex: slot.gameIndex,
    pitches: effectivePitches(entries[entryKey(pitcherId, slot.id)]),
  }));
}

export default function TournamentPlanPage() {
  const { pitchers, isLoading: pitchersLoading } = usePitchers();
  const { plan, isLoading: planLoading, save } = useTournamentPlan(
    COOPERSTOWN_TOURNAMENT_SLUG,
    COOPERSTOWN_TOURNAMENT_NAME,
    COOPERSTOWN_2025,
  );

  const [schedule, setSchedule] = useState<TournamentGameSlot[]>(COOPERSTOWN_2025);
  const [entries, setEntries] = useState<PitchEntries>({});
  const [notes, setNotes] = useState('');
  const [savedFlash, setSavedFlash] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!plan) return;
    setSchedule(plan.schedule.length > 0 ? plan.schedule : COOPERSTOWN_2025);
    setEntries(plan.entries);
    setNotes(plan.notes);
    setDirty(false);
  }, [plan]);

  const scheduleByDay = useMemo(() => {
    const map = new Map<number, TournamentGameSlot[]>();
    for (const slot of schedule) {
      const list = map.get(slot.dayIndex) ?? [];
      list.push(slot);
      map.set(slot.dayIndex, list);
    }
    return map;
  }, [schedule]);

  const dayIndices = useMemo(() => [...scheduleByDay.keys()].sort((a, b) => a - b), [scheduleByDay]);

  const handleCellChange = (pitcherId: string, slotId: string, field: 'planned' | 'actual', raw: string) => {
    const parsed = raw === '' ? null : Math.max(0, Math.min(DAILY_MAX, Math.trunc(Number(raw))));
    if (raw !== '' && !Number.isFinite(parsed)) return;
    setEntries((prev) => {
      const key = entryKey(pitcherId, slotId);
      const existing: PitchCell = prev[key] ?? { planned: null, actual: null };
      const next: PitchCell = { ...existing, [field]: parsed };
      const out = { ...prev };
      if (next.planned === null && next.actual === null) {
        delete out[key];
      } else {
        out[key] = next;
      }
      return out;
    });
    setDirty(true);
  };

  const handleSlotChange = (slotId: string, field: 'time' | 'opponent' | 'code' | 'date', value: string) => {
    setSchedule((prev) => prev.map((s) => (s.id === slotId ? { ...s, [field]: value } : s)));
    setDirty(true);
  };

  const handleSave = async () => {
    const ok = await save({ schedule, entries, notes });
    if (ok) {
      setSavedFlash(true);
      setDirty(false);
      window.setTimeout(() => setSavedFlash(false), 1800);
    }
  };

  const isLoading = pitchersLoading || planLoading;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-3 sm:px-4 py-6 max-w-[1600px] space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/" aria-label="Back to dashboard">
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="font-display text-2xl font-bold text-foreground">{COOPERSTOWN_TOURNAMENT_NAME}</h1>
            <p className="text-sm text-muted-foreground">
              Plan pitch counts across the tournament. OBA 12U/13U rest rules are enforced automatically.
            </p>
          </div>
          <Button onClick={handleSave} disabled={!dirty && !savedFlash}>
            {savedFlash ? <CheckCircle2 className="w-4 h-4 mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            {savedFlash ? 'Saved' : 'Save plan'}
          </Button>
        </div>

        {/* Rules legend — collapsed by default, useful reference. */}
        <RulesLegend />

        {/* Schedule editor — bracket time / opponent / date are all editable. */}
        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="font-display text-base">Schedule</CardTitle>
            <p className="text-xs text-muted-foreground">
              Bracket game details fill in once the bracket is set. Times / opponents are editable so you can update once games shift.
            </p>
          </CardHeader>
          <CardContent className="space-y-2">
            {schedule.map((slot) => (
              <div key={slot.id} className="grid grid-cols-1 sm:grid-cols-[80px_120px_120px_1fr_2fr] gap-2 items-center text-sm">
                <span className="font-semibold text-muted-foreground uppercase tracking-wider text-xs">
                  {dayLabel(slot.dayIndex)}
                </span>
                <Input
                  type="date"
                  value={slot.date}
                  onChange={(e) => handleSlotChange(slot.id, 'date', e.target.value)}
                  className="h-8"
                />
                <Input
                  value={slot.time}
                  onChange={(e) => handleSlotChange(slot.id, 'time', e.target.value)}
                  className="h-8"
                  placeholder="Time"
                />
                <Input
                  value={slot.code}
                  onChange={(e) => handleSlotChange(slot.id, 'code', e.target.value)}
                  className="h-8"
                  placeholder="Code"
                />
                <Input
                  value={slot.opponent}
                  onChange={(e) => handleSlotChange(slot.id, 'opponent', e.target.value)}
                  className="h-8"
                  placeholder="Opponent"
                />
              </div>
            ))}
          </CardContent>
        </Card>

        {isLoading && (
          <Card className="glass-card">
            <CardContent className="p-6 text-sm text-muted-foreground">Loading…</CardContent>
          </Card>
        )}

        {!isLoading && (
          <Card className="glass-card overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="font-display text-base">Pitcher × Game Grid</CardTitle>
              <p className="text-xs text-muted-foreground">
                Two rows per cell: <strong>P</strong> planned, <strong>A</strong> actual. Actuals override planned for eligibility math. Badge shows availability for that game slot.
              </p>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full border-collapse text-sm min-w-[900px]">
                <thead className="bg-muted/40 sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-2 border-b border-border/60 font-semibold min-w-[140px]">
                      Pitcher
                    </th>
                    {dayIndices.map((dayIdx) => {
                      const slots = scheduleByDay.get(dayIdx) ?? [];
                      return (
                        <th
                          key={dayIdx}
                          colSpan={slots.length}
                          className="text-center px-2 py-2 border-b border-l border-border/60 font-semibold uppercase tracking-wider text-xs"
                        >
                          {dayLabel(dayIdx)}
                        </th>
                      );
                    })}
                    <th className="text-center px-3 py-2 border-b border-l border-border/60 font-semibold min-w-[110px]">
                      Total
                    </th>
                  </tr>
                  <tr>
                    <th className="px-3 py-2 border-b border-border/60" />
                    {schedule.map((slot) => (
                      <th
                        key={slot.id}
                        className="text-center px-2 py-2 border-b border-l border-border/60 font-normal text-xs text-muted-foreground min-w-[110px]"
                      >
                        <div className="truncate max-w-[110px]">{slot.time}</div>
                        <div className="truncate max-w-[110px] text-[10px]">{slot.code}</div>
                      </th>
                    ))}
                    <th className="px-3 py-2 border-b border-l border-border/60 text-center font-normal text-xs text-muted-foreground">
                      pitches
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pitchers.map((p) => {
                    const rowEntries = pitcherEntries(entries, p.id, schedule);
                    const totalPitches = rowEntries.reduce((s, e) => s + e.pitches, 0);
                    return (
                      <tr key={p.id} className="border-b border-border/40 hover:bg-muted/20">
                        <td className="px-3 py-2 font-medium text-foreground">{p.name}</td>
                        {schedule.map((slot) => {
                          const key = entryKey(p.id, slot.id);
                          const cell = entries[key];
                          const check = isEligibleForGame({
                            entries: rowEntries,
                            targetDay: slot.dayIndex,
                            targetGameIndex: slot.gameIndex,
                          });
                          return (
                            <td key={slot.id} className="align-top px-2 py-2 border-l border-border/40">
                              <EligibilityBadge check={check} />
                              <div className="mt-1 flex gap-1">
                                <div className="flex-1">
                                  <label className="block text-[9px] uppercase tracking-wider text-muted-foreground mb-0.5">P</label>
                                  <Input
                                    type="number"
                                    inputMode="numeric"
                                    min={0}
                                    max={DAILY_MAX}
                                    value={cell?.planned ?? ''}
                                    onChange={(e) => handleCellChange(p.id, slot.id, 'planned', e.target.value)}
                                    className="h-7 px-1 text-center text-sm"
                                    placeholder="—"
                                  />
                                </div>
                                <div className="flex-1">
                                  <label className="block text-[9px] uppercase tracking-wider text-muted-foreground mb-0.5">A</label>
                                  <Input
                                    type="number"
                                    inputMode="numeric"
                                    min={0}
                                    max={DAILY_MAX}
                                    value={cell?.actual ?? ''}
                                    onChange={(e) => handleCellChange(p.id, slot.id, 'actual', e.target.value)}
                                    className="h-7 px-1 text-center text-sm font-semibold"
                                    placeholder="—"
                                  />
                                </div>
                              </div>
                            </td>
                          );
                        })}
                        <td className="px-3 py-2 border-l border-border/40 text-center font-semibold">
                          {totalPitches}
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="bg-muted/30 font-semibold">
                    <td className="px-3 py-2">Game total</td>
                    {schedule.map((slot) => {
                      const gameTotal = pitchers.reduce((sum, p) => {
                        return sum + effectivePitches(entries[entryKey(p.id, slot.id)]);
                      }, 0);
                      return (
                        <td key={slot.id} className="px-2 py-2 border-l border-border/40 text-center">
                          {gameTotal}
                        </td>
                      );
                    })}
                    <td className="px-3 py-2 border-l border-border/40" />
                  </tr>
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}

        {!isLoading && (
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="font-display text-base">Per-day roll-up</CardTitle>
              <p className="text-xs text-muted-foreground">
                Rest tier and games-per-day for each pitcher. Handy for cross-checking the plan against the OBA daily max.
              </p>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <PitcherDayRollup pitchers={pitchers} entries={entries} schedule={schedule} dayIndices={dayIndices} />
            </CardContent>
          </Card>
        )}

        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="font-display text-base">Plan notes</CardTitle>
          </CardHeader>
          <CardContent>
            <Label htmlFor="plan-notes" className="sr-only">Notes</Label>
            <Textarea
              id="plan-notes"
              value={notes}
              onChange={(e) => { setNotes(e.target.value); setDirty(true); }}
              rows={3}
              placeholder="Rotation strategy, injury notes, bullpen availability, anything worth remembering during the tournament."
              className="text-sm"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function EligibilityBadge({ check }: { check: ReturnType<typeof isEligibleForGame> }) {
  if (!check.eligible) {
    return (
      <div
        className="rounded-md border border-red-500/40 bg-red-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-red-700 dark:text-red-300 flex items-center gap-1"
        title={check.reason}
      >
        <AlertTriangle className="w-3 h-3 shrink-0" />
        <span className="truncate">Ineligible</span>
      </div>
    );
  }
  const remaining = check.remaining ?? DAILY_MAX;
  const color =
    remaining >= 60 ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
      : remaining >= 30 ? 'border-lime-500/40 bg-lime-500/10 text-lime-700 dark:text-lime-300'
      : remaining >= 10 ? 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300'
      : 'border-orange-500/40 bg-orange-500/10 text-orange-700 dark:text-orange-300';
  return (
    <div
      className={`rounded-md border px-1.5 py-0.5 text-[10px] font-semibold flex items-center gap-1 ${color}`}
      title={check.reason}
    >
      <CheckCircle2 className="w-3 h-3 shrink-0" />
      <span className="truncate">Up to {remaining}</span>
    </div>
  );
}

function RulesLegend() {
  return (
    <div className="rounded-md border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground flex items-start gap-2">
      <Info className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
      <div className="flex-1">
        <p className="font-semibold text-foreground mb-1">OBA 12U/13U rest tiers</p>
        <ul className="grid grid-cols-2 sm:grid-cols-5 gap-x-4 gap-y-1">
          <li><span className="font-semibold">1–30:</span> no rest</li>
          <li><span className="font-semibold">31–45:</span> 1 day</li>
          <li><span className="font-semibold">46–60:</span> 2 days</li>
          <li><span className="font-semibold">61–75:</span> 3 days</li>
          <li><span className="font-semibold">76–85:</span> 4 days</li>
        </ul>
        <p className="mt-2">
          Also enforced: 85 daily max · 2 games max in any 2-day window · 3rd straight day only if prior 2-day total ≤ 30 · never 4 straight days · same-day 2nd game only if 1st was ≤ 30.
        </p>
      </div>
    </div>
  );
}

function PitcherDayRollup({
  pitchers,
  entries,
  schedule,
  dayIndices,
}: {
  pitchers: Array<{ id: string; name: string }>;
  entries: PitchEntries;
  schedule: TournamentGameSlot[];
  dayIndices: number[];
}) {
  return (
    <table className="w-full border-collapse text-sm min-w-[600px]">
      <thead className="bg-muted/40">
        <tr>
          <th className="text-left px-3 py-2 border-b border-border/60 font-semibold min-w-[140px]">Pitcher</th>
          {dayIndices.map((d) => (
            <th key={d} className="text-center px-3 py-2 border-b border-l border-border/60 font-semibold uppercase tracking-wider text-xs">
              {dayLabel(d)}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {pitchers.map((p) => {
          const pe = pitcherEntries(entries, p.id, schedule);
          const summary = summarizeByDay(pe);
          const byDayMap = new Map(summary.map((s) => [s.day, s]));
          return (
            <tr key={p.id} className="border-b border-border/40">
              <td className="px-3 py-2 font-medium text-foreground">{p.name}</td>
              {dayIndices.map((d) => {
                const s = byDayMap.get(d);
                if (!s) {
                  return (
                    <td key={d} className="px-3 py-2 border-l border-border/40 text-center text-muted-foreground text-xs">
                      —
                    </td>
                  );
                }
                const tier = getTier(s.pitches);
                return (
                  <td key={d} className="px-3 py-2 border-l border-border/40 text-center">
                    <div className="font-semibold">{s.pitches} <span className="text-[10px] font-normal text-muted-foreground">P</span></div>
                    <div className="text-[10px] text-muted-foreground">
                      {s.games} game{s.games === 1 ? '' : 's'} · {tier?.label ?? 'no rest'}
                    </div>
                  </td>
                );
              })}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
