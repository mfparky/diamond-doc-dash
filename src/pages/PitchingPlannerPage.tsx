import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Save,
  CheckCircle2,
  AlertTriangle,
  Info,
  Plus,
  Trash2,
  UserPlus,
  Users,
  Wand2,
  Shield,
  FileDown,
  Minus,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import hawksLogo from '@/assets/hawks-logo.png';
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
import { useAllStatSnapshots } from '@/hooks/use-stat-snapshots';
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
  getTier,
  DAILY_MAX,
  type PitchEntry,
} from '@/lib/tournament-pitch-rules';
import { suggestGroups, suggestPitchBudget } from '@/lib/pitcher-tiering';
import type { StatValue } from '@/lib/stat-csv';

/**
 * PitchingPlannerPage — a game-centric planner for weekend or tournament use.
 *
 * The game is the atom. Coach adds games, assigns pitchers per game, and the
 * OBA rest rules are enforced live. Roster editing, group tagging, catcher
 * assignments, notes, and print are all supporting surfaces.
 *
 * Reuses the same tournament_pitch_plans table as the old tournament planner,
 * so existing plans still load and save. The `?t=` query param picks which
 * plan is active; Cooperstown seeds automatically for first-time coaches.
 */

// ---- Helpers ------------------------------------------------------------

function effectivePitches(cell: PitchCell | undefined): number {
  if (!cell) return 0;
  if (typeof cell.actual === 'number') return cell.actual;
  if (typeof cell.planned === 'number') return cell.planned;
  return 0;
}

function pitcherEntries(entries: PitchEntries, pitcherId: string, schedule: TournamentGameSlot[]): PitchEntry[] {
  return schedule.map((slot) => {
    const cell = entries[entryKey(pitcherId, slot.id)];
    const day = typeof cell?.dayOverride === 'number' ? cell.dayOverride : slot.dayIndex;
    return { day, gameIndex: slot.gameIndex, pitches: effectivePitches(cell) };
  });
}

function buildEmptySchedule(): TournamentGameSlot[] {
  return [];
}

function friendlyDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

// ---- Main page ----------------------------------------------------------

