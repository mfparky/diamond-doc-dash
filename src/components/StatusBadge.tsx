import { RestStatus } from '@/types/pitcher';
import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: RestStatus;
  className?: string;
  compact?: boolean;
}

export function StatusBadge({ status, className, compact = false }: StatusBadgeProps) {
  const getStatusStyles = () => {
    switch (status.type) {
      case 'active':
        return 'status-active';
      case 'threw-today':
        return 'status-danger';
      case 'resting':
        if (status.daysNeeded === 4) return 'status-danger';
        if (status.daysNeeded === 3) return 'status-warning';
        if (status.daysNeeded === 2) return 'status-caution';
        return 'status-neutral';
      case 'no-data':
      default:
        return 'status-neutral';
    }
  };

  const getDotColor = () => {
    switch (status.type) {
      case 'active':
        return 'bg-status-active';
      case 'threw-today':
        return 'bg-status-danger';
      case 'resting':
        if (status.daysNeeded === 4) return 'bg-status-danger';
        if (status.daysNeeded === 3) return 'bg-status-warning';
        if (status.daysNeeded === 2) return 'bg-status-caution';
        return 'bg-muted-foreground';
      case 'no-data':
      default:
        return 'bg-status-neutral';
    }
  };

  const getLabel = () => {
    switch (status.type) {
      case 'no-data':
        return 'No Data';
      case 'threw-today':
        return 'Threw Today';
      case 'active':
        return 'Active';
      case 'resting':
        if (compact) {
          return `Day ${status.daysCurrent}/${status.daysNeeded}`;
        }
        return `${status.daysNeeded} Days Rest (Day ${status.daysCurrent} of ${status.daysNeeded})`;
    }
  };

  return (
    <span className={cn('status-badge', getStatusStyles(), className)}>
      <span className={cn('w-2 h-2 rounded-full shrink-0', getDotColor())} />
      <span className="truncate">{getLabel()}</span>
    </span>
  );
}
