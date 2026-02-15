import { useMemo } from 'react';
import { Outing } from '@/types/pitcher';
import { BadgeResult } from '@/types/badges';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus, Star } from 'lucide-react';

interface ProgressReportCardProps {
  outings: Outing[];
  badges: BadgeResult[];
  pitcherName: string;
}

interface GradeResult {
  label: string;
  grade: string;
  color: string;
  value: string;
  trend: 'up' | 'down' | 'stable' | null;
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

export function ProgressReportCard({ outings, badges, pitcherName }: ProgressReportCardProps) {
  const seasonOutings = useMemo(
    () =>
      outings
        .filter((o) => new Date(o.date).getFullYear() === 2026)
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

    // Consistency grade (based on how close outings are to each other in strike %)
    const strikePcts = withStrikes
      .filter((o) => o.pitchCount > 0)
      .map((o) => ((o.strikes ?? 0) / o.pitchCount) * 100);
    let consistencyScore = 0;
    if (strikePcts.length >= 2) {
      const diffs: number[] = [];
      for (let i = 1; i < strikePcts.length; i++) {
        diffs.push(Math.abs(strikePcts[i] - strikePcts[i - 1]));
      }
      const avgDiff = diffs.reduce((a, b) => a + b, 0) / diffs.length;
      // 0% diff = 100 score, 20%+ diff = 0 score
      consistencyScore = Math.max(0, Math.min(100, (1 - avgDiff / 20) * 100));
    }
    const consistencyGrade = getGrade(consistencyScore);

    // Work ethic grade (based on outings per week)
    const firstDate = new Date(seasonOutings[0].date);
    const lastDate = new Date(seasonOutings[seasonOutings.length - 1].date);
    const weeks = Math.max(1, (lastDate.getTime() - firstDate.getTime()) / (7 * 24 * 60 * 60 * 1000));
    const outingsPerWeek = seasonOutings.length / weeks;
    // 3+ per week = A+, 2 = B, 1 = C
    const workEthicScore = Math.min(100, (outingsPerWeek / 3) * 100);
    const workEthicGrade = getGrade(workEthicScore);

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
        grade: consistencyGrade.grade,
        color: consistencyGrade.color,
        value: strikePcts.length >= 2 ? `${consistencyScore.toFixed(0)}% stable` : 'Need data',
        trend: null,
      },
      {
        label: 'Work Ethic',
        grade: workEthicGrade.grade,
        color: workEthicGrade.color,
        value: `${outingsPerWeek.toFixed(1)}/week`,
        trend: null,
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
    const avg =
      grades.reduce((sum, g) => sum + (gradeValues[g.grade] || 70), 0) / grades.length;
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
