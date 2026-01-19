import { RestStatus } from '@/types/pitcher';
import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: RestStatus;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const getStatusStyles = () => {
    switch (status) {
      case 'Active':
        return 'status-active';
      case 'Threw Today':
        return 'status-danger';
      case 'No Data':
      default:
        return 'status-neutral';
    }
  };

  const getDotColor = () => {
    switch (status) {
      case 'Active':
        return 'bg-status-active';
      case 'Threw Today':
        return 'bg-status-danger';
      case 'No Data':
      default:
        return 'bg-status-neutral';
    }
  };

  return (
    <span className={cn('status-badge', getStatusStyles(), className)}>
      <span className={cn('w-2 h-2 rounded-full', getDotColor())} />
      {status}
    </span>
  );
}
