import { Pitcher, Outing } from '@/types/pitcher';

const today = new Date().toISOString().split('T')[0];

export const initialPitchers: Pitcher[] = [
  {
    id: '1',
    name: 'Owen Parkinson',
    sevenDayPulse: 35,
    strikePercentage: 77.14,
    maxVelo: 54,
    lastOuting: '2026-01-19',
    restStatus: 'Threw Today',
    notes: 'Good extension through the ball.',
    outings: [
      {
        id: 'o1',
        timestamp: '2026-01-19T13:36:36',
        date: '2026-01-19',
        pitcherName: 'Owen Parkinson',
        eventType: 'Bullpen',
        pitchCount: 35,
        strikes: 27,
        maxVelo: 54,
        notes: 'Good extension through the ball.',
        videoUrl: '',
      },
    ],
  },
  {
    id: '2',
    name: 'Will Sorochan',
    sevenDayPulse: 35,
    strikePercentage: 57.14,
    maxVelo: 54,
    lastOuting: '2026-01-15',
    restStatus: 'Active',
    notes: 'Good session',
    outings: [
      {
        id: 'o2',
        timestamp: '2026-01-15T10:00:00',
        date: '2026-01-15',
        pitcherName: 'Will Sorochan',
        eventType: 'Bullpen',
        pitchCount: 35,
        strikes: 20,
        maxVelo: 54,
        notes: 'Good session',
        videoUrl: '',
      },
    ],
  },
  { id: '3', name: 'Ari Van Pelt', sevenDayPulse: 0, strikePercentage: 0, maxVelo: 0, lastOuting: '', restStatus: 'No Data', notes: '', outings: [] },
  { id: '4', name: 'Colin Perry', sevenDayPulse: 0, strikePercentage: 0, maxVelo: 0, lastOuting: '', restStatus: 'No Data', notes: '', outings: [] },
  { id: '5', name: 'Eli Aitchison', sevenDayPulse: 0, strikePercentage: 0, maxVelo: 0, lastOuting: '', restStatus: 'No Data', notes: '', outings: [] },
  { id: '6', name: 'Jackson Dabusinskas', sevenDayPulse: 0, strikePercentage: 0, maxVelo: 0, lastOuting: '', restStatus: 'No Data', notes: '', outings: [] },
  { id: '7', name: 'Luca DiMauro', sevenDayPulse: 0, strikePercentage: 0, maxVelo: 0, lastOuting: '', restStatus: 'No Data', notes: '', outings: [] },
  { id: '8', name: 'Mason Gomes', sevenDayPulse: 0, strikePercentage: 0, maxVelo: 0, lastOuting: '', restStatus: 'No Data', notes: '', outings: [] },
  { id: '9', name: 'Michael Castaldi', sevenDayPulse: 0, strikePercentage: 0, maxVelo: 0, lastOuting: '', restStatus: 'No Data', notes: '', outings: [] },
  { id: '10', name: 'Nico Aitchison', sevenDayPulse: 0, strikePercentage: 0, maxVelo: 0, lastOuting: '', restStatus: 'No Data', notes: '', outings: [] },
  { id: '11', name: 'Nicolas Srenk', sevenDayPulse: 0, strikePercentage: 0, maxVelo: 0, lastOuting: '', restStatus: 'No Data', notes: '', outings: [] },
  { id: '12', name: 'Sebastien Poulin', sevenDayPulse: 0, strikePercentage: 0, maxVelo: 0, lastOuting: '', restStatus: 'No Data', notes: '', outings: [] },
  { id: '13', name: 'Will Smith', sevenDayPulse: 0, strikePercentage: 0, maxVelo: 0, lastOuting: '', restStatus: 'No Data', notes: '', outings: [] },
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
      restStatus: 'No Data',
      notes: '',
      outings: [],
    };
  }

  // Calculate 7-day pulse (total pitches in last 7 days)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const recentOutings = pitcherOutings.filter(o => new Date(o.date) >= sevenDaysAgo);
  const sevenDayPulse = recentOutings.reduce((sum, o) => sum + o.pitchCount, 0);

  // Calculate overall strike percentage
  const totalPitches = pitcherOutings.reduce((sum, o) => sum + o.pitchCount, 0);
  const totalStrikes = pitcherOutings.reduce((sum, o) => sum + o.strikes, 0);
  const strikePercentage = totalPitches > 0 ? (totalStrikes / totalPitches) * 100 : 0;

  // Get max velo across all outings
  const maxVelo = Math.max(...pitcherOutings.map(o => o.maxVelo));

  // Get most recent outing
  const sortedOutings = [...pitcherOutings].sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  const lastOutingData = sortedOutings[0];
  const lastOuting = lastOutingData?.date || '';
  const notes = lastOutingData?.notes || '';

  // Calculate rest status
  const today = new Date().toISOString().split('T')[0];
  let restStatus: Pitcher['restStatus'] = 'No Data';
  if (lastOuting === today) {
    restStatus = 'Threw Today';
  } else if (lastOuting) {
    restStatus = 'Active';
  }

  return {
    ...pitcher,
    sevenDayPulse,
    strikePercentage: parseFloat(strikePercentage.toFixed(2)),
    maxVelo,
    lastOuting,
    restStatus,
    notes,
    outings: pitcherOutings,
  };
}