export default function PitchingPlannerPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeSlug = searchParams.get('t') ?? COOPERSTOWN_TOURNAMENT_SLUG;

  const { pitchers, isLoading: pitchersLoading } = usePitchers();
  const pitcherIds = useMemo(() => pitchers.map((p) => p.id), [pitchers]);
  const { byPitcher: statsByPitcher } = useAllStatSnapshots(pitcherIds);
  const { summaries, isLoading: summariesLoading, createPlan, deletePlan, refetch: refetchSummaries } = useTournamentPlans();

  const activeSummary = summaries.find((s) => s.slug === activeSlug);
  const activeName = activeSummary?.name
    ?? (activeSlug === COOPERSTOWN_TOURNAMENT_SLUG ? COOPERSTOWN_TOURNAMENT_NAME : activeSlug);
  const activeDefault = activeSlug === COOPERSTOWN_TOURNAMENT_SLUG ? COOPERSTOWN_2025 : buildEmptySchedule();

  const { plan, isLoading: planLoading, save } = useTournamentPlan(activeSlug, activeName, activeDefault);

  const [schedule, setSchedule] = useState<TournamentGameSlot[]>(activeDefault);
  const [entries, setEntries] = useState<PitchEntries>({});
  const [roster, setRoster] = useState<TournamentRosterEntry[]>([]);
  const [catchers, setCatchers] = useState<CatchersByDay>({});
  const [notes, setNotes] = useState('');
  const [savedFlash, setSavedFlash] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [rosterExpanded, setRosterExpanded] = useState(false);
  const [rosterSeeded, setRosterSeeded] = useState(false);

  useEffect(() => {
    if (!plan) return;
    setSchedule(plan.schedule.length > 0 ? plan.schedule : activeDefault);
    setEntries(plan.entries);
    setRoster(plan.roster);
    setCatchers(plan.catchers);
    setNotes(plan.notes);
    setDirty(false);
    setRosterSeeded(plan.roster.length > 0);
  }, [plan]); // eslint-disable-line react-hooks/exhaustive-deps

  // Seed the roster from the main pitchers list the first time a plan loads
  // without one. Marked dirty so a Save persists the seed.
  useEffect(() => {
    if (rosterSeeded) return;
    if (!plan) return;
    if (plan.roster.length > 0) return;
    if (pitchers.length === 0) return;
    setRoster(pitchers.map((p) => ({ id: p.id, name: p.name, isPickup: false })));
    setRosterSeeded(true);
    setDirty(true);
  }, [plan, pitchers, rosterSeeded]);

  const rosterIds = useMemo(() => new Set(roster.map((r) => r.id)), [roster]);
  const availableMainPitchers = useMemo(
    () => pitchers.filter((p) => !rosterIds.has(p.id)),
    [pitchers, rosterIds],
  );

  // Stats lookup keyed by roster id — pickups have no snapshot.
  const rosterStatsById = useMemo(() => {
    const out: Record<string, { stats: Record<string, StatValue> | null }> = {};
    for (const r of roster) {
      const snap = statsByPitcher.get(r.id)?.[0];
      out[r.id] = { stats: snap?.stats ?? null };
    }
    return out;
  }, [roster, statsByPitcher]);

  // Sort games by (dayIndex, gameIndex) so the list always reads chronologically.
  const sortedSchedule = useMemo(
    () => [...schedule].sort((a, b) => a.dayIndex - b.dayIndex || a.gameIndex - b.gameIndex),
    [schedule],
  );

  // ---- Handlers ----

  const handleCellChange = (pitcherId: string, slotId: string, field: 'planned' | 'actual', raw: string | number) => {
    const parsed = raw === '' || raw === null ? null : Math.max(0, Math.min(DAILY_MAX, Math.trunc(Number(raw))));
    if (raw !== '' && raw !== null && !Number.isFinite(parsed)) return;
    setEntries((prev) => {
      const key = entryKey(pitcherId, slotId);
      const existing: PitchCell = prev[key] ?? { planned: null, actual: null };
      const next: PitchCell = { ...existing, [field]: parsed };
      const out = { ...prev };
      if (next.planned === null && next.actual === null && (next.dayOverride ?? null) === null) {
        delete out[key];
      } else {
        out[key] = next;
      }
      return out;
    });
    setDirty(true);
  };

  const handleRemovePitcher = (pitcherId: string, slotId: string) => {
    setEntries((prev) => {
      const key = entryKey(pitcherId, slotId);
      const out = { ...prev };
      delete out[key];
      return out;
    });
    setDirty(true);
  };

  const handleSlotChange = (slotId: string, field: keyof TournamentGameSlot, value: string | number | null) => {
    setSchedule((prev) => prev.map((s) => (s.id === slotId ? { ...s, [field]: value } : s)));
    setDirty(true);
  };

  const handleAddGame = () => {
    // Add a new game to whatever day already has games (or Day 1 if empty).
    // Coach edits date/time inline immediately after.
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
    setEntries((prev) => {
      const out: PitchEntries = {};
      for (const [k, v] of Object.entries(prev)) {
        if (!k.endsWith(`:${slotId}`)) out[k] = v;
      }
      return out;
    });
    setDirty(true);
  };

  const handleAddPickup = (name: string) => {
    if (!name.trim()) return;
    const id = `pu_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    setRoster((prev) => [...prev, { id, name: name.trim(), isPickup: true }]);
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

  const isCatchingOn = (pitcherId: string, dayIndex: number) => {
    return (catchers[String(dayIndex)] ?? []).includes(pitcherId);
  };

  const handleSuggestGroups = () => {
    const inputs = roster.map((r) => ({
      pitcherId: r.id,
      name: r.name,
      stats: (rosterStatsById[r.id]?.stats ?? null),
    }));
    const suggestions = suggestGroups(inputs, { groupASize: 5 });
    const byId = new Map(suggestions.map((s) => [s.pitcherId, s]));
    setRoster((prev) => prev.map((r) => {
      const s = byId.get(r.id);
      return s ? { ...r, group: s.suggestedGroup } : r;
    }));
    setDirty(true);
  };

  /**
   * Auto-fill a single game — one click, respects rules + catchers + groups.
   * Uses smart per-pitcher budget: A-arms cap at 45, B-arms at 30, scaled
   * down by IP so a fresh depth arm doesn't get 30 pitches on Day 1.
   */
  const handleAutoFillGame = (slot: TournamentGameSlot) => {
    // Pool: target group if set, otherwise the whole roster.
    const pool = roster.filter((p) => (slot.targetGroup ? p.group === slot.targetGroup : true));
    const perGame = 3;

    // Working copy of entries (existing state stays untouched until we commit).
    const working: PitchEntries = { ...entries };
    // Clear planned in this game so re-runs are idempotent.
    for (const p of roster) {
      const key = entryKey(p.id, slot.id);
      const cell = working[key];
      if (!cell) continue;
      if (cell.actual === null && (cell.dayOverride ?? null) === null) delete working[key];
      else working[key] = { ...cell, planned: null };
    }

    const eligible = pool
      .filter((p) => !isCatchingOn(p.id, slot.dayIndex))
      .map((p) => {
        const rowEntries = pitcherEntries(working, p.id, sortedSchedule);
        const check = isEligibleForGame({
          entries: rowEntries,
          targetDay: slot.dayIndex,
          targetGameIndex: slot.gameIndex,
          isCatchingToday: isCatchingOn(p.id, slot.dayIndex),
        });
        return { p, check };
      })
      .filter(({ check }) => check.eligible && (check.remaining ?? 0) > 0);

    // Tournament totals so we spread work evenly.
    const totals = new Map<string, number>();
    for (const p of roster) {
      totals.set(p.id, pitcherEntries(working, p.id, sortedSchedule).reduce((s, e) => s + e.pitches, 0));
    }
    eligible.sort((a, b) => (totals.get(a.p.id) ?? 0) - (totals.get(b.p.id) ?? 0));

    for (const { p, check } of eligible.slice(0, perGame)) {
      const ip = typeof rosterStatsById[p.id]?.stats?.pit_ip === 'number'
        ? (rosterStatsById[p.id]!.stats!.pit_ip as number)
        : 0;
      const budget = suggestPitchBudget(p.group ?? null, ip, 30);
      const cap = Math.min(budget, check.remaining ?? budget);
      if (cap <= 0) continue;
      const key = entryKey(p.id, slot.id);
      const existing: PitchCell = working[key] ?? { planned: null, actual: null };
      working[key] = { ...existing, planned: cap };
    }

    setEntries(working);
    setDirty(true);
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

  const handleCreatePlan = async (name: string) => {
    const slug = slugify(name);
    if (!slug) return;
    const ok = await createPlan(slug, name.trim(), [], []);
    if (ok) {
      setNewDialogOpen(false);
      setSearchParams({ t: slug }, { replace: true });
    }
  };

  const handleDeletePlan = async () => {
    const ok = await deletePlan(activeSlug);
    if (ok) {
      const next = summaries.find((s) => s.slug !== activeSlug)?.slug ?? COOPERSTOWN_TOURNAMENT_SLUG;
      setSearchParams({ t: next }, { replace: true });
    }
  };

  const handlePrint = () => window.print();

  const printedDateRange = useMemo(() => {
    const dated = schedule.filter((s) => s.date).sort((a, b) => a.date.localeCompare(b.date));
    if (dated.length === 0) return '';
    const fmt = (iso: string) => {
      const d = new Date(iso + 'T12:00:00');
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    };
    const first = dated[0].date;
    const last = dated[dated.length - 1].date;
    return first === last ? fmt(first) : `${fmt(first)} — ${fmt(last)}`;
  }, [schedule]);

  const isLoading = pitchersLoading || planLoading || summariesLoading;
  const canDelete = summaries.length > 1;

  return (
    <div className="min-h-screen bg-background">
      {/* Print view — hidden on screen, sole content when printing. */}
      <PrintableTournamentPlan
        tournamentName={activeName}
        dateRange={printedDateRange}
        schedule={sortedSchedule}
        roster={roster}
        entries={entries}
        catchers={catchers}
        notes={notes}
      />

      <div className="planner-screen container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-4xl space-y-4">
        {/* Header */}
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/" aria-label="Back to dashboard">
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="font-display text-xl sm:text-2xl font-bold text-foreground truncate">
              {activeName}
            </h1>
            <p className="text-xs text-muted-foreground">
              Pitching planner · OBA 12U/13U rest rules enforced
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select
              className="h-9 rounded-md border border-border/60 bg-background px-2 text-sm max-w-[160px]"
              value={activeSlug}
              onChange={(e) => setSearchParams({ t: e.target.value }, { replace: true })}
              aria-label="Switch plan"
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
                <Button variant="outline" size="sm" title="New plan">
                  <Plus className="w-4 h-4" />
                </Button>
              </DialogTrigger>
              <NewPlanDialog onCreate={handleCreatePlan} />
            </Dialog>
            {canDelete && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" title="Delete plan">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete {activeName}?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Removes the plan and all pitch entries. Cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeletePlan}>Delete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            <Button variant="outline" size="sm" onClick={handlePrint} title="Print / save as PDF">
              <FileDown className="w-4 h-4" />
              <span className="hidden sm:inline ml-1">PDF</span>
            </Button>
            <Button onClick={handleSave} disabled={!dirty && !savedFlash}>
              {savedFlash ? <CheckCircle2 className="w-4 h-4 mr-1" /> : <Save className="w-4 h-4 mr-1" />}
              {savedFlash ? 'Saved' : 'Save'}
            </Button>
          </div>
        </div>

        {/* Rules mini-legend */}
        <div className="rounded-md border border-border/50 bg-muted/10 p-2 flex items-start gap-2 text-[11px] text-muted-foreground">
          <Info className="w-3.5 h-3.5 text-blue-600 mt-0.5 shrink-0" />
          <span>
            <strong>1–30</strong> no rest · <strong>31–45</strong> 1 day · <strong>46–60</strong> 2 days ·
            <strong> 61–75</strong> 3 days · <strong>76–85</strong> 4 days.
            Also: 85 daily max, 2 games max in any 2-day window, no 4 straight days,
            same-day 2nd game only if 1st was ≤ 30.
          </span>
        </div>

        {/* Roster section — collapsible */}
        <RosterSection
          expanded={rosterExpanded}
          onToggleExpanded={() => setRosterExpanded((v) => !v)}
          roster={roster}
          availableMainPitchers={availableMainPitchers}
          onGroupChange={handleGroupChange}
          onRename={handleRosterRename}
          onRemove={handleRemoveFromRoster}
          onAddPickup={handleAddPickup}
          onAddMain={handleAddMainPitcher}
          onSuggestGroups={handleSuggestGroups}
        />

        {/* Games list */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-semibold text-foreground">
              Games ({sortedSchedule.length})
            </h2>
            <Button size="sm" variant="outline" onClick={handleAddGame}>
              <Plus className="w-4 h-4 mr-1" />
              Add game
            </Button>
          </div>

          {isLoading && (
            <Card className="glass-card">
              <CardContent className="p-6 text-sm text-muted-foreground">Loading…</CardContent>
            </Card>
          )}

          {!isLoading && sortedSchedule.length === 0 && (
            <Card className="glass-card">
              <CardContent className="p-6 text-sm text-muted-foreground italic">
                No games yet. Tap <strong>Add game</strong> to start planning.
              </CardContent>
            </Card>
          )}

          {!isLoading && sortedSchedule.map((slot) => (
            <GameCard
              key={slot.id}
              slot={slot}
              schedule={sortedSchedule}
              roster={roster}
              entries={entries}
              catchers={catchers}
              onSlotChange={handleSlotChange}
              onTargetGroupChange={handleTargetGroupChange}
              onRemoveGame={handleRemoveGame}
              onCellChange={handleCellChange}
              onRemovePitcher={handleRemovePitcher}
              onToggleCatcher={handleToggleCatcher}
              onAutoFillGame={handleAutoFillGame}
            />
          ))}

          {!isLoading && sortedSchedule.length > 0 && (
            <Button variant="outline" onClick={handleAddGame} className="w-full">
              <Plus className="w-4 h-4 mr-1" />
              Add another game
            </Button>
          )}
        </div>

        {/* Notes */}
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
              placeholder="Rotation strategy, injury notes, bullpen availability, anything worth remembering."
              className="text-sm"
            />
          </CardContent>
        </Card>
      </div>

      {/* Print stylesheet */}
      <style>{`
        @media print {
          @page { size: letter landscape; margin: 0.4in; }
          html, body { background: white !important; color: #111 !important; font-family: 'Helvetica Neue', Arial, sans-serif !important; }
          nav, aside { display: none !important; }
          .planner-screen { display: none !important; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .tournament-print { display: block !important; }
        }
        .tournament-print { display: none; }
      `}</style>
    </div>
  );
}

// ---- Sub-components -----------------------------------------------------

function RosterSection({
  expanded,
  onToggleExpanded,
  roster,
  availableMainPitchers,
  onGroupChange,
  onRename,
  onRemove,
  onAddPickup,
  onAddMain,
  onSuggestGroups,
}: {
  expanded: boolean;
  onToggleExpanded: () => void;
  roster: TournamentRosterEntry[];
  availableMainPitchers: Array<{ id: string; name: string }>;
  onGroupChange: (id: string, group: RotationGroup) => void;
  onRename: (id: string, name: string) => void;
  onRemove: (id: string) => void;
  onAddPickup: (name: string) => void;
  onAddMain: (id: string) => void;
  onSuggestGroups: () => void;
}) {
  const [pickupName, setPickupName] = useState('');
  const groupACount = roster.filter((r) => r.group === 'A').length;
  const groupBCount = roster.filter((r) => r.group === 'B').length;

  return (
    <Card className="glass-card">
      <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <CardTitle className="font-display text-base flex items-center gap-2">
            <Users className="w-4 h-4" />
            Roster
          </CardTitle>
          <span className="text-xs text-muted-foreground">
            {roster.length} player{roster.length === 1 ? '' : 's'}
            {groupACount > 0 && ` · A ${groupACount}`}
            {groupBCount > 0 && ` · B ${groupBCount}`}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {roster.length > 0 && (
            <Button size="sm" variant="ghost" onClick={onSuggestGroups} title="Suggest A/B from stats">
              <Wand2 className="w-4 h-4" />
              <span className="hidden sm:inline ml-1">Suggest A/B</span>
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={onToggleExpanded}>
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
        </div>
      </CardHeader>
      {expanded && (
        <CardContent className="space-y-3">
          {roster.length === 0 && (
            <p className="text-sm text-muted-foreground italic">
              Roster is empty. Add pickups or players from the main roster below.
            </p>
          )}
          {roster.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {roster.map((r) => (
                <div key={r.id} className="flex items-center gap-2 rounded-md border border-border/60 bg-background px-2 py-1">
                  <Input
                    value={r.name}
                    onChange={(e) => onRename(r.id, e.target.value)}
                    className="h-8 flex-1 border-0 shadow-none px-1 focus-visible:ring-1"
                  />
                  {r.isPickup && (
                    <span className="text-[9px] uppercase tracking-wider bg-blue-500/15 text-blue-700 dark:text-blue-300 px-1 rounded">PU</span>
                  )}
                  <GroupToggle group={r.group ?? null} onChange={(g) => onGroupChange(r.id, g)} />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-muted-foreground hover:text-red-600"
                    onClick={() => onRemove(r.id)}
                    aria-label="Remove"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2 pt-2 border-t border-border/40">
            <UserPlus className="w-4 h-4 text-muted-foreground" />
            <Input
              value={pickupName}
              onChange={(e) => setPickupName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (pickupName.trim()) { onAddPickup(pickupName); setPickupName(''); }
                }
              }}
              placeholder="Pickup player name…"
              className="h-8 flex-1"
            />
            <Button size="sm" onClick={() => { if (pickupName.trim()) { onAddPickup(pickupName); setPickupName(''); } }} disabled={!pickupName.trim()}>
              Add
            </Button>
          </div>

          {availableMainPitchers.length > 0 && (
            <div className="pt-2 border-t border-border/40 space-y-2">
              <span className="text-xs text-muted-foreground">From main roster:</span>
              <div className="flex flex-wrap gap-1.5">
                {availableMainPitchers.map((p) => (
                  <Button key={p.id} size="sm" variant="outline" className="h-7 text-xs" onClick={() => onAddMain(p.id)}>
                    <Plus className="w-3 h-3 mr-1" />
                    {p.name}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

function GameCard({
  slot,
  schedule,
  roster,
  entries,
  catchers,
  onSlotChange,
  onTargetGroupChange,
  onRemoveGame,
  onCellChange,
  onRemovePitcher,
  onToggleCatcher,
  onAutoFillGame,
}: {
  slot: TournamentGameSlot;
  schedule: TournamentGameSlot[];
  roster: TournamentRosterEntry[];
  entries: PitchEntries;
  catchers: CatchersByDay;
  onSlotChange: (slotId: string, field: keyof TournamentGameSlot, value: string | number | null) => void;
  onTargetGroupChange: (slotId: string, target: 'A' | 'B' | null) => void;
  onRemoveGame: (slotId: string) => void;
  onCellChange: (pitcherId: string, slotId: string, field: 'planned' | 'actual', raw: string | number) => void;
  onRemovePitcher: (pitcherId: string, slotId: string) => void;
  onToggleCatcher: (dayIndex: number, pitcherId: string) => void;
  onAutoFillGame: (slot: TournamentGameSlot) => void;
}) {
  const dayCatcherIds = catchers[String(slot.dayIndex)] ?? [];

  const assigned = useMemo(() => roster.filter((p) => {
    const cell = entries[entryKey(p.id, slot.id)];
    return cell && ((cell.planned ?? null) !== null || (cell.actual ?? null) !== null);
  }), [roster, entries, slot.id]);

  const gameTotal = assigned.reduce((s, p) => s + effectivePitches(entries[entryKey(p.id, slot.id)]), 0);

  return (
    <Card className="glass-card">
      <CardHeader className="pb-2 space-y-2">
        {/* Row 1: date · time · opponent · remove */}
        <div className="grid grid-cols-1 sm:grid-cols-[100px_90px_110px_1fr_36px] gap-2 items-center">
          <div className="flex items-center gap-1">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground shrink-0">Day</span>
            <Input
              type="number"
              min={1}
              value={slot.dayIndex + 1}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (Number.isFinite(n) && n >= 1) onSlotChange(slot.id, 'dayIndex', n - 1);
              }}
              className="h-8 px-1 text-center w-12"
            />
          </div>
          <Input
            type="date"
            value={slot.date}
            onChange={(e) => onSlotChange(slot.id, 'date', e.target.value)}
            className="h-8"
          />
          <Input
            value={slot.time}
            onChange={(e) => onSlotChange(slot.id, 'time', e.target.value)}
            className="h-8"
            placeholder="Time"
          />
          <Input
            value={slot.opponent}
            onChange={(e) => onSlotChange(slot.id, 'opponent', e.target.value)}
            className="h-8"
            placeholder="Opponent"
          />
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-muted-foreground hover:text-red-600"
            onClick={() => onRemoveGame(slot.id)}
            aria-label="Remove game"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>

        {/* Row 2: friendly summary + target group + code */}
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">
            {slot.date ? friendlyDate(slot.date) : dayLabel(slot.dayIndex)}
            {slot.time && ` · ${slot.time}`}
          </span>
          {slot.opponent && <span>· vs {slot.opponent}</span>}
          <Input
            value={slot.code}
            onChange={(e) => onSlotChange(slot.id, 'code', e.target.value)}
            className="h-6 w-20 text-xs px-1"
            placeholder="Code"
          />
          <div className="ml-auto flex items-center gap-1">
            <span className="text-[10px] uppercase tracking-wider">Plan</span>
            <TargetGroupPicker target={slot.targetGroup ?? null} onChange={(g) => onTargetGroupChange(slot.id, g)} />
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-2">
        {/* Catching today */}
        <CatchersInline
          dayIndex={slot.dayIndex}
          roster={roster}
          catcherIds={dayCatcherIds}
          onToggle={onToggleCatcher}
        />

        {/* Assigned pitchers */}
        {assigned.length === 0 && (
          <p className="text-sm text-muted-foreground italic px-1">
            No pitchers assigned yet. Add one below or tap Auto-fill.
          </p>
        )}
        {assigned.map((p) => (
          <AssignedPitcherRow
            key={p.id}
            pitcher={p}
            slot={slot}
            schedule={schedule}
            cell={entries[entryKey(p.id, slot.id)]}
            rowEntries={pitcherEntries(entries, p.id, schedule)}
            isCatchingToday={dayCatcherIds.includes(p.id)}
            onCellChange={onCellChange}
            onRemove={() => onRemovePitcher(p.id, slot.id)}
          />
        ))}

        {/* Add pitcher */}
        <div className="flex items-center gap-2 pt-2 border-t border-border/40">
          <AddPitcherPicker
            slot={slot}
            schedule={schedule}
            roster={roster}
            entries={entries}
            catcherIds={dayCatcherIds}
            onPick={(pitcherId) => onCellChange(pitcherId, slot.id, 'planned', 0)}
          />
          <Button size="sm" variant="outline" onClick={() => onAutoFillGame(slot)}>
            <Wand2 className="w-4 h-4 mr-1" />
            Auto-fill
          </Button>
          <span className="ml-auto text-xs text-muted-foreground">
            Total: <strong className="text-foreground">{gameTotal}</strong>
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function CatchersInline({
  dayIndex,
  roster,
  catcherIds,
  onToggle,
}: {
  dayIndex: number;
  roster: TournamentRosterEntry[];
  catcherIds: string[];
  onToggle: (dayIndex: number, pitcherId: string) => void;
}) {
  const catching = roster.filter((r) => catcherIds.includes(r.id));
  const notCatching = roster.filter((r) => !catcherIds.includes(r.id));
  return (
    <div className="flex flex-wrap items-center gap-1.5 py-1">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground shrink-0">
        <Shield className="w-3 h-3 inline mr-0.5" />
        Catching:
      </span>
      {catching.length === 0 && notCatching.length > 0 && (
        <span className="text-xs text-muted-foreground italic">None</span>
      )}
      {catching.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => onToggle(dayIndex, p.id)}
          className="text-xs rounded px-1.5 py-0.5 border bg-orange-500/15 border-orange-500/50 text-orange-800 dark:text-orange-200 font-semibold flex items-center gap-1 hover:bg-orange-500/25"
          title="Remove"
        >
          {p.name}
          <span className="opacity-60">×</span>
        </button>
      ))}
      {notCatching.length > 0 && (
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="text-xs rounded px-1.5 py-0.5 border border-dashed border-border/60 text-muted-foreground hover:border-orange-400/60 hover:text-foreground flex items-center gap-0.5"
            >
              <Plus className="w-3 h-3" />
              Add
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-1.5 max-h-52 overflow-y-auto">
            <div className="space-y-0.5">
              {notCatching.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onToggle(dayIndex, p.id)}
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
}

function AssignedPitcherRow({
  pitcher,
  slot,
  schedule,
  cell,
  rowEntries,
  isCatchingToday,
  onCellChange,
  onRemove,
}: {
  pitcher: TournamentRosterEntry;
  slot: TournamentGameSlot;
  schedule: TournamentGameSlot[];
  cell: PitchCell | undefined;
  rowEntries: PitchEntry[];
  isCatchingToday: boolean;
  onCellChange: (pitcherId: string, slotId: string, field: 'planned' | 'actual', raw: string | number) => void;
  onRemove: () => void;
}) {
  const check = isEligibleForGame({
    entries: rowEntries,
    targetDay: slot.dayIndex,
    targetGameIndex: slot.gameIndex,
    isCatchingToday,
  });
  const offPlan = (!!slot.targetGroup && !!pitcher.group && pitcher.group !== slot.targetGroup);

  return (
    <div className="rounded-md border border-border/50 p-2 space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-semibold text-sm flex-1 truncate min-w-0">{pitcher.name}</span>
        {pitcher.group && <GroupLetterInline group={pitcher.group} />}
        {pitcher.isPickup && (
          <span className="text-[9px] uppercase tracking-wider bg-blue-500/15 text-blue-700 dark:text-blue-300 px-1 rounded">PU</span>
        )}
        <EligibilityBadge check={check} offPlan={offPlan} slotGroup={slot.targetGroup ?? null} pitcherGroup={pitcher.group ?? null} />
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6 text-muted-foreground hover:text-red-600 shrink-0"
          onClick={onRemove}
          aria-label="Remove pitcher from this game"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
      <PitchStepper
        label="Planned"
        value={cell?.planned ?? null}
        onChange={(v) => onCellChange(pitcher.id, slot.id, 'planned', v)}
      />
      <PitchStepper
        label="Actual"
        emphasize
        value={cell?.actual ?? null}
        onChange={(v) => onCellChange(pitcher.id, slot.id, 'actual', v)}
      />
    </div>
  );
}

function PitchStepper({
  label,
  value,
  onChange,
  emphasize,
}: {
  label: string;
  value: number | null;
  onChange: (raw: string) => void;
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
      <Button type="button" size="sm" variant="outline" className="h-9 w-9 p-0 text-xs font-semibold shrink-0" onClick={() => step(-5)} disabled={current <= 0}>−5</Button>
      <Button type="button" size="sm" variant="outline" className="h-9 w-8 p-0 shrink-0" onClick={() => step(-1)} disabled={current <= 0}><Minus className="w-4 h-4" /></Button>
      <Input
        type="number"
        inputMode="numeric"
        min={0}
        max={DAILY_MAX}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className={`h-9 flex-1 text-center ${emphasize ? 'font-bold text-lg' : 'text-base'}`}
        placeholder="—"
      />
      <Button type="button" size="sm" variant="outline" className="h-9 w-8 p-0 shrink-0" onClick={() => step(1)} disabled={current >= DAILY_MAX}><Plus className="w-4 h-4" /></Button>
      <Button type="button" size="sm" variant="outline" className="h-9 w-9 p-0 text-xs font-semibold shrink-0" onClick={() => step(5)} disabled={current >= DAILY_MAX}>+5</Button>
    </div>
  );
}

function AddPitcherPicker({
  slot,
  schedule,
  roster,
  entries,
  catcherIds,
  onPick,
}: {
  slot: TournamentGameSlot;
  schedule: TournamentGameSlot[];
  roster: TournamentRosterEntry[];
  entries: PitchEntries;
  catcherIds: string[];
  onPick: (pitcherId: string) => void;
}) {
  const [open, setOpen] = useState(false);

  const options = useMemo(() => {
    return roster
      .filter((p) => {
        // Skip anyone already assigned to this slot.
        const cell = entries[entryKey(p.id, slot.id)];
        return !cell || (cell.planned === null && cell.actual === null);
      })
      .map((p) => {
        const rowEntries = pitcherEntries(entries, p.id, schedule);
        const isCatchingToday = catcherIds.includes(p.id);
        const check = isEligibleForGame({
          entries: rowEntries,
          targetDay: slot.dayIndex,
          targetGameIndex: slot.gameIndex,
          isCatchingToday,
        });
        return { p, check };
      })
      .sort((a, b) => {
        // Eligible first, sorted by remaining descending.
        if (a.check.eligible !== b.check.eligible) return a.check.eligible ? -1 : 1;
        return (b.check.remaining ?? 0) - (a.check.remaining ?? 0);
      });
  }, [roster, entries, slot, schedule, catcherIds]);

  const eligibleCount = options.filter((o) => o.check.eligible).length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus className="w-4 h-4 mr-1" />
          Add pitcher
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-1 max-h-72 overflow-y-auto">
        {options.length === 0 && (
          <p className="text-sm text-muted-foreground italic p-2">Whole roster already assigned or ineligible.</p>
        )}
        {options.length > 0 && (
          <>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-2 py-1">
              Eligible ({eligibleCount})
            </div>
            {options.filter((o) => o.check.eligible).map(({ p, check }) => (
              <button
                key={p.id}
                type="button"
                onClick={() => { onPick(p.id); setOpen(false); }}
                className="w-full text-left rounded px-2 py-1.5 hover:bg-muted flex items-center gap-2"
              >
                <span className="flex-1 truncate">
                  <span className="font-medium">{p.name}</span>
                  {p.group && <span className="ml-1"><GroupLetterInline group={p.group} /></span>}
                </span>
                <span className="text-xs text-muted-foreground">up to {check.remaining ?? DAILY_MAX}</span>
              </button>
            ))}
            {options.some((o) => !o.check.eligible) && (
              <>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-2 py-1 mt-1 border-t border-border/40">
                  Ineligible
                </div>
                {options.filter((o) => !o.check.eligible).map(({ p, check }) => (
                  <div key={p.id} className="px-2 py-1.5 opacity-60">
                    <div className="flex items-center gap-2">
                      <span className="flex-1 truncate">
                        <span className="font-medium">{p.name}</span>
                        {p.group && <span className="ml-1"><GroupLetterInline group={p.group} /></span>}
                      </span>
                      <AlertTriangle className="w-3 h-3 text-red-500 shrink-0" />
                    </div>
                    <div className="text-[10px] text-muted-foreground">{check.reason}</div>
                  </div>
                ))}
              </>
            )}
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}

function NewPlanDialog({ onCreate }: { onCreate: (name: string) => void }) {
  const [name, setName] = useState('');
  const slug = slugify(name);
  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>New plan</DialogTitle>
        <DialogDescription>
          Create a fresh plan for a tournament or weekend. Add games and roster after.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-2">
        <Label htmlFor="new-plan-name">Plan name</Label>
        <Input
          id="new-plan-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Fall Classic 2026 or Weekend Sep 14"
        />
        {slug && <p className="text-xs text-muted-foreground">Slug: <code>{slug}</code></p>}
      </div>
      <DialogFooter>
        <Button onClick={() => onCreate(name)} disabled={!name.trim()}>Create</Button>
      </DialogFooter>
    </DialogContent>
  );
}

// ---- Small shared components -------------------------------------------

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
        <span className="truncate max-w-[140px]">Ineligible</span>
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
      <div className={`rounded-md border px-1.5 py-0.5 text-[10px] font-semibold flex items-center gap-1 ${color}`} title={check.reason}>
        <CheckCircle2 className="w-3 h-3 shrink-0" />
        <span className="truncate">Up to {remaining}</span>
      </div>
      {offPlan && (
        <div
          className="rounded-md border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-amber-700 dark:text-amber-300 flex items-center gap-1"
          title={`Rotation plan: Group ${slotGroup}. This pitcher is Group ${pitcherGroup}.`}
        >
          <AlertTriangle className="w-3 h-3 shrink-0" />
          <span className="truncate">Off-plan</span>
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
            title={active ? `Clear plan (currently ${g})` : `Plan Group ${g}`}
          >
            {g}
          </button>
        );
      })}
    </div>
  );
}

// ---- Print view (copied from old planner for compatibility) ---------------

function PrintableTournamentPlan({
  tournamentName,
  dateRange,
  schedule,
  roster,
  entries,
  catchers,
  notes,
}: {
  tournamentName: string;
  dateRange: string;
  schedule: TournamentGameSlot[];
  roster: TournamentRosterEntry[];
  entries: PitchEntries;
  catchers: CatchersByDay;
  notes: string;
}) {
  const today = new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  const dayIndices = useMemo(
    () => Array.from(new Set(schedule.map((s) => s.dayIndex))).sort((a, b) => a - b),
    [schedule],
  );

  return (
    <div className="tournament-print" style={{ padding: '4pt 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, borderBottom: '1pt solid #222', paddingBottom: 8, marginBottom: 8 }}>
        <img src={hawksLogo} alt="Newmarket Hawks" style={{ height: 40 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 7, textTransform: 'uppercase', letterSpacing: '0.14em', color: '#6b7280', fontWeight: 600 }}>
            Newmarket Hawks · Pitching Plan
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#111', lineHeight: 1.1 }}>{tournamentName}</div>
          <div style={{ fontSize: 10, color: '#4b5563', marginTop: 2 }}>{dateRange}</div>
        </div>
        <div style={{ fontSize: 8, color: '#6b7280', textAlign: 'right' }}>Printed {today}</div>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 9, marginBottom: 8 }}>
        <thead>
          <tr style={{ background: '#f3f4f6' }}>
            <th style={printThStyle}>Day</th>
            <th style={printThStyle}>Time</th>
            <th style={printThStyle}>Code</th>
            <th style={printThStyle}>Opponent</th>
            <th style={printThStyle}>Plan</th>
          </tr>
        </thead>
        <tbody>
          {schedule.map((slot) => (
            <tr key={slot.id} style={{ borderBottom: '0.5pt solid #e5e7eb' }}>
              <td style={printTdStyle}>{dayLabel(slot.dayIndex)}</td>
              <td style={printTdStyle}>{slot.time || 'TBD'}</td>
              <td style={printTdStyle}>{slot.code || '—'}</td>
              <td style={printTdStyle}>{slot.opponent || 'TBD'}</td>
              <td style={{ ...printTdStyle, fontWeight: slot.targetGroup ? 700 : 400 }}>
                {slot.targetGroup ? `Group ${slot.targetGroup}` : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 9, marginBottom: 8 }}>
        <thead>
          <tr style={{ background: '#f3f4f6' }}>
            <th style={{ ...printThStyle, textAlign: 'left', minWidth: 90 }}>Pitcher</th>
            {schedule.map((slot) => (
              <th key={slot.id} style={{ ...printThStyle, minWidth: 60 }}>
                <div>{dayLabel(slot.dayIndex)}</div>
                <div style={{ fontSize: 7, fontWeight: 400, color: '#6b7280' }}>{slot.time || 'TBD'}</div>
                {slot.targetGroup && (
                  <div style={{ fontSize: 7, fontWeight: 700, color: slot.targetGroup === 'A' ? '#1d4ed8' : '#7c3aed' }}>
                    Plan {slot.targetGroup}
                  </div>
                )}
              </th>
            ))}
            <th style={{ ...printThStyle, minWidth: 45 }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {roster.map((p) => {
            const rowTotal = schedule.reduce((s, slot) => s + effectivePitches(entries[entryKey(p.id, slot.id)]), 0);
            return (
              <tr key={p.id} style={{ borderBottom: '0.5pt solid #e5e7eb' }}>
                <td style={{ ...printTdStyle, textAlign: 'left', fontWeight: 600 }}>
                  {p.name}
                  {p.group && (
                    <span style={{
                      marginLeft: 4, fontSize: 7, fontWeight: 700, padding: '0 3px', borderRadius: 2,
                      color: p.group === 'A' ? '#1e3a8a' : '#5b21b6',
                      background: p.group === 'A' ? '#dbeafe' : '#ede9fe',
                    }}>{p.group}</span>
                  )}
                </td>
                {schedule.map((slot) => {
                  const cell = entries[entryKey(p.id, slot.id)];
                  const planned = cell?.planned ?? null;
                  const actual = cell?.actual ?? null;
                  const catching = (catchers[String(slot.dayIndex)] ?? []).includes(p.id);
                  if (catching && planned === null && actual === null) {
                    return <td key={slot.id} style={{ ...printTdStyle, color: '#c2410c', fontWeight: 700 }}>C</td>;
                  }
                  if (planned === null && actual === null) {
                    return <td key={slot.id} style={{ ...printTdStyle, color: '#9ca3af' }}>—</td>;
                  }
                  return (
                    <td key={slot.id} style={printTdStyle}>
                      <span style={{ color: '#6b7280' }}>{planned ?? '—'}</span>
                      <span style={{ color: '#9ca3af', margin: '0 2px' }}>/</span>
                      <span style={{ fontWeight: 700 }}>{actual ?? '—'}</span>
                    </td>
                  );
                })}
                <td style={{ ...printTdStyle, fontWeight: 700 }}>{rowTotal}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
        <div style={{ flex: 1, fontSize: 8, border: '0.5pt solid #e5e7eb', borderRadius: 3, padding: 6 }}>
          <div style={{ fontSize: 7, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#6b7280', fontWeight: 700, marginBottom: 3 }}>Catchers</div>
          {dayIndices.map((d) => {
            const catcherIds = catchers[String(d)] ?? [];
            const names = roster.filter((r) => catcherIds.includes(r.id)).map((r) => r.name);
            return (
              <div key={d} style={{ display: 'flex', gap: 6, marginBottom: 1 }}>
                <span style={{ fontWeight: 700, minWidth: 40 }}>{dayLabel(d)}:</span>
                <span>{names.length > 0 ? names.join(', ') : '—'}</span>
              </div>
            );
          })}
        </div>
        {notes.trim().length > 0 && (
          <div style={{ flex: 2, fontSize: 8, border: '0.5pt solid #e5e7eb', borderRadius: 3, padding: 6 }}>
            <div style={{ fontSize: 7, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#6b7280', fontWeight: 700, marginBottom: 3 }}>Notes</div>
            <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.4 }}>{notes}</div>
          </div>
        )}
      </div>
    </div>
  );
}

const printThStyle: React.CSSProperties = {
  padding: '3pt 5pt', border: '0.5pt solid #d1d5db', fontWeight: 700,
  textTransform: 'uppercase', fontSize: 7, letterSpacing: '0.06em',
  color: '#374151', textAlign: 'center',
};

const printTdStyle: React.CSSProperties = {
  padding: '2pt 5pt', border: '0.5pt solid #e5e7eb', textAlign: 'center', color: '#111',
};
