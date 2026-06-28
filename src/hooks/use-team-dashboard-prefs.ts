import { useCallback } from 'react';
import { useDashboardSettings } from '@/hooks/use-dashboard-settings';

/**
 * Coach-only UI preference for whether workout-related widgets appear on the
 * team dashboard. Historically lived in localStorage; now backed by the
 * `dashboard_settings.workouts_enabled` column so it syncs across devices and
 * shares state with the Settings dialog. Keeps the original [value, setter]
 * signature so existing callers don't need to change.
 */
export function useShowWorkoutLeaderboard(): [boolean, (next: boolean) => void] {
  const { settings, setWorkoutsEnabled } = useDashboardSettings();

  const update = useCallback(
    (next: boolean) => {
      // Fire-and-forget: original callers expected a sync setter. Errors
      // surface via the hook's toast.
      void setWorkoutsEnabled(next);
    },
    [setWorkoutsEnabled],
  );

  return [settings.workoutsEnabled, update];
}
