import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfWeek, differenceInCalendarDays } from 'date-fns';
import { ArrowLeft, ChevronDown, ChevronUp, Dumbbell, ShieldCheck, ShieldAlert, ShieldX, Shield } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { ThemeToggle } from '@/components/ThemeToggle';
import hawksLogo from '@/assets/hawks-logo.png';

// ── Types ───────────────────────────────────────────────────────────────────

interface CompletionRow {
  id: string;
  assignmentId: string;
  pitcherId: string;
  weekStart: string;
  dayOfWeek: number;
  createdAt: string;
}

interface IntegrityResult {
  score: number;
  level: 'clean' | 'watch' | 'suspect' | 'flagged';
  flags: string[];
}

interface AssignmentSummary {
  id: string;
  title: string;
  frequency: number; // times/week
  total: number;
  thisWeek: number;
}

interface PitcherAccountability {
  id: string;
  name: string;
  totalCompletions: number;
  thisWeekCompletions: number;
  thisWeekMax: number;
  assignments: AssignmentSummary[];
  integrity: IntegrityResult;
  dayOfWeekCounts: number[]; // index 0=Mon … 6=Sun
}

// ── Truth metric ─────────────────────────────────────────────────────────────

function computeIntegrity(completions: CompletionRow[]): IntegrityResult {
  if (completions.length === 0) return { score: 100, level: 'clean', flags: [] };

  const flags: string[] = [];
  let deductions = 0;

  // 1. Backdating: recorded more than 1 day after the expected date
  let mismatches = 0;
  for (const c of completions) {
    const expected = new Date(c.weekStart + 'T00:00:00');
    expected.setDate(expected.getDate() + c.dayOfWeek);
    const recorded = new Date(c.createdAt);
    // Only flag if they logged it AFTER the expected day (retroactive), not before
    if (differenceInCalendarDays(recorded, expected) > 1) mismatches++;
  }
  if (mismatches > 0) {
    const rate = mismatches / completions.length;
    flags.push(`${mismatches} backdated entr${mismatches !== 1 ? 'ies' : 'y'}`);
    deductions += Math.min(35, Math.round(rate * 55));
  }

  // 2. Same-day bulk: ≥3 completions logged on the same calendar date
  const byDate = new Map<string, number>();
  for (const c of completions) {
    const d = c.createdAt.slice(0, 10);
    byDate.set(d, (byDate.get(d) || 0) + 1);
  }
  const bulkDays = [...byDate.entries()].filter(([, n]) => n >= 3);
  if (bulkDays.length > 0) {
    const total = bulkDays.reduce((a, [, n]) => a + n, 0);
    flags.push(`${bulkDays.length} day${bulkDays.length !== 1 ? 's' : ''} with bulk entries (${total} logged)`);
    deductions += Math.min(40, bulkDays.length * 15);
  }

  // 3. Rapid burst: consecutive completions < 3 minutes apart
  const sorted = [...completions].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
  let bursts = 0;
  for (let i = 1; i < sorted.length; i++) {
    const gap = new Date(sorted[i].createdAt).getTime() - new Date(sorted[i - 1].createdAt).getTime();
    if (gap < 3 * 60 * 1000) bursts++;
  }
  if (bursts > 0) {
    flags.push(`${bursts} rapid submission${bursts !== 1 ? 's' : ''} (<3 min apart)`);
    deductions += Math.min(30, bursts * 10);
  }

  const score = Math.max(0, 100 - deductions);
  const level: IntegrityResult['level'] =
    score >= 85 ? 'clean' : score >= 65 ? 'watch' : score >= 40 ? 'suspect' : 'flagged';

  return { score, level, flags };
}

// ── Sub-components ────────────────────────────────────────────────────────────

const INTEGRITY_CONFIG = {
  clean:   { label: 'Clean',   Icon: ShieldCheck, color: 'text-green-500',  bg: 'bg-green-500/10',  border: 'border-green-500/30'  },
  watch:   { label: 'Watch',   Icon: Shield,      color: 'text-yellow-500', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30' },
  suspect: { label: 'Suspect', Icon: ShieldAlert, color: 'text-orange-500', bg: 'bg-orange-500/10', border: 'border-orange-500/30' },
  flagged: { label: 'Flagged', Icon: ShieldX,     color: 'text-red-500',    bg: 'bg-red-500/10',    border: 'border-red-500/30'    },
};

function IntegrityBadge({ level, score }: { level: IntegrityResult['level']; score: number }) {
  const { label, Icon, color, bg, border } = INTEGRITY_CONFIG[level];
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border', color, bg, border)}>
      <Icon className="w-3 h-3" />
      {label} · {score}
    </span>
  );
}

function WeekBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2 min-w-[80px]">
      <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs tabular-nums text-muted-foreground shrink-0">{value}/{max}</span>
    </div>
  );
}

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const DAY_FULL   = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function DayHeatStrip({ counts }: { counts: number[] }) {
  const max = Math.max(...counts, 1);
  return (
    <div>
      <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-2">Activity by Day</p>
      <div className="flex gap-1 items-end">
        {DAY_LABELS.map((label, i) => {
          const count = counts[i];
          const barH = count === 0 ? 3 : Math.max(8, Math.round((count / max) * 36));
          return (
            <div
              key={i}
              className="flex flex-col items-center gap-1 flex-1"
              title={`${DAY_FULL[i]}: ${count} completion${count !== 1 ? 's' : ''}`}
            >
              <div className="w-full flex items-end justify-center" style={{ height: 36 }}>
                <div
                  className={cn('w-full rounded-sm', count > 0 ? 'bg-primary' : 'bg-secondary/60')}
                  style={{ height: barH }}
                />
              </div>
              <span className="text-[10px] text-muted-foreground font-medium">{label}</span>
              <span className="text-[10px] tabular-nums text-muted-foreground">{count > 0 ? count : ''}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PitcherCard({ player }: { player: PitcherAccountability }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = INTEGRITY_CONFIG[player.integrity.level];

  return (
    <Card className={cn('glass-card border', player.integrity.level !== 'clean' && cfg.border)}>
      <CardContent className="p-0">
        {/* Summary row */}
        <button
          className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-secondary/30 transition-colors rounded-xl"
          onClick={() => setExpanded((v) => !v)}
        >
          {/* Name */}
          <span className="flex-1 font-semibold text-foreground truncate">{player.name}</span>

          {/* Stats */}
          <div className="hidden sm:flex items-center gap-4 shrink-0">
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="text-sm font-bold text-foreground">{player.totalCompletions}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">This week</p>
              <WeekBar value={player.thisWeekCompletions} max={player.thisWeekMax} />
            </div>
          </div>

          {/* Mobile stats */}
          <div className="sm:hidden flex flex-col items-end text-right">
            <span className="text-xs text-muted-foreground">{player.totalCompletions} total</span>
            <span className="text-xs text-muted-foreground">{player.thisWeekCompletions}/{player.thisWeekMax} this wk</span>
          </div>

          {/* Integrity badge */}
          <IntegrityBadge level={player.integrity.level} score={player.integrity.score} />

          {/* Chevron */}
          {expanded
            ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
            : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
        </button>

        {/* Expanded: per-assignment breakdown + flags */}
        {expanded && (
          <div className="px-4 pb-4 space-y-4 border-t border-border/50 pt-3">
            {/* Assignment breakdown */}
            {player.assignments.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">No assignments yet.</p>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-1">Per Workout</p>
                {player.assignments.map((a) => (
                  <div key={a.id} className="flex items-center gap-3">
                    <span className="flex-1 text-sm text-foreground truncate">{a.title}</span>
                    <span className="text-xs text-muted-foreground shrink-0 w-16 text-right">{a.total} total</span>
                    <WeekBar value={a.thisWeek} max={a.frequency} />
                  </div>
                ))}
              </div>
            )}

            {/* Day of week activity */}
            {player.totalCompletions > 0 && (
              <DayHeatStrip counts={player.dayOfWeekCounts} />
            )}

            {/* Integrity flags */}
            {player.integrity.flags.length > 0 && (
              <div className={cn('rounded-lg p-3 space-y-1', cfg.bg, 'border', cfg.border)}>
                <p className={cn('text-xs font-semibold uppercase tracking-wider mb-1', cfg.color)}>
                  Integrity flags
                </p>
                {player.integrity.flags.map((flag, i) => (
                  <p key={i} className="text-xs text-foreground flex items-start gap-1.5">
                    <cfg.Icon className={cn('w-3 h-3 mt-0.5 shrink-0', cfg.color)} />
                    {flag}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function WorkoutAccountabilityPage() {
  const navigate = useNavigate();
  const [players, setPlayers] = useState<PitcherAccountability[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const thisWeekStart = useMemo(
    () => format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'),
    []
  );

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // 1. Get all pitchers for this coach
        const { data: pitcherRows } = await supabase
          .from('pitchers')
          .select('id, name')
          .eq('user_id', user.id)
          .order('name');

        if (!pitcherRows || pitcherRows.length === 0) {
          setPlayers([]);
          return;
        }

        const pitcherIds = pitcherRows.map((p) => p.id);

        // 2. Get all assignments
        const { data: assignmentRows } = await supabase
          .from('workout_assignments')
          .select('id, pitcher_id, title, frequency')
          .in('pitcher_id', pitcherIds);

        // 3. Get all completions (with created_at for truth metric)
        const { data: completionRows } = await supabase
          .from('workout_completions')
          .select('id, assignment_id, pitcher_id, week_start, day_of_week, created_at')
          .in('pitcher_id', pitcherIds);

        const assignments = assignmentRows || [];
        const completions = (completionRows || []).map((c) => ({
          id: c.id,
          assignmentId: c.assignment_id,
          pitcherId: c.pitcher_id,
          weekStart: c.week_start,
          dayOfWeek: c.day_of_week,
          createdAt: c.created_at,
        }));

        // 4. Build per-pitcher accountability data
        const result: PitcherAccountability[] = pitcherRows.map((pitcher) => {
          const myAssignments = assignments.filter((a) => a.pitcher_id === pitcher.id);
          const activeAssignments = myAssignments.filter((a) => !a.expires_at || new Date(a.expires_at) >= new Date());
          const myCompletions = completions.filter((c) => c.pitcherId === pitcher.id);
          const thisWeekCompletions = myCompletions.filter((c) => c.weekStart === thisWeekStart);

          const assignmentSummaries: AssignmentSummary[] = activeAssignments.map((a) => ({
            id: a.id,
            title: a.title,
            frequency: a.frequency,
            total: myCompletions.filter((c) => c.assignmentId === a.id).length,
            thisWeek: thisWeekCompletions.filter((c) => c.assignmentId === a.id).length,
          }));

          const thisWeekMax = activeAssignments.reduce((sum, a) => sum + a.frequency, 0);

          const dayOfWeekCounts = Array.from({ length: 7 }, (_, day) =>
            myCompletions.filter((c) => c.dayOfWeek === day).length
          );

          return {
            id: pitcher.id,
            name: pitcher.name,
            totalCompletions: myCompletions.length,
            thisWeekCompletions: thisWeekCompletions.length,
            thisWeekMax,
            assignments: assignmentSummaries,
            integrity: computeIntegrity(myCompletions),
            dayOfWeekCounts,
          };
        });

        // Sort: flagged/suspect first, then by name
        const levelOrder = { flagged: 0, suspect: 1, watch: 2, clean: 3 };
        result.sort((a, b) =>
          levelOrder[a.integrity.level] - levelOrder[b.integrity.level] ||
          a.name.localeCompare(b.name)
        );

        setPlayers(result);
      } catch (err) {
        console.error('Error loading accountability data:', err);
      } finally {
        setIsLoading(false);
      }
    }

    load();
  }, [thisWeekStart]);

  const summary = useMemo(() => ({
    total: players.length,
    thisWeekTotal: players.reduce((s, p) => s + p.thisWeekCompletions, 0),
    flagged: players.filter((p) => p.integrity.level === 'flagged' || p.integrity.level === 'suspect').length,
  }), [players]);

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border/50">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => navigate(-1)}
              className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full hover:bg-secondary/80 transition-colors"
            >
              <ArrowLeft className="w-4 h-4 text-foreground" />
            </button>
            <img src={hawksLogo} alt="Team" className="w-8 h-8 object-contain shrink-0" />
            <div className="min-w-0">
              <h1 className="font-display text-lg font-bold text-foreground">Workout Accountability</h1>
              <p className="text-xs text-muted-foreground">Coach view · {format(new Date(), 'MMM d, yyyy')}</p>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Summary tiles */}
        {!isLoading && players.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            <Card className="glass-card">
              <CardContent className="p-3 text-center">
                <p className="text-xs text-muted-foreground">Players</p>
                <p className="text-2xl font-bold text-foreground">{summary.total}</p>
              </CardContent>
            </Card>
            <Card className="glass-card">
              <CardContent className="p-3 text-center">
                <p className="text-xs text-muted-foreground">This Week</p>
                <p className="text-2xl font-bold text-foreground">{summary.thisWeekTotal}</p>
              </CardContent>
            </Card>
            <Card className={cn('glass-card', summary.flagged > 0 ? 'border-orange-500/30 bg-orange-500/5' : '')}>
              <CardContent className="p-3 text-center">
                <p className="text-xs text-muted-foreground">Flagged</p>
                <p className={cn('text-2xl font-bold', summary.flagged > 0 ? 'text-orange-500' : 'text-foreground')}>{summary.flagged}</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Legend */}
        {!isLoading && players.length > 0 && (
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            {(Object.entries(INTEGRITY_CONFIG) as [IntegrityResult['level'], typeof INTEGRITY_CONFIG.clean][]).map(([level, { label, Icon, color }]) => (
              <span key={level} className="flex items-center gap-1">
                <Icon className={cn('w-3 h-3', color)} />
                <span>{label}</span>
              </span>
            ))}
            <span className="ml-auto italic">Score = 100 − deductions · click row to expand</span>
          </div>
        )}

        {/* Player list */}
        {isLoading ? (
          <div className="text-center py-16 text-muted-foreground">Loading...</div>
        ) : players.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Dumbbell className="w-8 h-8 mx-auto mb-3 opacity-30" />
            <p>No pitchers or workout data found.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {players.map((player) => (
              <PitcherCard key={player.id} player={player} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
