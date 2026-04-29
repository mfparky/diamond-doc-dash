import { useMemo } from 'react';
import { Outing } from '@/types/pitcher';
import { BadgeResult } from '@/types/badges';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus, Star } from 'lucide-react';
import {
  calculateEffortScore,
  EffortAssignment,
  EffortCompletion,
} from '@/lib/effort-score';
import { calculateConsistency } from '@/lib/consistency-score';

interface ProgressReportCardProps {
  outings: Outing[];
  badges: BadgeResult[];
  pitcherName: string;
  workoutAssignments?: EffortAssignment[];
  workoutCompletions?: EffortCompletion[];
}

interface GradeResult {
  label: string;
  grade: string;
  color: string;
  value: string;
  trend: 'up' | 'down' | 'stable' | null;
  skipInOverall?: boolean;
}

function getGrade(pct: number): { grade: string; color: string } {
  if (pct >= 90) return { grade: 'A+', color: 'hsl(142, 70%, 45%)' };
  if (pct >= 80) return { grade: 'A', color: 'hsl(142, 70%, 45%)' };
  if (pct >= 70) return { grade: 'B+', color: 'hsl(142, 50%, 50%)' };
  if (pct >= 60) return { grade: 'B', color: 'hsl(38, 92%, 50%)' };
  if (pct >= 50) return { grade: 'C+', color: 'hsl(38, 92%, 50%)' };
  if (pct >= 40) return { grade: 'C', color: 'hsl(25, 90%, 55%)' };
  return { grade: 'D', color: 'hsl(0, 72%, 55%)' };
}

function calcTrend(outings: Outing[], getValue: (o: Outing) => number | null): 'up' | 'down' | 'stable' | null {
  const values = outings
    .map(getValue)
    .filter((v): v is number => v !== null);
  if (values.length < 4) return null;
  const mid = Math.floor(values.length / 2);
  const firstAvg = values.slice(0, mid).reduce((a, b) => a + b, 0) / mid;
  const secondAvg = values.slice(mid).reduce((a, b) => a + b, 0) / (values.length - mid);
  const diff = secondAvg - firstAvg;
  if (Math.abs(diff) < 1) return 'stable';
  return diff > 0 ? 'up' : 'down';
}

