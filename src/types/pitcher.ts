export interface Outing {
  id: string;
  timestamp: string;
  date: string;
  pitcherName: string;
  eventType: 'Bullpen' | 'Live' | 'Game' | 'Practice';
  pitchCount: number;
  strikes: number;
  maxVelo: number;
  notes: string;
  videoUrl?: string;
}

export interface Pitcher {
  id: string;
  name: string;
  sevenDayPulse: number;
  strikePercentage: number;
  maxVelo: number;
  lastOuting: string;
  restStatus: 'Active' | 'Threw Today' | 'No Data';
  notes: string;
  outings: Outing[];
}

export type RestStatus = Pitcher['restStatus'];
export type EventType = Outing['eventType'];
