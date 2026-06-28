import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'team_dashboard.show_workout_leaderboard';
const EVENT_NAME = 'team-dashboard-prefs-changed';

function readShow(): boolean {
  if (typeof window === 'undefined') return true;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  return raw === null ? true : raw === 'true';
}

/**
 * Coach-only UI preference for whether the workout leaderboard appears on the
 * team dashboard. Stored in localStorage (per-device) — no schema change.
 */
export function useShowWorkoutLeaderboard(): [boolean, (next: boolean) => void] {
  const [show, setShow] = useState<boolean>(readShow);

  useEffect(() => {
    const sync = () => setShow(readShow());
    window.addEventListener('storage', sync);
    window.addEventListener(EVENT_NAME, sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener(EVENT_NAME, sync);
    };
  }, []);

  const update = useCallback((next: boolean) => {
    window.localStorage.setItem(STORAGE_KEY, String(next));
    setShow(next);
    window.dispatchEvent(new Event(EVENT_NAME));
  }, []);

  return [show, update];
}
