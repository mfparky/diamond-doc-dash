import { Pitcher, Outing, calculateRestStatus } from '@/types/pitcher';

export const initialPitchers: Pitcher[] = [
  { id: '1', name: 'Owen Parkinson', sevenDayPulse: 0, strikePercentage: 0, maxVelo: 0, lastOuting: '', lastPitchCount: 0, restStatus: { type: 'no-data' }, notes: '', outings: [] },
  { id: '2', name: 'Will Sorochan', sevenDayPulse: 0, strikePercentage: 0, maxVelo: 0, lastOuting: '', lastPitchCount: 0, restStatus: { type: 'no-data' }, notes: '', outings: [] },
  { id: '3', name: 'Ari Van Pelt', sevenDayPulse: 0, strikePercentage: 0, maxVelo: 0, lastOuting: '', lastPitchCount: 0, restStatus: { type: 'no-data' }, notes: '', outings: [] },
  { id: '4', name: 'Colin Perry', sevenDayPulse: 0, strikePercentage: 0, maxVelo: 0, lastOuting: '', lastPitchCount: 0, restStatus: { type: 'no-data' }, notes: '', outings: [] },
  { id: '5', name: 'Eli Aitchison', sevenDayPulse: 0, strikePercentage: 0, maxVelo: 0, lastOuting: '', lastPitchCount: 0, restStatus: { type: 'no-data' }, notes: '', outings: [] },
  { id: '6', name: 'Jackson Dabusinskas', sevenDayPulse: 0, strikePercentage: 0, maxVelo: 0, lastOuting: '', lastPitchCount: 0, restStatus: { type: 'no-data' }, notes: '', outings: [] },
  { id: '7', name: 'Luca DiMauro', sevenDayPulse: 0, strikePercentage: 0, maxVelo: 0, lastOuting: '', lastPitchCount: 0, restStatus: { type: 'no-data' }, notes: '', outings: [] },
  { id: '8', name: 'Mason Gomes', sevenDayPulse: 0, strikePercentage: 0, maxVelo: 0, lastOuting: '', lastPitchCount: 0, restStatus: { type: 'no-data' }, notes: '', outings: [] },
  { id: '9', name: 'Michael Castaldi', sevenDayPulse: 0, strikePercentage: 0, maxVelo: 0, lastOuting: '', lastPitchCount: 0, restStatus: { type: 'no-data' }, notes: '', outings: [] },
  { id: '10', name: 'Nico Aitchison', sevenDayPulse: 0, strikePercentage: 0, maxVelo: 0, lastOuting: '', lastPitchCount: 0, restStatus: { type: 'no-data' }, notes: '', outings: [] },
  { id: '11', name: 'Nicolas Srenk', sevenDayPulse: 0, strikePercentage: 0, maxVelo: 0, lastOuting: '', lastPitchCount: 0, restStatus: { type: 'no-data' }, notes: '', outings: [] },
  { id: '12', name: 'Sebastien Poulin', sevenDayPulse: 0, strikePercentage: 0, maxVelo: 0, lastOuting: '', lastPitchCount: 0, restStatus: { type: 'no-data' }, notes: '', outings: [] },
  { id: '13', name: 'Will Smith', sevenDayPulse: 0, strikePercentage: 0, maxVelo: 0, lastOuting: '', lastPitchCount: 0, restStatus: { type: 'no-data' }, notes: '', outings: [] },
];

export function calculatePitcherStats(pitcher: Pitcher, allOutings: Outing[]): Pitcher {
  const pitcherOutings = allOutings.filter(o => o.pitcherName === pitcher.name);
  
  if (pitcherOutings.length === 0) {
    return {
      ...pitcher,
      sevenDayPulse: 0,
      strikePercentage: 0,
      maxVelo: 0,
      lastOuting: '',
      lastPitchCount: 0,
      restStatus: { type: 'no-data' },
      notes: '',
      outings: [],
      focus: undefined,
    };
  }

  // Calculate 7-day pulse (total pitches in last 7 days)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const recentOutings = pitcherOutings.filter(o => new Date(o.date) >= sevenDaysAgo);
  const sevenDayPulse = recentOutings.reduce((sum, o) => sum + o.pitchCount, 0);

  // Calculate 7-day strike percentage (only from last 7 days, only where strikes tracked)
  const recentWithStrikes = recentOutings.filter(o => o.strikes !== null);
  const recentPitchesWithStrikes = recentWithStrikes.reduce((sum, o) => sum + o.pitchCount, 0);
  const recentStrikes = recentWithStrikes.reduce((sum, o) => sum + (o.strikes ?? 0), 0);
  const strikePercentage = recentPitchesWithStrikes > 0 ? (recentStrikes / recentPitchesWithStrikes) * 100 : 0;

  // Get max velo from 7-day window (fall back to all-time if no recent data)
  const recentMaxVelo = recentOutings.length > 0 ? Math.max(...recentOutings.map(o => o.maxVelo || 0)) : 0;
  const maxVelo = recentMaxVelo > 0 ? recentMaxVelo : Math.max(...pitcherOutings.map(o => o.maxVelo || 0));

  // Get most recent outing
  const sortedOutings = [...pitcherOutings].sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  const lastOutingData = sortedOutings[0];
  const lastOuting = lastOutingData?.date || '';
  const lastPitchCount = lastOutingData?.pitchCount || 0;
  const notes = lastOutingData?.notes || '';

  // Get the most recent focus (find the most recent outing that has a focus set)
  const mostRecentFocus = sortedOutings.find(o => o.focus)?.focus;

  // Get the most recent coach notes (find the most recent outing that has coach notes)
  const mostRecentCoachNotes = sortedOutings.find(o => o.coachNotes)?.coachNotes;

  // Calculate rest status based on arm care rules
  const restStatus = calculateRestStatus(lastOuting, lastPitchCount);

  return {
    ...pitcher,
    sevenDayPulse,
    strikePercentage: parseFloat(strikePercentage.toFixed(2)),
    maxVelo,
    lastOuting,
    lastPitchCount,
    restStatus,
    notes,
    outings: pitcherOutings,
    focus: mostRecentFocus,
    coachNotes: mostRecentCoachNotes,
  };
}
