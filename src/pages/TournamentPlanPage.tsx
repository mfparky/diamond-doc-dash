import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Save, CheckCircle2, AlertTriangle, Info, Plus, Trash2, Clock, UserPlus, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { usePitchers } from '@/hooks/use-pitchers';
import {
  useTournamentPlan,
  entryKey,
  type PitchCell,
  type PitchEntries,
  type TournamentRosterEntry,
} from '@/hooks/use-tournament-plan';
import { useTournamentPlans, slugify } from '@/hooks/use-tournament-plans';
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

/**
 * Build the per-pitcher entry list the rules engine consumes. If a cell has a
 * `dayOverride`, that appearance counts to the override day (for suspended
 * games that resumed the next calendar day). Otherwise the game slot's own
 * `dayIndex` applies — which is the correct default for games that simply
 * ran past midnight (per the OBA "counts to the day the game started" rule).
 */
function pitcherEntries(entries: PitchEntries, pitcherId: string, schedule: TournamentGameSlot[]): PitchEntry[] {
  return schedule.map((slot) => {
    const cell = entries[entryKey(pitcherId, slot.id)];
    const day = typeof cell?.dayOverride === 'number' ? cell.dayOverride : slot.dayIndex;
    return {
      day,
      gameIndex: slot.gameIndex,
      pitches: effectivePitches(cell),
    };
  });
}

function buildEmptySchedule(): TournamentGameSlot[] {
  return [
    { id: `slot-${Date.now()}`, dayIndex: 0, gameIndex: 0, date: '', time: '', code: '', opponent: '' },
  ];
}

