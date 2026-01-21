// Global max weekly pitches constant
export const DEFAULT_MAX_WEEKLY_PITCHES = 120;

export type PulseLevel = 'normal' | 'warning' | 'caution' | 'danger';

/**
 * Calculate pulse level based on 7-day pitch count and max allowed
 * - normal: < 75% of max
 * - warning: 75-89% of max (yellow)
 * - caution: 90-99% of max (orange)
 * - danger: >= 100% of max (red)
 */
export function getPulseLevel(sevenDayPulse: number, maxWeeklyPitches: number = DEFAULT_MAX_WEEKLY_PITCHES): PulseLevel {
  const percentage = (sevenDayPulse / maxWeeklyPitches) * 100;
  
  if (percentage >= 100) return 'danger';
  if (percentage >= 90) return 'caution';
  if (percentage >= 75) return 'warning';
  return 'normal';
}

/**
 * Get Tailwind color classes for pulse level
 */
export function getPulseColorClasses(level: PulseLevel): { bg: string; text: string; icon: string } {
  switch (level) {
    case 'danger':
      return {
        bg: 'bg-status-danger/10',
        text: 'text-status-danger',
        icon: 'text-status-danger',
      };
    case 'caution':
      return {
        bg: 'bg-orange-500/10',
        text: 'text-orange-500',
        icon: 'text-orange-500',
      };
    case 'warning':
      return {
        bg: 'bg-status-warning/10',
        text: 'text-status-warning',
        icon: 'text-status-warning',
      };
    default:
      return {
        bg: 'bg-primary/10',
        text: 'text-foreground',
        icon: 'text-primary',
      };
  }
}

/**
 * Get a descriptive label for the pulse level
 */
export function getPulseLevelLabel(level: PulseLevel, sevenDayPulse: number, maxWeeklyPitches: number): string {
  const percentage = Math.round((sevenDayPulse / maxWeeklyPitches) * 100);
  
  switch (level) {
    case 'danger':
      return `Over limit (${percentage}%)`;
    case 'caution':
      return `Near limit (${percentage}%)`;
    case 'warning':
      return `Approaching limit (${percentage}%)`;
    default:
      return `${sevenDayPulse} / ${maxWeeklyPitches}`;
  }
}
