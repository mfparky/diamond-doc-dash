import { Pitcher, getDaysRestNeeded } from '@/types/pitcher';
import { StatusBadge } from './StatusBadge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface PitcherTableProps {
  pitchers: Pitcher[];
  onPitcherClick?: (pitcher: Pitcher) => void;
}

export function PitcherTable({ pitchers, onPitcherClick }: PitcherTableProps) {
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="glass-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="border-border/50 hover:bg-transparent">
            <TableHead className="text-primary font-display font-semibold">Pitcher Name</TableHead>
            <TableHead className="text-primary font-display font-semibold">Focus</TableHead>
            <TableHead className="text-primary font-display font-semibold text-center">7-Day Pulse</TableHead>
            <TableHead className="text-primary font-display font-semibold text-center">Strike %</TableHead>
            <TableHead className="text-primary font-display font-semibold text-center">Max Velo</TableHead>
            <TableHead className="text-primary font-display font-semibold text-center">Last Outing</TableHead>
            <TableHead className="text-primary font-display font-semibold text-center">Last Pitches</TableHead>
            <TableHead className="text-primary font-display font-semibold text-center">Rest Status</TableHead>
            <TableHead className="text-primary font-display font-semibold">Notes</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pitchers.map((pitcher) => (
            <TableRow 
              key={pitcher.id} 
              className="border-border/30 cursor-pointer hover:bg-primary/5 transition-colors"
              onClick={() => onPitcherClick?.(pitcher)}
            >
              <TableCell className="font-medium">{pitcher.name}</TableCell>
              <TableCell className="max-w-[150px] truncate text-muted-foreground">
                {pitcher.focus || '-'}
              </TableCell>
              <TableCell className="text-center">{pitcher.sevenDayPulse}</TableCell>
              <TableCell className="text-center">{pitcher.strikePercentage.toFixed(2)}%</TableCell>
              <TableCell className="text-center">{pitcher.maxVelo || 0}</TableCell>
              <TableCell className="text-center">{formatDate(pitcher.lastOuting)}</TableCell>
              <TableCell className="text-center">
                {pitcher.lastPitchCount > 0 ? (
                  <span className="text-muted-foreground">
                    {pitcher.lastPitchCount} <span className="text-xs">({getDaysRestNeeded(pitcher.lastPitchCount)}d rest)</span>
                  </span>
                ) : '-'}
              </TableCell>
              <TableCell className="text-center">
                <StatusBadge status={pitcher.restStatus} />
              </TableCell>
              <TableCell className="max-w-[200px] truncate text-muted-foreground">
                {pitcher.notes || '-'}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