export function ProgressReportCard({
  outings,
  badges,
  pitcherName,
  workoutAssignments,
  workoutCompletions,
}: ProgressReportCardProps) {
  const seasonOutings = useMemo(
    () =>
      outings
        .filter((o) => new Date(o.date).getFullYear() === new Date().getFullYear())
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [outings]
  );

  const grades = useMemo((): GradeResult[] => {
    if (seasonOutings.length === 0) return [];

    // Strike accuracy grade (65% = A+, scale down)
    const withStrikes = seasonOutings.filter((o) => o.strikes !== null);
    const totalPitches = withStrikes.reduce((s, o) => s + o.pitchCount, 0);
    const totalStrikes = withStrikes.reduce((s, o) => s + (o.strikes ?? 0), 0);
    const strikePct = totalPitches > 0 ? (totalStrikes / totalPitches) * 100 : 0;
    const accuracyScore = Math.min(100, (strikePct / 65) * 90);
    const accuracyGrade = getGrade(accuracyScore);

    // Consistency = blend of strike-% std dev (own mean) + workout days/week.
    // Rewards both pitching stability AND regular work.
    const consistency = calculateConsistency(
      seasonOutings.map((o) => ({ pitchCount: o.pitchCount, strikes: o.strikes })),
      (workoutCompletions ?? [])
        .filter((c) => typeof c.dayOfWeek === 'number')
        .map((c) => ({ weekStart: c.weekStart, dayOfWeek: c.dayOfWeek as number }))
    );
    const consistencyGrade = getGrade(consistency.score);

    // Effort grade (based on workout completion vs expected).
    // Players shouldn't be dinged for coaches not scheduling bullpens.
    const effort = calculateEffortScore(workoutAssignments ?? [], workoutCompletions ?? []);
    const effortGrade = getGrade(effort.score);
    const effortValue = effort.hasData
      ? `${effort.completed}/${effort.expected} workouts`
      : 'No workouts assigned';

    // Badges earned grade
    const earned = badges.filter((b) => b.earned).length;
    const badgeScore = (earned / badges.length) * 100;
    const badgeGrade = getGrade(badgeScore);

    return [
      {
        label: 'Accuracy',
        grade: accuracyGrade.grade,
        color: accuracyGrade.color,
        value: `${strikePct.toFixed(0)}% strikes`,
        trend: calcTrend(seasonOutings, (o) =>
          o.strikes !== null && o.pitchCount > 0 ? (o.strikes / o.pitchCount) * 100 : null
        ),
      },
      {
        label: 'Consistency',
        grade: consistency.hasData ? consistencyGrade.grade : '—',
        color: consistency.hasData ? consistencyGrade.color : 'hsl(var(--muted-foreground))',
        value: consistency.detail,
        trend: null,
        skipInOverall: !consistency.hasData,
      },
      {
        label: 'Effort',
        grade: effort.hasData ? effortGrade.grade : '—',
        color: effort.hasData ? effortGrade.color : 'hsl(var(--muted-foreground))',
        value: effortValue,
        trend: null,
        skipInOverall: !effort.hasData,
      },
      {
        label: 'Achievements',
        grade: badgeGrade.grade,
        color: badgeGrade.color,
        value: `${earned}/${badges.length} earned`,
        trend: null,
      },
    ];
  }, [seasonOutings, badges]);

  // Overall grade
  const overallGrade = useMemo(() => {
    if (grades.length === 0) return null;
    const gradeValues: Record<string, number> = {
      'A+': 97, A: 93, 'B+': 87, B: 83, 'C+': 77, C: 73, D: 65,
    };
    const counted = grades.filter((g) => !g.skipInOverall);
    if (counted.length === 0) return null;
    const avg =
      counted.reduce((sum, g) => sum + (gradeValues[g.grade] || 70), 0) / counted.length;
    return getGrade(avg);
  }, [grades]);

  if (seasonOutings.length < 2) return null;

  return (
    <Card className="glass-card border-primary/20 report-card">
      <CardHeader className="pb-3">
        <CardTitle className="font-display text-lg flex items-center gap-2">
          <Star className="w-5 h-5 text-yellow-500" />
          Season Report Card
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          2026 Season &middot; {seasonOutings.length} outings
        </p>
      </CardHeader>
      <CardContent>
        <div className="flex items-start gap-4">
          {/* Overall grade circle */}
          {overallGrade && (
            <div className="shrink-0 flex flex-col items-center">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center border-2 font-display text-2xl font-bold"
                style={{ borderColor: overallGrade.color, color: overallGrade.color }}
              >
                {overallGrade.grade}
              </div>
              <span className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider">
                Overall
              </span>
            </div>
          )}

          {/* Individual grades */}
          <div className="flex-1 grid grid-cols-2 gap-x-4 gap-y-2">
            {grades.map((g) => (
              <div key={g.label} className="flex items-center gap-2">
                <span
                  className="text-sm font-bold w-7 text-center shrink-0"
                  style={{ color: g.color }}
                >
                  {g.grade}
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-foreground leading-tight">{g.label}</p>
                  <div className="flex items-center gap-1">
                    <p className="text-[10px] text-muted-foreground truncate">{g.value}</p>
                    {g.trend === 'up' && <TrendingUp className="w-3 h-3 text-[hsl(142,70%,45%)] shrink-0" />}
                    {g.trend === 'down' && <TrendingDown className="w-3 h-3 text-[hsl(0,72%,55%)] shrink-0" />}
                    {g.trend === 'stable' && <Minus className="w-3 h-3 text-muted-foreground shrink-0" />}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
