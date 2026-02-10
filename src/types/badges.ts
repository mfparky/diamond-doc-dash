import { Outing } from './pitcher';
import { PitchLocation, PitchTypeConfig } from './pitch-location';
import { STRIKE_ZONE } from '@/lib/strike-zone';

export interface BadgeDefinition {
  id: string;
  name: string;
  emoji: string;
  description: string;
  metric: string;
  category: 'accuracy' | 'command' | 'velocity' | 'consistency' | 'dominance';
}

export interface BadgeResult {
  badge: BadgeDefinition;
  earned: boolean;
  progress: number; // 0-100
  detail?: string;
}

export const BADGES: BadgeDefinition[] = [
  {
    id: 'zone-master',
    name: 'Zone Master',
    emoji: '🎯',
    description: 'Overall accuracy gold standard',
    metric: '≥ 65% Strike %',
    category: 'accuracy',
  },
  {
    id: 'sniper-status',
    name: 'Sniper Status',
    emoji: '🔫',
    description: 'Corner command specialist',
    metric: '≥ 5 shadow zone pitches in one session',
    category: 'command',
  },
  {
    id: 'bridge-builder',
    name: 'Bridge Builder',
    emoji: '🌉',
    description: 'Off-speed consistency',
    metric: '≥ 50% strike rate on off-speed',
    category: 'accuracy',
  },
  {
    id: 'down-away',
    name: 'Down & Away',
    emoji: '⬇️',
    description: 'Low zone command',
    metric: '≥ 5 pitches in bottom 1/3',
    category: 'command',
  },
  {
    id: 'velocity-jump',
    name: 'Velocity Jump',
    emoji: '🚀',
    description: 'Growth over time',
    metric: '+2 MPH vs. 30-day avg',
    category: 'velocity',
  },
  {
    id: 'terminator',
    name: 'The Terminator',
    emoji: '🤖',
    description: 'Dominant session performance',
    metric: '≥ 70% strikes in 30+ pitch session',
    category: 'dominance',
  },
  {
    id: 'power-precision',
    name: 'Power & Precision',
    emoji: '⚡',
    description: 'The dual threat',
    metric: 'Top 25% velo + ≥ 60% strikes',
    category: 'dominance',
  },
  {
    id: 'stratosphere',
    name: 'The Stratosphere',
    emoji: '☁️',
    description: 'High heat command',
    metric: '≥ 4 fastballs in top 1/3 zone',
    category: 'command',
  },
  {
    id: 'repeatable-motion',
    name: 'Repeatable Motion',
    emoji: '🔁',
    description: 'Consistency across sessions',
    metric: '3+ outings within 5% strike rate',
    category: 'consistency',
  },
  {
    id: 'early-count-killer',
    name: 'Early Count Killer',
    emoji: '💀',
    description: 'Zone aggression',
    metric: '≥ 60% zone rate in a session',
    category: 'dominance',
  },
];

// Shadow zone = edges of the strike zone (outer ~25% on each side)
function isInShadowZone(x: number, y: number): boolean {
  const { ZONE_LEFT, ZONE_RIGHT, ZONE_TOP, ZONE_BOTTOM } = STRIKE_ZONE;
  const zoneWidth = ZONE_RIGHT - ZONE_LEFT;
  const zoneHeight = ZONE_TOP - ZONE_BOTTOM;
  const edgeX = zoneWidth * 0.25;
  const edgeY = zoneHeight * 0.25;

  const inZone =
    x >= ZONE_LEFT && x <= ZONE_RIGHT &&
    y >= ZONE_BOTTOM && y <= ZONE_TOP;
  if (!inZone) return false;

  const inCore =
    x >= ZONE_LEFT + edgeX && x <= ZONE_RIGHT - edgeX &&
    y >= ZONE_BOTTOM + edgeY && y <= ZONE_TOP - edgeY;

  return !inCore;
}

function isInBottomThird(y: number): boolean {
  const { ZONE_BOTTOM, ZONE_TOP } = STRIKE_ZONE;
  const thirdHeight = (ZONE_TOP - ZONE_BOTTOM) / 3;
  return y >= ZONE_BOTTOM && y <= ZONE_BOTTOM + thirdHeight;
}

function isInTopThird(y: number): boolean {
  const { ZONE_BOTTOM, ZONE_TOP } = STRIKE_ZONE;
  const thirdHeight = (ZONE_TOP - ZONE_BOTTOM) / 3;
  return y >= ZONE_TOP - thirdHeight && y <= ZONE_TOP;
}

