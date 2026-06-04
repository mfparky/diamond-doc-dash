export interface Outing {
  id: string;
  timestamp: string;
  date: string;
  pitcherName: string;
  eventType: 'Bullpen' | 'External' | 'Game' | 'Live ABs';
  pitchCount: number;
  strikes: number | null;
  maxVelo: number;
  notes: string;
  videoUrl?: string;
  focus?: string;
  coachNotes?: string;
  // New video fields
  videoUrl1?: string;
  videoUrl2?: string;
  video1PitchType?: number;
  video1Velocity?: number;
  video2PitchType?: number;
  video2Velocity?: number;
}

export interface Pitcher {
  id: string;
  name: string;
  sevenDayPulse: number;
  strikePercentage: number;
  maxVelo: number;
  lastOuting: string;
  lastPitchCount: number;
  restStatus: RestStatus;
  notes: string;
  outings: Outing[];
  focus?: string;
  coachNotes?: string;
  trends?: {
    pulse: { direction: 'up' | 'down' | 'stable'; diff: number };
    strike: { direction: 'up' | 'down' | 'stable'; diff: number };
    velo: { direction: 'up' | 'down' | 'stable'; diff: number };
  };
}

export type RestStatus = 
  | { type: 'no-data' }
  | { type: 'threw-today' }
  | { type: 'active' }
  | { type: 'resting'; daysNeeded: number; daysCurrent: number };

export type EventType = Outing['eventType'];

// Arm care rules - days of rest required based on pitch count
export function getDaysRestNeeded(pitchCount: number): number {
  if (pitchCount >= 76) return 4;
  if (pitchCount >= 61) return 3;
  if (pitchCount >= 46) return 2;
  if (pitchCount >= 31) return 1;
  return 0;
}

export function parseLocalDateAtNoon(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  if (!year || !month || !day) return new Date(dateStr);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

export function calculateRestStatus(lastOutingDate: string | null, lastPitchCount: number): RestStatus {
  if (!lastOutingDate || lastOutingDate === '') {
    return { type: 'no-data' };
  }

  const today = new Date();
  today.setHours(12, 0, 0, 0);
  
  const lastDate = parseLocalDateAtNoon(lastOutingDate);
  
  const daysSinceLast = Math.floor((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
  const daysRestNeeded = getDaysRestNeeded(lastPitchCount);

  if (daysSinceLast === 0) {
    return { type: 'threw-today' };
  }

  // Rest days are FULL days off after the outing.
  // e.g. 52 pitches → 2 days rest: threw day 0, rest day 1, rest day 2, active day 3.
  if (daysRestNeeded === 0 || daysSinceLast > daysRestNeeded) {
    return { type: 'active' };
  }

  // Still within rest period
  return { 
    type: 'resting', 
    daysNeeded: daysRestNeeded, 
    daysCurrent: daysSinceLast 
  };
}

export function getRestStatusLabel(status: RestStatus): string {
  switch (status.type) {
    case 'no-data':
      return 'No Data';
    case 'threw-today':
      return '🔴 Threw Today';
    case 'active':
      return '🟢 Active';
    case 'resting':
      return `${getRestEmoji(status.daysNeeded)} ${status.daysNeeded} Days Rest (Day ${status.daysCurrent} of ${status.daysNeeded})`;
  }
}

function getRestEmoji(daysNeeded: number): string {
  switch (daysNeeded) {
    case 4: return '🔴';
    case 3: return '🟠';
    case 2: return '🟡';
    case 1: return '⚪';
    default: return '🟢';
  }
}
