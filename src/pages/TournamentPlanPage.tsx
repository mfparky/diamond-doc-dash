import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Save, CheckCircle2, AlertTriangle, Info, Plus, Trash2, Clock, UserPlus, Users, CalendarClock, BarChart3, StickyNote, Minus, Wand2, Shield } from 'lucide-react';
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { usePitchers } from '@/hooks/use-pitchers';
import {
  useTournamentPlan,
  entryKey,
  type PitchCell,
  type PitchEntries,
  type TournamentRosterEntry,
  type RotationGroup,
  type CatchersByDay,
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
  const [catchers, setCatchers] = useState<CatchersByDay>({});
  const [autoDialogOpen, setAutoDialogOpen] = useState(false);
  const [autoPitchesPerPitcher, setAutoPitchesPerPitcher] = useState(30);
  const [autoPitchersPerGame, setAutoPitchersPerGame] = useState(3);
  const [savedFlash, setSavedFlash] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [pickupName, setPickupName] = useState('');
  const [rosterSeeded, setRosterSeeded] = useState(false);
  // Mobile game-focus view — which slot the coach is currently logging.
  // Kept in sync with the schedule so it doesn't dangle after a slot is removed.
  const [focusedSlotId, setFocusedSlotId] = useState<string | null>(null);
  useEffect(() => {
    if (schedule.length === 0) {
      if (focusedSlotId !== null) setFocusedSlotId(null);
      return;
    }
    if (!focusedSlotId || !schedule.some((s) => s.id === focusedSlotId)) {
      setFocusedSlotId(schedule[0].id);
    }
  }, [schedule, focusedSlotId]);
  const focusedSlot = useMemo(
    () => schedule.find((s) => s.id === focusedSlotId) ?? schedule[0] ?? null,
    [schedule, focusedSlotId],
  );

  useEffect(() => {
    if (!plan) return;
    setSchedule(plan.schedule.length > 0 ? plan.schedule : activeDefault);
    setEntries(plan.entries);
    setRoster(plan.roster);
    setNotes(plan.notes);
    setCatchers(plan.catchers);
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

  const handleGroupChange = (id: string, group: RotationGroup) => {
    setRoster((prev) => prev.map((r) => (r.id === id ? { ...r, group } : r)));
    setDirty(true);
  };

  const handleTargetGroupChange = (slotId: string, target: 'A' | 'B' | null) => {
    setSchedule((prev) => prev.map((s) => (s.id === slotId ? { ...s, targetGroup: target } : s)));
    setDirty(true);
  };

  const isCatchingOn = (pitcherId: string, dayIndex: number) => {
    const key = String(dayIndex);
    return (catchers[key] ?? []).includes(pitcherId);
  };

  const handleToggleCatcher = (dayIndex: number, pitcherId: string) => {
    const key = String(dayIndex);
    setCatchers((prev) => {
      const list = prev[key] ?? [];
      const next = list.includes(pitcherId) ? list.filter((x) => x !== pitcherId) : [...list, pitcherId];
      const out = { ...prev };
      if (next.length === 0) delete out[key];
      else out[key] = next;
      return out;
    });
    setDirty(true);
  };

  /**
   * Auto-populate the plan.
   *
   * For each game slot in schedule order:
   *   1. Determine the target group. Slots without one draw from the whole roster.
   *   2. Pull eligible players from that pool — skipping catchers-of-day and anyone
   *      the rules engine says is ineligible RIGHT NOW (already scheduled elsewhere,
   *      rest-locked, cap-blocked, etc.).
   *   3. Sort by tournament total ASC to spread work evenly across the roster.
   *   4. Take the first N players, cap each pitcher's assignment at what the rules
   *      allow for that slot (rules-driven remaining), and set `planned` accordingly.
   *
   * NEVER touches `actual`. Overwrites any existing `planned` — the confirm
   * dialog warns about this before the coach runs it.
   */
  const runAutoPopulate = () => {
    const perPitcher = Math.max(1, Math.min(DAILY_MAX, Math.trunc(autoPitchesPerPitcher)));
    const perGame = Math.max(1, Math.min(roster.length || 1, Math.trunc(autoPitchersPerGame)));
    const workingEntries: PitchEntries = { ...entries };

    // Clear existing planned values so the algorithm starts from a clean
    // slate; actuals stay intact.
    for (const [k, cell] of Object.entries(workingEntries)) {
      if (cell.actual === null) {
        // Whole cell exists only for planned — drop it (dayOverride preserved).
        if ((cell.dayOverride ?? null) === null) {
          delete workingEntries[k];
        } else {
          workingEntries[k] = { ...cell, planned: null };
        }
      } else {
        workingEntries[k] = { ...cell, planned: null };
      }
    }

    // Tournament totals so we can pick the least-loaded players first.
    const totalsSoFar = new Map<string, number>();
    for (const p of roster) totalsSoFar.set(p.id, 0);

    for (const slot of schedule) {
      // Pool: target group if set, otherwise the whole roster.
      const pool = roster.filter((p) => (slot.targetGroup ? p.group === slot.targetGroup : true));

      // Only players still eligible for this specific slot.
      const eligible = pool
        .filter((p) => !isCatchingOn(p.id, slot.dayIndex))
        .map((p) => {
          const rowEntries = pitcherEntries(workingEntries, p.id, schedule);
          const check = isEligibleForGame({
            entries: rowEntries,
            targetDay: slot.dayIndex,
            targetGameIndex: slot.gameIndex,
          });
          return { p, check };
        })
        .filter(({ check }) => check.eligible && (check.remaining ?? 0) > 0)
        .sort((a, b) => (totalsSoFar.get(a.p.id) ?? 0) - (totalsSoFar.get(b.p.id) ?? 0));

      const picked = eligible.slice(0, perGame);
      for (const { p, check } of picked) {
        const cap = Math.min(perPitcher, check.remaining ?? perPitcher);
        if (cap <= 0) continue;
        const key = entryKey(p.id, slot.id);
        const existing: PitchCell = workingEntries[key] ?? { planned: null, actual: null };
        workingEntries[key] = { ...existing, planned: cap };
        totalsSoFar.set(p.id, (totalsSoFar.get(p.id) ?? 0) + cap);
      }
    }

    setEntries(workingEntries);
    setDirty(true);
    setAutoDialogOpen(false);
  };

  const handleSave = async () => {
    const ok = await save({ schedule, entries, roster, catchers, notes });
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
    <div className="min-h-screen bg-background pb-24 sm:pb-4">
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
            <Dialog open={autoDialogOpen} onOpenChange={setAutoDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" title="Auto-populate plan">
                  <Wand2 className="w-4 h-4" />
                  <span className="hidden sm:inline ml-1">Auto-fill</span>
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Auto-populate plan</DialogTitle>
                  <DialogDescription>
                    For each game with a target group, picks eligible players from that group
                    (skipping catchers and anyone rest-locked), spreads work across the roster,
                    and fills in <strong>planned</strong> pitches. Actuals are left alone.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="auto-per-pitcher">Pitches per pitcher</Label>
                      <Input
                        id="auto-per-pitcher"
                        type="number"
                        min={1}
                        max={DAILY_MAX}
                        value={autoPitchesPerPitcher}
                        onChange={(e) => setAutoPitchesPerPitcher(Number(e.target.value) || 30)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="auto-per-game">Pitchers per game</Label>
                      <Input
                        id="auto-per-game"
                        type="number"
                        min={1}
                        max={11}
                        value={autoPitchersPerGame}
                        onChange={(e) => setAutoPitchersPerGame(Number(e.target.value) || 3)}
                      />
                    </div>
                  </div>
                  <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 flex items-start gap-2 text-xs">
                    <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                    <p className="text-amber-800 dark:text-amber-200">
                      This overwrites <strong>every planned value</strong> currently in the plan.
                      Actual pitch counts already logged are preserved.
                    </p>
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={runAutoPopulate}>Auto-fill</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Button onClick={handleSave} disabled={!dirty && !savedFlash}>
              {savedFlash ? <CheckCircle2 className="w-4 h-4 mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              {savedFlash ? 'Saved' : 'Save plan'}
            </Button>
          </div>
        </div>

        <RulesLegend />

        {/* Mobile primary view — game-focused for dugout use.
            Coach picks a game from the horizontal chip strip, then sees
            per-pitcher cards with big touch-targets for logging pitches. */}
        <div className="sm:hidden space-y-3">
          <MobileGameStrip
            schedule={schedule}
            focusedSlotId={focusedSlot?.id ?? null}
            onFocus={setFocusedSlotId}
            roster={roster}
            entries={entries}
          />
          {roster.length === 0 && (
            <Card className="glass-card">
              <CardContent className="p-4 text-sm text-muted-foreground italic">
                No players on this roster yet. Tap Roster in the bar below to add pickups or main-roster players.
              </CardContent>
            </Card>
          )}
          {focusedSlot && roster.length > 0 && (
            <MobileGameView
              slot={focusedSlot}
              schedule={schedule}
              roster={roster}
              entries={entries}
              catchers={catchers}
              onCellChange={handleCellChange}
              onDayOverrideChange={handleDayOverrideChange}
            />
          )}
        </div>

        {/* Desktop primary view — the wide grid + all editors inline. */}
        <div className="hidden sm:block space-y-4">
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
              <div key={slot.id} className="grid grid-cols-1 sm:grid-cols-[90px_110px_100px_110px_1fr_130px_36px] gap-2 items-center text-sm">
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
                <TargetGroupPicker
                  target={slot.targetGroup ?? null}
                  onChange={(g) => handleTargetGroupChange(slot.id, g)}
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
                    <GroupToggle group={r.group ?? null} onChange={(g) => handleGroupChange(r.id, g)} />
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
            {/* Legend */}
            <p className="text-[11px] text-muted-foreground pt-1 border-t border-border/40">
              <GroupLetterInline group="A" /> best arms who lead off the tournament ·{' '}
              <GroupLetterInline group="B" /> depth arms who slot in on secondary days
            </p>

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

        {/* Catchers per day — pitchers who are catching can't also pitch. */}
        <CatchersEditorCard
          schedule={schedule}
          roster={roster}
          catchers={catchers}
          onToggle={handleToggleCatcher}
        />

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
                        {slot.targetGroup && (
                          <div className="mt-1 flex justify-center">
                            <GroupLetterInline group={slot.targetGroup} label="Plan" />
                          </div>
                        )}
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
                            {p.group && <GroupLetterInline group={p.group} />}
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
                            isCatchingToday: isCatchingOn(p.id, effectiveDay),
                          });
                          const hasOverride = typeof cell?.dayOverride === 'number' && cell.dayOverride !== slot.dayIndex;
                          const hasPlanned = typeof cell?.planned === 'number' && cell.planned > 0;
                          const hasActual = typeof cell?.actual === 'number' && cell.actual > 0;
                          const offPlan =
                            (hasPlanned || hasActual)
                            && !!slot.targetGroup
                            && !!p.group
                            && p.group !== slot.targetGroup;
                          return (
                            <td key={slot.id} className="align-top px-2 py-2 border-l border-border/40">
                              <div className="flex items-center gap-1">
                                <div className="flex-1 min-w-0">
                                  <EligibilityBadge check={check} offPlan={offPlan} slotGroup={slot.targetGroup ?? null} pitcherGroup={p.group ?? null} />
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
        </div>{/* /desktop wrapper */}
      </div>

      {/* Mobile bottom bar — Schedule / Roster / Roll-up / Notes as sheets.
          Fixed at the bottom so it's one tap away in the dugout. */}
      <div className="sm:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border/60 bg-background/95 backdrop-blur px-1 pt-1 pb-[max(0.25rem,env(safe-area-inset-bottom))]">
        <div className="flex gap-1">
          <MobileSheetButton icon={<CalendarClock className="w-5 h-5" />} label="Schedule">
            <MobileScheduleSheetContent
              schedule={schedule}
              onSlotChange={handleSlotChange}
              onTargetGroupChange={handleTargetGroupChange}
              onAddGame={handleAddGame}
              onRemoveGame={handleRemoveGame}
            />
          </MobileSheetButton>
          <MobileSheetButton icon={<Users className="w-5 h-5" />} label="Roster">
            <MobileRosterSheetContent
              roster={roster}
              availableMainPitchers={availableMainPitchers}
              pickupName={pickupName}
              onPickupNameChange={setPickupName}
              onAddPickup={handleAddPickup}
              onAddMainPitcher={handleAddMainPitcher}
              onRemoveFromRoster={handleRemoveFromRoster}
              onRosterRename={handleRosterRename}
              onGroupChange={handleGroupChange}
            />
          </MobileSheetButton>
          <MobileSheetButton icon={<Shield className="w-5 h-5" />} label="Catchers">
            <CatchersEditorCard
              schedule={schedule}
              roster={roster}
              catchers={catchers}
              onToggle={handleToggleCatcher}
            />
          </MobileSheetButton>
          <MobileSheetButton icon={<BarChart3 className="w-5 h-5" />} label="Roll-up">
            <PitcherDayRollup roster={roster} entries={entries} schedule={schedule} />
          </MobileSheetButton>
          <MobileSheetButton icon={<StickyNote className="w-5 h-5" />} label="Notes">
            <Textarea
              value={notes}
              onChange={(e) => { setNotes(e.target.value); setDirty(true); }}
              rows={12}
              placeholder="Rotation strategy, injury notes, bullpen availability, anything worth remembering during the tournament."
              className="text-sm"
            />
          </MobileSheetButton>
        </div>
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

function EligibilityBadge({
  check,
  offPlan,
  slotGroup,
  pitcherGroup,
}: {
  check: ReturnType<typeof isEligibleForGame>;
  offPlan?: boolean;
  slotGroup?: RotationGroup;
  pitcherGroup?: RotationGroup;
}) {
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
    <div className="flex flex-col gap-0.5">
      <div
        className={`rounded-md border px-1.5 py-0.5 text-[10px] font-semibold flex items-center gap-1 ${color}`}
        title={check.reason}
      >
        <CheckCircle2 className="w-3 h-3 shrink-0" />
        <span className="truncate">Up to {remaining}</span>
      </div>
      {offPlan && (
        <div
          className="rounded-md border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-amber-700 dark:text-amber-300 flex items-center gap-1"
          title={`Rotation plan: Group ${slotGroup}. This pitcher is Group ${pitcherGroup}. Legal per OBA rules — just outside the intended rotation.`}
        >
          <AlertTriangle className="w-3 h-3 shrink-0" />
          <span className="truncate">Off-plan · uses {pitcherGroup}, plan is {slotGroup}</span>
        </div>
      )}
    </div>
  );
}

function GroupToggle({ group, onChange }: { group: RotationGroup; onChange: (g: RotationGroup) => void }) {
  const cycle = () => {
    if (group === null) onChange('A');
    else if (group === 'A') onChange('B');
    else onChange(null);
  };
  const label = group === 'A' ? 'A' : group === 'B' ? 'B' : '—';
  const color = group === 'A'
    ? 'bg-blue-500/15 border-blue-500/40 text-blue-700 dark:text-blue-300'
    : group === 'B'
      ? 'bg-purple-500/15 border-purple-500/40 text-purple-700 dark:text-purple-300'
      : 'bg-muted border-border text-muted-foreground';
  return (
    <button
      type="button"
      onClick={cycle}
      className={`h-6 w-6 rounded-md border text-xs font-bold flex items-center justify-center ${color}`}
      title="Click to cycle A → B → none"
      aria-label="Rotation group"
    >
      {label}
    </button>
  );
}

function GroupLetterInline({ group, label }: { group: 'A' | 'B'; label?: string }) {
  const color = group === 'A'
    ? 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30'
    : 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30';
  return (
    <span className={`inline-flex items-center gap-1 rounded border px-1 py-px text-[9px] font-bold uppercase tracking-wider ${color}`}>
      {label ? <span className="opacity-70">{label}</span> : null}
      {group}
    </span>
  );
}

function TargetGroupPicker({ target, onChange }: { target: 'A' | 'B' | null; onChange: (t: 'A' | 'B' | null) => void }) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Plan</span>
      <div className="flex gap-0.5">
        {(['A', 'B'] as const).map((g) => {
          const active = target === g;
          const activeColor = g === 'A' ? 'bg-blue-500 text-white' : 'bg-purple-500 text-white';
          return (
            <button
              key={g}
              type="button"
              onClick={() => onChange(active ? null : g)}
              className={`h-6 w-6 rounded text-xs font-bold ${active ? activeColor : 'bg-muted text-muted-foreground'}`}
              title={active ? `Clear plan (currently ${g})` : `Plan Group ${g} for this slot`}
            >
              {g}
            </button>
          );
        })}
      </div>
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
              <td className="px-3 py-2 font-medium text-foreground">
                <div className="flex items-center gap-1">
                  <span>{p.name}</span>
                  {p.group && <GroupLetterInline group={p.group} />}
                </div>
              </td>
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
        {/* Group summary rows — count each group's total pitches + arms used per day.
            Lets the coach see 'am I actually running Group A on Day 1, Group B on Day 2?'
            at a glance. */}
        {(['A', 'B'] as const).map((groupKey) => {
          const groupPlayers = roster.filter((r) => r.group === groupKey);
          if (groupPlayers.length === 0) return null;
          return (
            <tr key={`group-summary-${groupKey}`} className="bg-muted/40 border-t border-border/60">
              <td className="px-3 py-2 font-semibold text-xs uppercase tracking-wider">
                Group {groupKey} total
              </td>
              {dayIndices.map((d) => {
                let groupPitches = 0;
                let groupArms = 0;
                for (const p of groupPlayers) {
                  const pe = pitcherEntries(entries, p.id, schedule);
                  const dayPitches = pe
                    .filter((e) => e.day === d)
                    .reduce((sum, e) => sum + e.pitches, 0);
                  if (dayPitches > 0) {
                    groupPitches += dayPitches;
                    groupArms += 1;
                  }
                }
                return (
                  <td key={d} className="px-3 py-2 border-l border-border/40 text-center">
                    <div className="font-semibold text-sm">{groupPitches}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {groupArms} arm{groupArms === 1 ? '' : 's'}
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

// ============================================================================
// Mobile-only components — coach-in-dugout use case.
// ============================================================================

/**
 * Horizontal, snappable chip strip for picking which game to log. Each chip
 * shows day, time, opponent short + a small "Plan A/B" hint. Selected chip
 * is emphasized.
 */
function MobileGameStrip({
  schedule,
  focusedSlotId,
  onFocus,
  roster,
  entries,
}: {
  schedule: TournamentGameSlot[];
  focusedSlotId: string | null;
  onFocus: (slotId: string) => void;
  roster: TournamentRosterEntry[];
  entries: PitchEntries;
}) {
  if (schedule.length === 0) {
    return (
      <Card className="glass-card">
        <CardContent className="p-4 text-sm text-muted-foreground italic">
          No games scheduled. Tap Schedule in the bar below to add one.
        </CardContent>
      </Card>
    );
  }
  return (
    <div className="-mx-3 px-3 overflow-x-auto snap-x snap-mandatory">
      <div className="flex gap-2 pb-2 min-w-max">
        {schedule.map((slot) => {
          const active = slot.id === focusedSlotId;
          // Total pitches recorded in this slot so far — quick "how loaded is
          // this game" hint on the chip.
          const gameTotal = roster.reduce((s, p) => s + effectivePitches(entries[entryKey(p.id, slot.id)]), 0);
          return (
            <button
              key={slot.id}
              type="button"
              onClick={() => onFocus(slot.id)}
              className={`snap-start shrink-0 min-w-[160px] max-w-[220px] text-left rounded-lg border p-2 transition ${
                active
                  ? 'bg-primary/10 border-primary shadow-sm'
                  : 'bg-background border-border/60 hover:bg-muted/40'
              }`}
            >
              <div className="flex items-center justify-between gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                <span>{dayLabel(slot.dayIndex)}</span>
                {slot.targetGroup && <GroupLetterInline group={slot.targetGroup} label="Plan" />}
              </div>
              <div className="text-sm font-semibold truncate">
                {slot.time || 'TBD'} · {slot.code || 'Game'}
              </div>
              <div className="text-xs text-muted-foreground truncate">
                {slot.opponent || '—'}
              </div>
              <div className="mt-1 text-[10px] text-muted-foreground">
                {gameTotal > 0 ? `${gameTotal} pitches logged` : 'No pitches yet'}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * The focused game's pitcher list — one card per roster player. Each card
 * has big touch-targets (± steppers) for logging planned + actual pitches,
 * plus the eligibility badge and day-override control.
 */
function MobileGameView({
  slot,
  schedule,
  roster,
  entries,
  catchers,
  onCellChange,
  onDayOverrideChange,
}: {
  slot: TournamentGameSlot;
  schedule: TournamentGameSlot[];
  roster: TournamentRosterEntry[];
  entries: PitchEntries;
  catchers: CatchersByDay;
  onCellChange: (pitcherId: string, slotId: string, field: 'planned' | 'actual', raw: string) => void;
  onDayOverrideChange: (pitcherId: string, slotId: string, newDay: number | null) => void;
}) {
  return (
    <Card className="glass-card">
      <CardHeader className="pb-2">
        <div className="flex items-baseline gap-2 flex-wrap">
          <CardTitle className="font-display text-lg">{slot.code || 'Game'}</CardTitle>
          {slot.targetGroup && <GroupLetterInline group={slot.targetGroup} label="Plan" />}
        </div>
        <p className="text-xs text-muted-foreground">
          {dayLabel(slot.dayIndex)} · {slot.time || 'TBD'} · {slot.opponent || '—'}
        </p>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-border/40">
          {roster.map((p) => {
            const cell = entries[entryKey(p.id, slot.id)];
            const effectiveDay = typeof cell?.dayOverride === 'number' ? cell.dayOverride : slot.dayIndex;
            const isCatchingToday = (catchers[String(effectiveDay)] ?? []).includes(p.id);
            return (
              <MobilePitcherCard
                key={p.id}
                pitcher={p}
                slot={slot}
                cell={cell}
                rowEntries={pitcherEntries(entries, p.id, schedule)}
                isCatchingToday={isCatchingToday}
                onCellChange={onCellChange}
                onDayOverrideChange={onDayOverrideChange}
              />
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function MobilePitcherCard({
  pitcher,
  slot,
  cell,
  rowEntries,
  isCatchingToday,
  onCellChange,
  onDayOverrideChange,
}: {
  pitcher: TournamentRosterEntry;
  slot: TournamentGameSlot;
  cell: PitchCell | undefined;
  rowEntries: PitchEntry[];
  isCatchingToday: boolean;
  onCellChange: (pitcherId: string, slotId: string, field: 'planned' | 'actual', raw: string) => void;
  onDayOverrideChange: (pitcherId: string, slotId: string, newDay: number | null) => void;
}) {
  const effectiveDay = typeof cell?.dayOverride === 'number' ? cell.dayOverride : slot.dayIndex;
  const check = isEligibleForGame({
    entries: rowEntries,
    targetDay: effectiveDay,
    targetGameIndex: slot.gameIndex,
    isCatchingToday,
  });
  const hasOverride = typeof cell?.dayOverride === 'number' && cell.dayOverride !== slot.dayIndex;
  const hasPlanned = typeof cell?.planned === 'number' && cell.planned > 0;
  const hasActual = typeof cell?.actual === 'number' && cell.actual > 0;
  const offPlan =
    (hasPlanned || hasActual)
    && !!slot.targetGroup
    && !!pitcher.group
    && pitcher.group !== slot.targetGroup;

  return (
    <div className="p-3 space-y-2.5">
      <div className="flex items-center gap-2">
        <span className="font-semibold text-base flex-1 truncate">{pitcher.name}</span>
        {pitcher.group && <GroupLetterInline group={pitcher.group} />}
        {isCatchingToday && (
          <span className="text-[9px] uppercase tracking-wider bg-orange-500/15 text-orange-700 dark:text-orange-300 px-1 rounded flex items-center gap-0.5" title="Catching today">
            <Shield className="w-2.5 h-2.5" />C
          </span>
        )}
        {pitcher.isPickup && (
          <span className="text-[9px] uppercase tracking-wider bg-blue-500/15 text-blue-700 dark:text-blue-300 px-1 rounded">PU</span>
        )}
        <DayOverridePopover
          slotDay={slot.dayIndex}
          override={cell?.dayOverride ?? null}
          hasOverride={hasOverride}
          onChange={(d) => onDayOverrideChange(pitcher.id, slot.id, d)}
        />
      </div>
      <EligibilityBadge
        check={check}
        offPlan={offPlan}
        slotGroup={slot.targetGroup ?? null}
        pitcherGroup={pitcher.group ?? null}
      />
      <MobileStepper
        label="Planned"
        value={cell?.planned ?? null}
        onChange={(v) => onCellChange(pitcher.id, slot.id, 'planned', v)}
      />
      <MobileStepper
        label="Actual"
        emphasize
        value={cell?.actual ?? null}
        onChange={(v) => onCellChange(pitcher.id, slot.id, 'actual', v)}
      />
    </div>
  );
}

/**
 * Big-touch-target pitch count input. −5 / − / value / + / +5. Coach in
 * bright sunlight and wearing a batting glove can hit these reliably.
 */
function MobileStepper({
  label,
  value,
  onChange,
  emphasize,
}: {
  label: string;
  value: number | null;
  onChange: (rawValue: string) => void;
  emphasize?: boolean;
}) {
  const current = typeof value === 'number' ? value : 0;
  const step = (delta: number) => {
    const next = Math.max(0, Math.min(DAILY_MAX, current + delta));
    onChange(String(next));
  };
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground w-14 shrink-0">
        {label}
      </span>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-10 w-10 p-0 text-xs font-semibold shrink-0"
        onClick={() => step(-5)}
        disabled={current <= 0}
      >
        −5
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-10 w-9 p-0 shrink-0"
        onClick={() => step(-1)}
        disabled={current <= 0}
      >
        <Minus className="w-4 h-4" />
      </Button>
      <Input
        type="number"
        inputMode="numeric"
        min={0}
        max={DAILY_MAX}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className={`h-10 flex-1 text-center ${emphasize ? 'font-bold text-lg' : 'text-base'}`}
        placeholder="—"
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-10 w-9 p-0 shrink-0"
        onClick={() => step(1)}
        disabled={current >= DAILY_MAX}
      >
        <Plus className="w-4 h-4" />
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-10 w-10 p-0 text-xs font-semibold shrink-0"
        onClick={() => step(5)}
        disabled={current >= DAILY_MAX}
      >
        +5
      </Button>
    </div>
  );
}

/**
 * Bottom-bar button that opens a bottom sheet with the given section content.
 */
function MobileSheetButton({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          type="button"
          className="flex-1 flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50"
        >
          {icon}
          <span className="text-[10px] font-medium">{label}</span>
        </button>
      </SheetTrigger>
      <SheetContent side="bottom" className="h-[90vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{label}</SheetTitle>
          <SheetDescription className="sr-only">Tournament {label} editor.</SheetDescription>
        </SheetHeader>
        <div className="mt-4">{children}</div>
      </SheetContent>
    </Sheet>
  );
}

/**
 * Compact schedule editor for mobile — vertical list of games with the same
 * fields as desktop but stacked. Same handlers.
 */
function MobileScheduleSheetContent({
  schedule,
  onSlotChange,
  onTargetGroupChange,
  onAddGame,
  onRemoveGame,
}: {
  schedule: TournamentGameSlot[];
  onSlotChange: (slotId: string, field: keyof TournamentGameSlot, value: string | number) => void;
  onTargetGroupChange: (slotId: string, target: 'A' | 'B' | null) => void;
  onAddGame: () => void;
  onRemoveGame: (slotId: string) => void;
}) {
  return (
    <div className="space-y-3">
      <Button size="sm" variant="outline" onClick={onAddGame} className="w-full">
        <Plus className="w-4 h-4 mr-1" />
        Add game
      </Button>
      <div className="space-y-3">
        {schedule.map((slot) => (
          <div key={slot.id} className="rounded-md border border-border/60 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">Day</span>
              <Input
                type="number"
                min={1}
                value={slot.dayIndex + 1}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (Number.isFinite(n) && n >= 1) onSlotChange(slot.id, 'dayIndex', n - 1);
                }}
                className="h-9 w-16 px-1 text-center"
              />
              <Input
                type="date"
                value={slot.date}
                onChange={(e) => onSlotChange(slot.id, 'date', e.target.value)}
                className="h-9 flex-1"
              />
              <Button
                size="icon"
                variant="ghost"
                className="h-9 w-9 text-muted-foreground hover:text-red-600"
                onClick={() => onRemoveGame(slot.id)}
                aria-label="Remove game"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Time</Label>
                <Input value={slot.time} onChange={(e) => onSlotChange(slot.id, 'time', e.target.value)} className="h-9" />
              </div>
              <div>
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Code</Label>
                <Input value={slot.code} onChange={(e) => onSlotChange(slot.id, 'code', e.target.value)} className="h-9" />
              </div>
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Opponent</Label>
              <Input value={slot.opponent} onChange={(e) => onSlotChange(slot.id, 'opponent', e.target.value)} className="h-9" />
            </div>
            <div className="flex items-center justify-between border-t border-border/40 pt-2">
              <span className="text-xs text-muted-foreground">Target group</span>
              <TargetGroupPicker
                target={slot.targetGroup ?? null}
                onChange={(g) => onTargetGroupChange(slot.id, g)}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Compact roster editor for mobile — vertical list.
 */
function MobileRosterSheetContent({
  roster,
  availableMainPitchers,
  pickupName,
  onPickupNameChange,
  onAddPickup,
  onAddMainPitcher,
  onRemoveFromRoster,
  onRosterRename,
  onGroupChange,
}: {
  roster: TournamentRosterEntry[];
  availableMainPitchers: Array<{ id: string; name: string }>;
  pickupName: string;
  onPickupNameChange: (v: string) => void;
  onAddPickup: () => void;
  onAddMainPitcher: (id: string) => void;
  onRemoveFromRoster: (id: string) => void;
  onRosterRename: (id: string, name: string) => void;
  onGroupChange: (id: string, group: RotationGroup) => void;
}) {
  return (
    <div className="space-y-3">
      {roster.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">
          Roster is empty. Add pickups below or add players from your main roster.
        </p>
      ) : (
        <div className="space-y-2">
          {roster.map((r) => (
            <div key={r.id} className="flex items-center gap-2 rounded-md border border-border/60 p-2">
              <Input
                value={r.name}
                onChange={(e) => onRosterRename(r.id, e.target.value)}
                className="h-9 flex-1"
              />
              {r.isPickup && (
                <span className="text-[9px] uppercase tracking-wider bg-blue-500/15 text-blue-700 dark:text-blue-300 px-1 rounded">PU</span>
              )}
              <GroupToggle group={r.group ?? null} onChange={(g) => onGroupChange(r.id, g)} />
              <Button
                size="icon"
                variant="ghost"
                className="h-9 w-9 text-muted-foreground hover:text-red-600"
                onClick={() => onRemoveFromRoster(r.id)}
                aria-label="Remove"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2 pt-3 border-t border-border/40">
        <UserPlus className="w-4 h-4 text-muted-foreground shrink-0" />
        <Input
          value={pickupName}
          onChange={(e) => onPickupNameChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onAddPickup(); } }}
          placeholder="Pickup player name…"
          className="h-9 flex-1"
        />
        <Button size="sm" onClick={onAddPickup} disabled={!pickupName.trim()}>Add</Button>
      </div>
      {availableMainPitchers.length > 0 && (
        <div className="pt-3 border-t border-border/40 space-y-2">
          <span className="text-xs text-muted-foreground">Add from main roster:</span>
          <div className="flex flex-wrap gap-2">
            {availableMainPitchers.map((p) => (
              <Button
                key={p.id}
                size="sm"
                variant="outline"
                onClick={() => onAddMainPitcher(p.id)}
                className="h-8"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                {p.name}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Catchers-by-day editor. One row per day; chips for every rostered player
 * with an active state showing who's catching that day. Tap to toggle.
 */
function CatchersEditorCard({
  schedule,
  roster,
  catchers,
  onToggle,
}: {
  schedule: TournamentGameSlot[];
  roster: TournamentRosterEntry[];
  catchers: CatchersByDay;
  onToggle: (dayIndex: number, pitcherId: string) => void;
}) {
  const dayIndices = useMemo(
    () => Array.from(new Set(schedule.map((s) => s.dayIndex))).sort((a, b) => a - b),
    [schedule],
  );

  return (
    <Card className="glass-card">
      <CardHeader className="pb-2">
        <CardTitle className="font-display text-base flex items-center gap-2">
          <Shield className="w-4 h-4" />
          Catchers by day
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Tap a player on a day they're catching. They'll be blocked from pitching that day —
          the game grid picks it up automatically.
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {dayIndices.length === 0 && (
          <p className="text-sm text-muted-foreground italic">Add games to the schedule first.</p>
        )}
        {roster.length === 0 && (
          <p className="text-sm text-muted-foreground italic">Add players to the roster first.</p>
        )}
        {dayIndices.map((d) => {
          const catcherIds = catchers[String(d)] ?? [];
          const catchingPlayers = roster.filter((p) => catcherIds.includes(p.id));
          const availablePlayers = roster.filter((p) => !catcherIds.includes(p.id));
          return (
            <div key={d} className="flex flex-wrap items-center gap-1.5 py-1">
              <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold w-14 shrink-0">
                {dayLabel(d)}
              </span>
              {catchingPlayers.length === 0 && availablePlayers.length > 0 && (
                <span className="text-xs text-muted-foreground italic">None</span>
              )}
              {catchingPlayers.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onToggle(d, p.id)}
                  className="text-xs rounded px-2 py-0.5 border bg-orange-500/15 border-orange-500/50 text-orange-800 dark:text-orange-200 font-semibold flex items-center gap-1 hover:bg-orange-500/25"
                  title="Remove catcher"
                >
                  <Shield className="w-3 h-3" />
                  {p.name}
                  <span className="ml-0.5 opacity-60">×</span>
                </button>
              ))}
              {availablePlayers.length > 0 && (
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="text-xs rounded px-2 py-0.5 border border-dashed border-border/60 text-muted-foreground hover:border-orange-400/60 hover:text-foreground flex items-center gap-0.5"
                    >
                      <Plus className="w-3 h-3" />
                      Add catcher
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-52 p-1.5 max-h-64 overflow-y-auto">
                    <div className="space-y-0.5">
                      {availablePlayers.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => onToggle(d, p.id)}
                          className="w-full text-left text-sm rounded px-2 py-1 hover:bg-muted"
                        >
                          {p.name}
                        </button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