export function evaluateBadges(
  outings: Outing[],
  allPitchLocations: PitchLocation[], // all pitch locations for this pitcher
  pitchTypes: PitchTypeConfig,
  teamOutings?: Outing[], // all team outings for relative comparisons
): BadgeResult[] {
  return BADGES.map((badge) => {
    switch (badge.id) {
      case 'zone-master':
        return evalZoneMaster(badge, outings);
      case 'sniper-status':
        return evalSniperStatus(badge, allPitchLocations);
      case 'bridge-builder':
        return evalBridgeBuilder(badge, allPitchLocations, pitchTypes);
      case 'down-away':
        return evalDownAway(badge, allPitchLocations);
      case 'velocity-jump':
        return evalVelocityJump(badge, outings);
      case 'terminator':
        return evalTerminator(badge, outings);
      case 'power-precision':
        return evalPowerPrecision(badge, outings, teamOutings);
      case 'stratosphere':
        return evalStratosphere(badge, allPitchLocations, pitchTypes);
      case 'repeatable-motion':
        return evalRepeatableMotion(badge, outings);
      case 'early-count-killer':
        return evalEarlyCountKiller(badge, allPitchLocations);
      default:
        return { badge, earned: false, progress: 0 };
    }
  });
}

// 1. Zone Master: ≥ 65% overall strike %
function evalZoneMaster(badge: BadgeDefinition, outings: Outing[]): BadgeResult {
  const tracked = outings.filter(o => o.strikes !== null && o.strikes !== undefined);
  const totalPitches = tracked.reduce((s, o) => s + o.pitchCount, 0);
  const totalStrikes = tracked.reduce((s, o) => s + (o.strikes || 0), 0);
  if (totalPitches === 0) return { badge, earned: false, progress: 0 };
  const pct = (totalStrikes / totalPitches) * 100;
  return { badge, earned: pct >= 65, progress: Math.min(100, (pct / 65) * 100), detail: `${pct.toFixed(1)}% strikes` };
}

// 2. Sniper Status: ≥ 5 shadow zone pitches in any single session
function evalSniperStatus(badge: BadgeDefinition, locations: PitchLocation[]): BadgeResult {
  // Group by outing
  const byOuting = new Map<string, PitchLocation[]>();
  locations.forEach(l => {
    const arr = byOuting.get(l.outingId) || [];
    arr.push(l);
    byOuting.set(l.outingId, arr);
  });
  let best = 0;
  byOuting.forEach(locs => {
    const shadowCount = locs.filter(l => isInShadowZone(l.xLocation, l.yLocation)).length;
    best = Math.max(best, shadowCount);
  });
  return { badge, earned: best >= 5, progress: Math.min(100, (best / 5) * 100), detail: `Best: ${best} shadow pitches` };
}

// 3. Bridge Builder: ≥ 50% strike rate on off-speed (pitch types 2-5)
function evalBridgeBuilder(badge: BadgeDefinition, locations: PitchLocation[], pitchTypes: PitchTypeConfig): BadgeResult {
  // Off-speed = anything that's not pitch type 1 (fastball)
  const offSpeed = locations.filter(l => l.pitchType !== 1);
  if (offSpeed.length === 0) return { badge, earned: false, progress: 0, detail: 'No off-speed data' };
  const strikes = offSpeed.filter(l => l.isStrike).length;
  const pct = (strikes / offSpeed.length) * 100;
  return { badge, earned: pct >= 50, progress: Math.min(100, (pct / 50) * 100), detail: `${pct.toFixed(0)}% off-speed strikes` };
}

// 4. Down & Away: ≥ 5 pitches in bottom 1/3 in any session
function evalDownAway(badge: BadgeDefinition, locations: PitchLocation[]): BadgeResult {
  const byOuting = new Map<string, PitchLocation[]>();
  locations.forEach(l => {
    const arr = byOuting.get(l.outingId) || [];
    arr.push(l);
    byOuting.set(l.outingId, arr);
  });
  let best = 0;
  byOuting.forEach(locs => {
    const count = locs.filter(l => isInBottomThird(l.yLocation)).length;
    best = Math.max(best, count);
  });
  return { badge, earned: best >= 5, progress: Math.min(100, (best / 5) * 100), detail: `Best: ${best} low zone pitches` };
}

// 5. Velocity Jump: +2 MPH vs 30-day avg
function evalVelocityJump(badge: BadgeDefinition, outings: Outing[]): BadgeResult {
  const sorted = [...outings].filter(o => o.maxVelo > 0).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  if (sorted.length < 2) return { badge, earned: false, progress: 0, detail: 'Need more data' };

  const currentMax = sorted[0].maxVelo;
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const older = sorted.filter(o => new Date(o.date) < thirtyDaysAgo);
  if (older.length === 0) return { badge, earned: false, progress: 0, detail: 'Need 30+ days of data' };

  const avgOlder = older.reduce((s, o) => s + o.maxVelo, 0) / older.length;
  const jump = currentMax - avgOlder;
  return { badge, earned: jump >= 2, progress: Math.min(100, Math.max(0, (jump / 2) * 100)), detail: `${jump >= 0 ? '+' : ''}${jump.toFixed(1)} MPH` };
}

