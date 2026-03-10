import { useState } from 'react';
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
import { getPulseLevel, getPulseColorClasses, DEFAULT_MAX_WEEKLY_PITCHES } from '@/lib/pulse-status';
import { ChevronDown, ChevronUp } from 'lucide-react';

type SortKey = 'name' | 'pulse' | 'strikeRate' | 'maxVelo' | 'lastOuting' | 'lastPitches';

interface PitcherTableProps {
  pitchers: Pitcher[];
  onPitcherClick?: (pitcher: Pitcher) => void;
  pitcherMaxPitches?: Record<string, number>;
}

export function PitcherTable({ pitchers, onPitcherClick, pitcherMaxPitches = {} }: PitcherTableProps) {
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir(key === 'name' ? 'asc' : 'desc');
    }
  };

  const sortedPitchers = sortKey
    ? [...pitchers].sort((a, b) => {
        let av: number | string, bv: number | string;
        if (sortKey === 'name') { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
        else if (sortKey === 'pulse') { av = a.sevenDayPulse; bv = b.sevenDayPulse; }
        else if (sortKey === 'strikeRate') { av = a.strikePercentage; bv = b.strikePercentage; }
        else if (sortKey === 'maxVelo') { av = a.maxVelo || 0; bv = b.maxVelo || 0; }
        else if (sortKey === 'lastOuting') { av = a.lastOuting || ''; bv = b.lastOuting || ''; }
        else { av = a.lastPitchCount; bv = b.lastPitchCount; }
        if (av < bv) return sortDir === 'asc' ? -1 : 1;
        if (av > bv) return sortDir === 'asc' ? 1 : -1;
        return 0;
      })
    : pitchers;

  const SortIcon = ({ col }: { col: SortKey }) =>
    sortKey === col
      ? (sortDir === 'desc' ? <ChevronDown className="inline w-3 h-3 ml-0.5" /> : <ChevronUp className="inline w-3 h-3 ml-0.5" />)
      : <ChevronDown className="inline w-3 h-3 ml-0.5 opacity-25" />;

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
            {([
              { label: 'Pitcher Name', col: 'name',        align: ''       },
              { label: 'Focus',        col: null,           align: ''       },
              { label: '7-Day Pulse',  col: 'pulse',        align: 'center' },
              { label: 'Strike %',     col: 'strikeRate',   align: 'center' },
              { label: 'Max Velo',     col: 'maxVelo',      align: 'center' },
              { label: 'Last Outing',  col: 'lastOuting',   align: 'center' },
              { label: 'Last Pitches', col: 'lastPitches',  align: 'center' },
              { label: 'Rest Status',  col: null,           align: 'center' },
              { label: 'Notes',        col: null,           align: ''       },
            ] as { label: string; col: SortKey | null; align: string }[]).map(({ label, col, align }) => (
              <TableHead
                key={label}
                className={`text-primary font-display font-semibold ${align === 'center' ? 'text-center' : ''} ${col ? 'cursor-pointer select-none hover:text-primary/70 transition-colors' : ''}`}
                onClick={col ? () => handleSort(col) : undefined}
              >
                {label}{col && <SortIcon col={col} />}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedPitchers.map((pitcher) => {
            const maxPitches = pitcherMaxPitches[pitcher.name] || DEFAULT_MAX_WEEKLY_PITCHES;
            const pulseLevel = getPulseLevel(pitcher.sevenDayPulse, maxPitches);
            const pulseColors = getPulseColorClasses(pulseLevel);
            
            return (
              <TableRow 
                key={pitcher.id} 
                className="border-border/30 cursor-pointer hover:bg-primary/5 transition-colors"
                onClick={() => onPitcherClick?.(pitcher)}
              >
                <TableCell className="font-medium">{pitcher.name}</TableCell>
                <TableCell className="max-w-[150px] truncate text-muted-foreground">
                  {pitcher.focus || '-'}
                </TableCell>
                <TableCell className="text-center">
                  <span className={`font-medium ${pulseColors.text}`}>
                    {pitcher.sevenDayPulse}
                    {pulseLevel !== 'normal' && <span className="text-xs ml-1">/ {maxPitches}</span>}
                  </span>
                </TableCell>
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
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
