import { useEffect, useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { format, eachWeekOfInterval, endOfWeek, startOfWeek } from 'date-fns';
import { Trophy, Medal, Sparkles, Flame } from 'lucide-react';
import { WorkoutGallery } from '@/components/WorkoutGallery';
import { usePageMeta } from '@/hooks/use-page-meta';
import confetti from 'canvas-confetti';

interface Entry {
  pitcherId: string;
  pitcherName: string;
  total: number;
}

export default function PodiumPage() {
  const params = useParams<{ teamId: string }>();
  const teamId = params.teamId ?? 'df9e0d02-60e2-4379-906e-ddcc5e404fec';
  const [teamName, setTeamName] = useState('Team');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [totalAll, setTotalAll] = useState(0);
  const [pitcherIds, setPitcherIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [windowLabel, setWindowLabel] = useState('');

  usePageMeta({
    title: `${teamName} | Workout Podium`,
    description: `Top performers from ${teamName}.`,
  });

  useEffect(() => {
    if (!teamId) return;
    let cancelled = false;

    async function load() {
      const { data: team } = await supabase
        .from('teams')
        .select('name, leaderboard_from, leaderboard_to')
        .eq('id', teamId!)
        .single();
      if (!team || cancelled) return;
      setTeamName(team.name);

      const now = new Date();
      const from = team.leaderboard_from
        ? new Date(team.leaderboard_from + 'T12:00:00')
        : startOfWeek(new Date(now.getFullYear(), now.getMonth(), 1), { weekStartsOn: 1 });
      const to = team.leaderboard_to
        ? new Date(team.leaderboard_to + 'T12:00:00')
        : endOfWeek(now, { weekStartsOn: 1 });
      setWindowLabel(`${format(from, 'MMM d')} – ${format(to, 'MMM d, yyyy')}`);

      const { data: pitchers } = await supabase
        .from('pitchers')
        .select('id, name')
        .eq('team_id', teamId!);
      if (!pitchers || cancelled) return;

      const ids = pitchers.map((p) => p.id);
      setPitcherIds(ids);
      const nameMap: Record<string, string> = Object.fromEntries(
        pitchers.map((p) => [p.id, p.name]),
      );

      if (ids.length === 0) {
        setEntries([]);
        setTotalAll(0);
        setLoading(false);
        return;
      }

      const weekStarts = eachWeekOfInterval({ start: from, end: to }, { weekStartsOn: 1 }).map((w) =>
        format(w, 'yyyy-MM-dd'),
      );
      const cutoffMs = endOfWeek(to, { weekStartsOn: 1 }).getTime();

      const { data: completions } = await supabase
        .from('workout_completions')
        .select('pitcher_id, week_start, assignment_id, created_at')
        .in('pitcher_id', ids)
        .in('week_start', weekStarts);

      const { data: assignments } = await supabase
        .from('workout_assignments')
        .select('id, double_points')
        .in('pitcher_id', ids);

      const weight: Record<string, number> = {};
      (assignments || []).forEach((a: any) => {
        weight[a.id] = a.double_points ? 2 : 1;
      });

      const counts: Record<string, number> = {};
      let total = 0;
      const weekSet = new Set(weekStarts);
      (completions || []).forEach((c: any) => {
        const w = weight[c.assignment_id] ?? 1;
        const createdMs = c.created_at ? new Date(c.created_at).getTime() : 0;
        if (createdMs <= cutoffMs && weekSet.has(c.week_start)) {
          counts[c.pitcher_id] = (counts[c.pitcher_id] || 0) + w;
          total += w;
        }
      });

      const list: Entry[] = ids
        .map((id) => ({
          pitcherId: id,
          pitcherName: nameMap[id],
          total: counts[id] || 0,
        }))
        .filter((e) => e.total > 0)
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);

      if (cancelled) return;
      setEntries(list);
      setTotalAll(total);
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [teamId]);

  // Fire confetti once entries are loaded
  useEffect(() => {
    if (loading || entries.length === 0) return;
    const t = setTimeout(() => {
      confetti({
        particleCount: 140,
        spread: 90,
        origin: { y: 0.35 },
      });
    }, 400);
    return () => clearTimeout(t);
  }, [loading, entries.length]);

  const top3 = entries.slice(0, 3);
  const rest = entries.slice(3, 5);

  const top3Total = useMemo(() => top3.reduce((s, e) => s + e.total, 0), [top3]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-primary/5">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        {/* Hero */}
        <div className="text-center mb-10 sm:mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold uppercase tracking-wider mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            {teamName}
          </div>
          <h1 className="font-display text-4xl sm:text-6xl font-extrabold text-foreground tracking-tight">
            Congratulations!
          </h1>
          <p className="mt-3 text-muted-foreground text-base sm:text-lg max-w-xl mx-auto">
            Celebrating the top 5 grinders this season. The work shows up.
          </p>
          {windowLabel && (
            <p className="mt-2 text-xs text-muted-foreground/70">{windowLabel}</p>
          )}
        </div>

        {loading ? (
          <div className="text-center py-20 text-muted-foreground">Loading podium…</div>
        ) : entries.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            No completions logged yet for this window.
          </div>
        ) : (
          <>
            {/* Podium */}
            <Podium top3={top3} />

            {/* Honorable mentions 4 & 5 */}
            {rest.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-10 max-w-3xl mx-auto">
                {rest.map((e, i) => (
                  <div
                    key={e.pitcherId}
                    className="rounded-2xl border border-border/60 bg-card p-5 flex items-center gap-4 shadow-sm"
                  >
                    <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center font-bold text-foreground text-lg shrink-0">
                      {i + 4}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                        Honorable mention
                      </p>
                      <p className="font-bold text-foreground text-lg truncate">{e.pitcherName}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-extrabold text-foreground leading-none">{e.total}</p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">workouts</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Total + share visual */}
            <div className="mt-14 max-w-3xl mx-auto">
              <div className="rounded-3xl border border-border/60 bg-card p-6 sm:p-8 shadow-sm">
                <div className="flex items-baseline justify-between gap-4 flex-wrap">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                      Total team workouts
                    </p>
                    <p className="font-display text-5xl sm:text-6xl font-extrabold text-foreground leading-none mt-1">
                      {totalAll}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                      Top 3 share
                    </p>
                    <p className="text-2xl font-bold text-primary">
                      {totalAll > 0 ? Math.round((top3Total / totalAll) * 100) : 0}%
                    </p>
                  </div>
                </div>

                {/* Baseball-stitched share bar */}
                <div className="mt-6">
                  <BaseballShareBar top3={top3} totalAll={totalAll} />
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    {top3.map((e, i) => (
                      <span key={e.pitcherId} className="flex items-center gap-1.5">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ background: PODIUM_COLORS[i] }}
                        />
                        {e.pitcherName} · {e.total}
                      </span>
                    ))}
                    {totalAll > top3Total && (
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-muted" />
                        Rest of team · {totalAll - top3Total}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Photo wall */}
        <div className="mt-16">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
              <Flame className="w-4.5 h-4.5 text-primary" />
            </div>
            <div>
              <h2 className="font-display text-2xl font-bold text-foreground">The Wall</h2>
              <p className="text-xs text-muted-foreground">Every check-in. Every rep.</p>
            </div>
          </div>
          {teamId && pitcherIds.length > 0 && (
            <WorkoutGallery teamId={teamId} pitcherIds={pitcherIds} />
          )}
        </div>
      </div>
    </div>
  );
}

const PODIUM_COLORS = ['#facc15', '#cbd5e1', '#d97706'];

function Podium({ top3 }: { top3: Entry[] }) {
  // order display: 2nd, 1st, 3rd
  const order = [top3[1], top3[0], top3[2]].filter(Boolean) as Entry[];
  const heights = top3.length === 1 ? [180] : top3.length === 2 ? [140, 200] : [150, 220, 120];
  const ranks = top3.length === 1 ? [0] : top3.length === 2 ? [1, 0] : [1, 0, 2];

  return (
    <div className="flex items-end justify-center gap-3 sm:gap-6 max-w-3xl mx-auto">
      {order.map((entry, i) => {
        const rank = ranks[i];
        const height = heights[i];
        const color = PODIUM_COLORS[rank];
        const Icon = rank === 0 ? Trophy : Medal;
        const initials = entry.pitcherName
          .split(' ')
          .map((w) => w[0])
          .join('')
          .toUpperCase()
          .slice(0, 2);

        return (
          <div key={entry.pitcherId} className="flex flex-col items-center flex-1 min-w-0 max-w-[180px]">
            {/* Player chip */}
            <div className="flex flex-col items-center mb-3 text-center">
              <div
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center text-xl sm:text-2xl font-extrabold text-background shadow-lg ring-4 ring-background"
                style={{ background: color }}
              >
                {initials}
              </div>
              <p className="font-bold text-foreground text-sm sm:text-base mt-2 truncate w-full">
                {entry.pitcherName}
              </p>
              <p className="text-2xl sm:text-3xl font-extrabold text-foreground leading-none mt-1">
                {entry.total}
              </p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">workouts</p>
            </div>

            {/* Pillar */}
            <div
              className="w-full rounded-t-xl flex flex-col items-center justify-start pt-3 shadow-inner"
              style={{
                height,
                background: `linear-gradient(180deg, ${color} 0%, ${color}cc 100%)`,
              }}
            >
              <Icon
                className="w-6 h-6 sm:w-7 sm:h-7"
                style={{ color: rank === 1 ? '#475569' : '#1f2937' }}
              />
              <span
                className="font-display font-extrabold text-3xl sm:text-4xl mt-1"
                style={{ color: rank === 1 ? '#475569' : '#1f2937' }}
              >
                {rank + 1}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Horizontal share bar styled like a baseball, segmented by top-3 contribution. */
function BaseballShareBar({ top3, totalAll }: { top3: Entry[]; totalAll: number }) {
  if (totalAll === 0) return null;
  const segs = top3.map((e, i) => ({
    name: e.pitcherName,
    value: e.total,
    color: PODIUM_COLORS[i],
  }));
  const restValue = totalAll - segs.reduce((s, x) => s + x.value, 0);
  if (restValue > 0) {
    segs.push({ name: 'Rest of team', value: restValue, color: 'hsl(var(--muted))' });
  }

  return (
    <div className="relative w-full h-10 rounded-full overflow-hidden border-2 border-foreground/10 flex shadow-inner">
      {segs.map((s, i) => {
        const pct = (s.value / totalAll) * 100;
        if (pct === 0) return null;
        return (
          <div
            key={i}
            className="relative flex items-center justify-center text-[11px] font-bold text-foreground/80 transition-all"
            style={{ width: `${pct}%`, background: s.color }}
            title={`${s.name}: ${s.value}`}
          >
            {pct > 10 && <span className="drop-shadow-sm">{s.value}</span>}
            {/* baseball stitch */}
            <span
              className="absolute inset-y-1 left-0 w-px bg-foreground/20"
              aria-hidden
            />
          </div>
        );
      })}
    </div>
  );
}