// 6. Terminator (modified): ≥ 70% strike rate in any 30+ pitch session
function evalTerminator(badge: BadgeDefinition, outings: Outing[]): BadgeResult {
  const qualifying = outings.filter(o => o.pitchCount >= 30 && o.strikes !== null && o.strikes !== undefined);
  if (qualifying.length === 0) return { badge, earned: false, progress: 0, detail: 'No 30+ pitch sessions' };
  let bestPct = 0;
  qualifying.forEach(o => {
    const pct = ((o.strikes || 0) / o.pitchCount) * 100;
    bestPct = Math.max(bestPct, pct);
  });
  return { badge, earned: bestPct >= 70, progress: Math.min(100, (bestPct / 70) * 100), detail: `Best: ${bestPct.toFixed(0)}% in a session` };
}

// 7. Power & Precision: Top 25% team velo + ≥ 60% strikes
function evalPowerPrecision(badge: BadgeDefinition, outings: Outing[], teamOutings?: Outing[]): BadgeResult {
  const tracked = outings.filter(o => o.strikes !== null);
  const totalPitches = tracked.reduce((s, o) => s + o.pitchCount, 0);
  const totalStrikes = tracked.reduce((s, o) => s + (o.strikes || 0), 0);
  const strikePct = totalPitches > 0 ? (totalStrikes / totalPitches) * 100 : 0;
  const myMaxVelo = outings.reduce((m, o) => Math.max(m, o.maxVelo || 0), 0);

  if (!teamOutings || teamOutings.length === 0 || myMaxVelo === 0) {
    const earned = strikePct >= 60;
    return { badge, earned: false, progress: Math.min(100, (strikePct / 60) * 50), detail: 'Need team data for velo ranking' };
  }

  // Get all unique pitcher max velos from team
  const pitcherVelos = new Map<string, number>();
  teamOutings.forEach(o => {
    const current = pitcherVelos.get(o.pitcherName) || 0;
    pitcherVelos.set(o.pitcherName, Math.max(current, o.maxVelo || 0));
  });
  const allVelos = Array.from(pitcherVelos.values()).filter(v => v > 0).sort((a, b) => b - a);
  const top25Cutoff = allVelos[Math.floor(allVelos.length * 0.25)] || allVelos[0] || 0;
  const inTop25 = myMaxVelo >= top25Cutoff;
  const earned = inTop25 && strikePct >= 60;
  const progress = ((inTop25 ? 50 : (myMaxVelo / top25Cutoff) * 50) + (Math.min(strikePct, 60) / 60) * 50);

  return { badge, earned, progress: Math.min(100, progress), detail: `${myMaxVelo} MPH, ${strikePct.toFixed(0)}% strikes` };
}

// 8. Stratosphere: ≥ 4 fastballs in top 1/3 zone in any session
function evalStratosphere(badge: BadgeDefinition, locations: PitchLocation[], pitchTypes: PitchTypeConfig): BadgeResult {
  const byOuting = new Map<string, PitchLocation[]>();
  locations.forEach(l => {
    const arr = byOuting.get(l.outingId) || [];
    arr.push(l);
    byOuting.set(l.outingId, arr);
  });
  let best = 0;
  byOuting.forEach(locs => {
    const count = locs.filter(l => l.pitchType === 1 && isInTopThird(l.yLocation)).length;
    best = Math.max(best, count);
  });
  return { badge, earned: best >= 4, progress: Math.min(100, (best / 4) * 100), detail: `Best: ${best} high fastballs` };
}

// 9. Repeatable Motion (modified): 3+ consecutive outings within 5% strike rate of each other
function evalRepeatableMotion(badge: BadgeDefinition, outings: Outing[]): BadgeResult {
  const tracked = outings
    .filter(o => o.strikes !== null && o.pitchCount > 0)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map(o => ((o.strikes || 0) / o.pitchCount) * 100);

  if (tracked.length < 3) return { badge, earned: false, progress: (tracked.length / 3) * 50, detail: `${tracked.length}/3 outings` };

  let longestStreak = 1;
  let currentStreak = 1;
  for (let i = 1; i < tracked.length; i++) {
    if (Math.abs(tracked[i] - tracked[i - 1]) <= 5) {
      currentStreak++;
      longestStreak = Math.max(longestStreak, currentStreak);
    } else {
      currentStreak = 1;
    }
  }
  return { badge, earned: longestStreak >= 3, progress: Math.min(100, (longestStreak / 3) * 100), detail: `${longestStreak} consecutive consistent` };
}

// 10. Early Count Killer (modified): ≥ 60% of pitches in strike zone in any single session
function evalEarlyCountKiller(badge: BadgeDefinition, locations: PitchLocation[]): BadgeResult {
  const byOuting = new Map<string, PitchLocation[]>();
  locations.forEach(l => {
    const arr = byOuting.get(l.outingId) || [];
    arr.push(l);
    byOuting.set(l.outingId, arr);
  });
  let bestPct = 0;
  byOuting.forEach(locs => {
    if (locs.length < 5) return; // need minimum sample
    const strikes = locs.filter(l => l.isStrike).length;
    bestPct = Math.max(bestPct, (strikes / locs.length) * 100);
  });
  return { badge, earned: bestPct >= 60, progress: Math.min(100, (bestPct / 60) * 100), detail: `Best: ${bestPct.toFixed(0)}% zone rate` };
}
