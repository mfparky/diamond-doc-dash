import { useState, useEffect, useCallback } from 'react';

export function useAchievementWindow() {
  const [startDate, setStartDate] = useState<Date | undefined>(() => {
    const stored = localStorage.getItem('achievementStartDate');
    return stored ? new Date(stored) : undefined;
  });

  useEffect(() => {
    const handler = () => {
      const stored = localStorage.getItem('achievementStartDate');
      setStartDate(stored ? new Date(stored) : undefined);
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  const filterByWindow = useCallback(<T extends { date?: string; createdAt?: string }>(
    items: T[],
    dateField: 'date' | 'createdAt' = 'date'
  ): T[] => {
    if (!startDate) return items;
    const start = startDate.getTime();
    return items.filter(item => {
      const val = dateField === 'date' ? (item as any).date : (item as any).createdAt;
      if (!val) return true;
      return new Date(val).getTime() >= start;
    });
  }, [startDate]);

  return { startDate, filterByWindow };
}