export default function TournamentPlanPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeSlug = searchParams.get('t') ?? COOPERSTOWN_TOURNAMENT_SLUG;

  const { pitchers, isLoading: pitchersLoading } = usePitchers();
  const { summaries, isLoading: summariesLoading, createPlan, deletePlan, refetch: refetchSummaries } = useTournamentPlans();

  // Resolve the display name for the active tournament (falls back to
  // Cooperstown constants for the seed tournament so it's stable even
  // before summaries have loaded).
  const activeSummary = summaries.find((s) => s.slug === activeSlug);
  const activeName = activeSummary?.name
    ?? (activeSlug === COOPERSTOWN_TOURNAMENT_SLUG ? COOPERSTOWN_TOURNAMENT_NAME : activeSlug);
  const activeDefault = activeSlug === COOPERSTOWN_TOURNAMENT_SLUG ? COOPERSTOWN_2025 : buildEmptySchedule();

  const { plan, isLoading: planLoading, save } = useTournamentPlan(activeSlug, activeName, activeDefault);

  const [schedule, setSchedule] = useState<TournamentGameSlot[]>(activeDefault);
  const [entries, setEntries] = useState<PitchEntries>({});
  const [roster, setRoster] = useState<TournamentRosterEntry[]>([]);
  const [notes, setNotes] = useState('');
  const [savedFlash, setSavedFlash] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [pickupName, setPickupName] = useState('');
  const [rosterSeeded, setRosterSeeded] = useState(false);

  useEffect(() => {
    if (!plan) return;
    setSchedule(plan.schedule.length > 0 ? plan.schedule : activeDefault);
    setEntries(plan.entries);
    setRoster(plan.roster);
    setNotes(plan.notes);
    setDirty(false);
    setRosterSeeded(plan.roster.length > 0);
  }, [plan]); // eslint-disable-line react-hooks/exhaustive-deps

  // First-time seed: brand-new plan with an empty roster → seed from the
  // coach's main pitcher list so the grid isn't empty. Marked dirty so a
  // Save persists the seeded roster.
  useEffect(() => {
    if (rosterSeeded) return;
    if (!plan) return;
    if (plan.roster.length > 0) return;
    if (pitchers.length === 0) return;
    const seed: TournamentRosterEntry[] = pitchers.map((p) => ({
      id: p.id,
      name: p.name,
      isPickup: false,
    }));
    setRoster(seed);
    setRosterSeeded(true);
    setDirty(true);
  }, [plan, pitchers, rosterSeeded]);

  const rosterIds = useMemo(() => new Set(roster.map((r) => r.id)), [roster]);
  const availableMainPitchers = useMemo(
    () => pitchers.filter((p) => !rosterIds.has(p.id)),
    [pitchers, rosterIds],
  );

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
      if (next.planned === null && next.actual === null && (next.dayOverride === null || next.dayOverride === undefined)) {
        delete out[key];
      } else {
        out[key] = next;
      }
      return out;
    });
    setDirty(true);
  };

  const handleDayOverrideChange = (pitcherId: string, slotId: string, newDay: number | null) => {
    setEntries((prev) => {
      const key = entryKey(pitcherId, slotId);
      const existing: PitchCell = prev[key] ?? { planned: null, actual: null };
      const next: PitchCell = { ...existing, dayOverride: newDay };
      const out = { ...prev };
      if (next.planned === null && next.actual === null && next.dayOverride === null) {
        delete out[key];
      } else {
        out[key] = next;
      }
      return out;
    });
    setDirty(true);
  };

  const handleSlotChange = (slotId: string, field: keyof TournamentGameSlot, value: string | number) => {
    setSchedule((prev) => prev.map((s) => (s.id === slotId ? { ...s, [field]: value } : s)));
    setDirty(true);
  };

  const handleAddGame = () => {
    // Default the new slot to the max existing day so the coach can bump it
    // if needed. gameIndex increments to the next open slot for that day.
    const maxDay = schedule.length > 0 ? Math.max(...schedule.map((s) => s.dayIndex)) : 0;
    const nextGameIndex = schedule.filter((s) => s.dayIndex === maxDay).length;
    setSchedule((prev) => [
      ...prev,
      {
        id: `slot-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        dayIndex: maxDay,
        gameIndex: nextGameIndex,
        date: '',
        time: '',
        code: '',
        opponent: '',
      },
    ]);
    setDirty(true);
  };

  const handleRemoveGame = (slotId: string) => {
    setSchedule((prev) => prev.filter((s) => s.id !== slotId));
    // Also drop any cell entries anchored to this slot.
    setEntries((prev) => {
      const out: PitchEntries = {};
      for (const [k, v] of Object.entries(prev)) {
        if (!k.endsWith(`:${slotId}`)) out[k] = v;
      }
      return out;
    });
    setDirty(true);
  };

  const handleAddPickup = () => {
    const name = pickupName.trim();
    if (!name) return;
    const id = `pu_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    setRoster((prev) => [...prev, { id, name, isPickup: true }]);
    setPickupName('');
    setDirty(true);
  };

  const handleAddMainPitcher = (pitcherId: string) => {
    const p = pitchers.find((x) => x.id === pitcherId);
    if (!p) return;
    setRoster((prev) => (prev.some((r) => r.id === p.id) ? prev : [...prev, { id: p.id, name: p.name, isPickup: false }]));
    setDirty(true);
  };

  const handleRemoveFromRoster = (id: string) => {
    setRoster((prev) => prev.filter((r) => r.id !== id));
    // Drop any entries for that player too.
    setEntries((prev) => {
      const out: PitchEntries = {};
      for (const [k, v] of Object.entries(prev)) {
        if (!k.startsWith(`${id}:`)) out[k] = v;
      }
      return out;
    });
    setDirty(true);
  };

  const handleRosterRename = (id: string, name: string) => {
    setRoster((prev) => prev.map((r) => (r.id === id ? { ...r, name } : r)));
    setDirty(true);
  };

  const handleSave = async () => {
    const ok = await save({ schedule, entries, roster, notes });
    if (ok) {
      setSavedFlash(true);
      setDirty(false);
      await refetchSummaries();
      window.setTimeout(() => setSavedFlash(false), 1800);
    }
  };

  const handleCreateTournament = async (name: string, copyFromCurrent: boolean) => {
    const slug = slugify(name);
    if (!slug) return;
    const seedSchedule = copyFromCurrent ? schedule : buildEmptySchedule();
    // Reset dayIndex/gameIndex on the copied schedule so IDs are fresh.
    const freshSchedule = seedSchedule.map((s, i) => ({
      ...s,
      id: `slot-${Date.now()}-${i}`,
    }));
    // Copy the current roster too when duplicating; otherwise start empty
    // and let the seed-from-main-pitchers effect populate it on load.
    const seedRoster = copyFromCurrent ? roster : [];
    const ok = await createPlan(slug, name.trim(), freshSchedule, seedRoster);
    if (ok) {
      setNewDialogOpen(false);
      setSearchParams({ t: slug }, { replace: true });
    }
  };

  const handleDeleteTournament = async () => {
    const ok = await deletePlan(activeSlug);
    if (ok) {
      // Fall back to the first remaining tournament (or Cooperstown seed).
      const next = summaries.find((s) => s.slug !== activeSlug)?.slug ?? COOPERSTOWN_TOURNAMENT_SLUG;
      setSearchParams({ t: next }, { replace: true });
    }
  };

  const isLoading = pitchersLoading || planLoading || summariesLoading;
  const canDelete = summaries.length > 1;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-3 sm:px-4 py-6 max-w-[1600px] space-y-4">
        {/* Header: back + name + tournament picker + save */}
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/" aria-label="Back to dashboard">
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="font-display text-2xl font-bold text-foreground truncate">{activeName}</h1>
            <p className="text-sm text-muted-foreground">
              Plan pitch counts across the tournament. OBA 12U/13U rest rules are enforced automatically.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select
              className="h-9 rounded-md border border-border/60 bg-background px-2 text-sm min-w-[180px]"
              value={activeSlug}
              onChange={(e) => setSearchParams({ t: e.target.value }, { replace: true })}
              aria-label="Switch tournament"
            >
              {summaries.map((s) => (
                <option key={s.slug} value={s.slug}>{s.name}</option>
              ))}
              {!summaries.some((s) => s.slug === activeSlug) && (
                <option value={activeSlug}>{activeName}</option>
              )}
            </select>
            <Dialog open={newDialogOpen} onOpenChange={setNewDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" title="New tournament">
                  <Plus className="w-4 h-4" />
                </Button>
              </DialogTrigger>
              <NewTournamentDialogContent onCreate={handleCreateTournament} />
            </Dialog>
            {canDelete && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" title="Delete tournament">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete {activeName}?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This removes the plan and all pitch entries. This cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteTournament}>Delete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            <Button onClick={handleSave} disabled={!dirty && !savedFlash}>
              {savedFlash ? <CheckCircle2 className="w-4 h-4 mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              {savedFlash ? 'Saved' : 'Save plan'}
            </Button>
          </div>
        </div>

        <RulesLegend />

        {/* Schedule editor — bracket time / opponent / date are all editable + add/remove */}
        <Card className="glass-card">
          <CardHeader className="pb-2 flex flex-row items-start justify-between gap-2">
            <div>
              <CardTitle className="font-display text-base">Schedule</CardTitle>
              <p className="text-xs text-muted-foreground">
                Times / opponents editable so you can update once games shift. Add game rows for bracket play or split entries for suspended games.
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={handleAddGame}>
              <Plus className="w-4 h-4 mr-1" />
              Add game
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {schedule.map((slot) => (
              <div key={slot.id} className="grid grid-cols-1 sm:grid-cols-[90px_120px_120px_120px_1fr_36px] gap-2 items-center text-sm">
                <div className="flex items-center gap-1">
                  <span className="text-xs uppercase tracking-wider text-muted-foreground">Day</span>
                  <Input
                    type="number"
                    min={0}
                    value={slot.dayIndex + 1}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      if (Number.isFinite(n) && n >= 1) handleSlotChange(slot.id, 'dayIndex', n - 1);
                    }}
                    className="h-8 px-1 text-center w-14"
                  />
                </div>
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
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-muted-foreground hover:text-red-600"
                  onClick={() => handleRemoveGame(slot.id)}
                  aria-label="Remove game"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Tournament roster — main pitchers seeded on new plans; pickups added freely */}
        <Card className="glass-card">
          <CardHeader className="pb-2 flex flex-row items-start justify-between gap-2">
            <div>
              <CardTitle className="font-display text-base flex items-center gap-2">
                <Users className="w-4 h-4" />
                Tournament roster
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Only players on this roster show up in the grid below. Add pickups by name, or add regulars from your main roster.
              </p>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {roster.length === 0 && (
              <p className="text-sm text-muted-foreground italic">
                Roster is empty. Add pickups below or add players from your main roster.
              </p>
            )}
            {roster.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {roster.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center gap-2 rounded-md border border-border/60 bg-background px-2 py-1"
                  >
                    <Input
                      value={r.name}
                      onChange={(e) => handleRosterRename(r.id, e.target.value)}
                      className="h-7 flex-1 border-0 shadow-none px-1 focus-visible:ring-1"
                    />
                    {r.isPickup && (
                      <span className="text-[9px] uppercase tracking-wider bg-blue-500/15 text-blue-700 dark:text-blue-300 px-1 rounded" title="Pickup player">
                        PU
                      </span>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-muted-foreground hover:text-red-600"
                      onClick={() => handleRemoveFromRoster(r.id)}
                      aria-label="Remove from roster"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Add pickup */}
            <div className="flex items-center gap-2 pt-2 border-t border-border/40">
              <UserPlus className="w-4 h-4 text-muted-foreground" />
              <Input
                value={pickupName}
                onChange={(e) => setPickupName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddPickup(); } }}
                placeholder="Pickup player name…"
                className="h-8 flex-1"
              />
              <Button size="sm" onClick={handleAddPickup} disabled={!pickupName.trim()}>
                Add pickup
              </Button>
            </div>

            {/* Add back from main roster */}
            {availableMainPitchers.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/40">
                <span className="text-xs text-muted-foreground shrink-0">From main roster:</span>
                {availableMainPitchers.map((p) => (
                  <Button
                    key={p.id}
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => handleAddMainPitcher(p.id)}
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    {p.name}
                  </Button>
                ))}
              </div>
            )}
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
                Two rows per cell: <strong>P</strong> planned, <strong>A</strong> actual. Actuals override planned for eligibility math. Click the clock icon to move an appearance to a different day (suspended games that resumed the next calendar day).
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
                        <div className="truncate max-w-[110px]">{slot.time || '—'}</div>
                        <div className="truncate max-w-[110px] text-[10px]">{slot.code || slot.opponent || ''}</div>
                      </th>
                    ))}
                    <th className="px-3 py-2 border-b border-l border-border/60 text-center font-normal text-xs text-muted-foreground">
                      pitches
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {roster.map((p) => {
                    const rowEntries = pitcherEntries(entries, p.id, schedule);
                    const totalPitches = rowEntries.reduce((s, e) => s + e.pitches, 0);
                    return (
                      <tr key={p.id} className="border-b border-border/40 hover:bg-muted/20">
                        <td className="px-3 py-2 font-medium text-foreground">
                          <div className="flex items-center gap-1">
                            <span className="truncate">{p.name}</span>
                            {p.isPickup && (
                              <span className="text-[9px] uppercase tracking-wider bg-blue-500/15 text-blue-700 dark:text-blue-300 px-1 rounded" title="Pickup player">
                                PU
                              </span>
                            )}
                          </div>
                        </td>
                        {schedule.map((slot, slotIdx) => {
                          const key = entryKey(p.id, slot.id);
                          const cell = entries[key];
                          const effectiveDay = typeof cell?.dayOverride === 'number' ? cell.dayOverride : slot.dayIndex;
                          const check = isEligibleForGame({
                            entries: rowEntries,
                            targetDay: effectiveDay,
                            targetGameIndex: rowEntries[slotIdx].gameIndex,
                          });
                          const hasOverride = typeof cell?.dayOverride === 'number' && cell.dayOverride !== slot.dayIndex;
                          return (
                            <td key={slot.id} className="align-top px-2 py-2 border-l border-border/40">
                              <div className="flex items-center gap-1">
                                <div className="flex-1 min-w-0">
                                  <EligibilityBadge check={check} />
                                </div>
                                <DayOverridePopover
                                  slotDay={slot.dayIndex}
                                  override={cell?.dayOverride ?? null}
                                  hasOverride={hasOverride}
                                  onChange={(d) => handleDayOverrideChange(p.id, slot.id, d)}
                                />
                              </div>
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
                      const gameTotal = roster.reduce((sum, p) => {
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
                Rest tier and games-per-day for each pitcher. Reflects any day overrides you've set.
              </p>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <PitcherDayRollup roster={roster} entries={entries} schedule={schedule} />
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

function NewTournamentDialogContent({
  onCreate,
}: {
  onCreate: (name: string, copyFromCurrent: boolean) => void;
}) {
  const [name, setName] = useState('');
  const [copyFromCurrent, setCopyFromCurrent] = useState(false);
  const slug = slugify(name);
  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>New tournament</DialogTitle>
        <DialogDescription>
          Create a fresh planner for another tournament. You can add game slots after creating.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-3">
        <div>
          <Label htmlFor="new-tournament-name">Tournament name</Label>
          <Input
            id="new-tournament-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Fall Classic 2025"
          />
          {slug && (
            <p className="text-xs text-muted-foreground mt-1">Slug: <code>{slug}</code></p>
          )}
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={copyFromCurrent}
            onChange={(e) => setCopyFromCurrent(e.target.checked)}
          />
          Copy schedule from current tournament
        </label>
      </div>
      <DialogFooter>
        <Button onClick={() => onCreate(name, copyFromCurrent)} disabled={!name.trim()}>
          Create
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function DayOverridePopover({
  slotDay,
  override,
  hasOverride,
  onChange,
}: {
  slotDay: number;
  override: number | null;
  hasOverride: boolean;
  onChange: (day: number | null) => void;
}) {
  const [value, setValue] = useState<string>(override !== null ? String(override + 1) : String(slotDay + 1));
  useEffect(() => {
    setValue(override !== null ? String(override + 1) : String(slotDay + 1));
  }, [override, slotDay]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`p-0.5 rounded ${hasOverride ? 'text-blue-600 dark:text-blue-400' : 'text-muted-foreground hover:text-foreground'}`}
          title={hasOverride ? `Counts to Day ${(override ?? slotDay) + 1}` : 'Move appearance to a different day'}
          aria-label="Day override"
        >
          <Clock className="w-3.5 h-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-3 space-y-2">
        <p className="text-xs font-semibold">Move appearance to Day…</p>
        <p className="text-[11px] text-muted-foreground">
          Use when a game was suspended and resumed on the next calendar day. Pitches then count to that day's rest math.
        </p>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={1}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="h-8 flex-1"
          />
          <Button
            size="sm"
            onClick={() => {
              const n = Number(value);
              if (Number.isFinite(n) && n >= 1) {
                const newDay = Math.trunc(n) - 1;
                onChange(newDay === slotDay ? null : newDay);
              }
            }}
          >
            Set
          </Button>
        </div>
        {override !== null && (
          <Button
            size="sm"
            variant="ghost"
            className="w-full text-xs"
            onClick={() => onChange(null)}
          >
            Clear (use Day {slotDay + 1})
          </Button>
        )}
      </PopoverContent>
    </Popover>
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
          Also enforced: 85 daily max · 2 games max in any 2-day window · 3rd straight day only if prior 2-day total ≤ 30 · never 4 straight days · same-day 2nd game only if 1st was ≤ 30. Games that cross midnight count to the start day by default — use the clock icon on a cell to move a specific appearance to a different day (suspended-and-resumed games).
        </p>
      </div>
    </div>
  );
}

function PitcherDayRollup({
  roster,
  entries,
  schedule,
}: {
  roster: TournamentRosterEntry[];
  entries: PitchEntries;
  schedule: TournamentGameSlot[];
}) {
  // Roll-up must include any override days too, not just the days that
  // appear in the schedule (e.g. a suspended game moved to a day nobody
  // was scheduled to play). Collect all days that have appearances.
  const rolledDays = new Set<number>();
  for (const slot of schedule) rolledDays.add(slot.dayIndex);
  for (const cell of Object.values(entries)) {
    if (typeof cell.dayOverride === 'number') rolledDays.add(cell.dayOverride);
  }
  const dayIndices = [...rolledDays].sort((a, b) => a - b);

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
        {roster.map((p) => {
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
