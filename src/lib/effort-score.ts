// Effort score derived from workout completions vs expected workouts.
// Players shouldn't be penalized when coaches don't schedule bullpens — this
// measures the work the player CAN control: completing assigned workouts.

export interface EffortAssignment {
  id: string;
  frequency: number; // times per week
  createdAt: string; // ISO
  expiresAt: string | null; // ISO
}

export interface EffortCompletion {
  assignmentId: string;
  weekStart: string; // yyyy-MM-dd (Monday)
  dayOfWeek?: number; // 0=Mon..6=Sun (optional, used by consistency score)
}

export interface EffortResult {
  score: number; // 0-100
  completed: number;
  expected: number;
  weeksTracked: number;
  hasData: boolean;
}

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

function mondayOf(d: Date): Date {
  const day = d.getDay(); // 0=Sun..6=Sat
  const diff = (day + 6) % 7; // days since Monday
  const m = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  m.setDate(m.getDate() - diff);
  return m;
}

export function calculateEffortScore(
  assignments: EffortAssignment[],
  completions: EffortCompletion[]
): EffortResult {
  if (!assignments || assignments.length === 0) {
    return { score: 0, completed: 0, expected: 0, weeksTracked: 0, hasData: false };
  }

  const now = new Date();
  let expected = 0;

  for (const a of assignments) {
    const start = mondayOf(new Date(a.createdAt));
    const endRaw = a.expiresAt ? new Date(a.expiresAt) : now;
    const end = endRaw.getTime() > now.getTime() ? now : endRaw;
    if (end.getTime() < start.getTime()) continue;
    const weeks = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / MS_PER_WEEK));
    expected += weeks * Math.max(1, a.frequency || 1);
  }

  const completed = completions?.length ?? 0;

  if (expected === 0) {
    return { score: 0, completed, expected: 0, weeksTracked: 0, hasData: false };
  }

  // Cap completed at expected so over-performing doesn't skew, then convert to %
  const ratio = Math.min(1, completed / expected);
  const score = Math.round(ratio * 100);

  // Weeks tracked = span from earliest assignment to now
  const earliest = assignments
    .map((a) => new Date(a.createdAt).getTime())
    .reduce((m, t) => Math.min(m, t), now.getTime());
  const weeksTracked = Math.max(1, Math.ceil((now.getTime() - earliest) / MS_PER_WEEK));

  return { score, completed, expected, weeksTracked, hasData: true };
}
