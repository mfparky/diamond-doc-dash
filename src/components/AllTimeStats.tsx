import { useState, useMemo } from 'react';
import { Outing, Pitcher } from '@/types/pitcher';
import { PitcherCard } from './PitcherCard';
import { Button } from '@/components/ui/button';
import { LayoutGrid, Table as TableIcon } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface AllTimeStatsProps {
  outings: Outing[];
  pitchers?: Pitcher[];
  pitcherMaxPitches?: Record<string, number>;
  onPitcherClick?: (pitcher: Pitcher) => void;
}

interface PitcherStats {
  name: string;
  totalPitches: number;
  totalStrikes: number;
  pitchesWithStrikesTracked: number;
  strikePercentage: number;
  maxVelocity: number;
  bullpens: number;
  games: number;
  external: number;
  practices: number;
  totalOutings: number;
}

export function AllTimeStats({ outings, pitchers = [], pitcherMaxPitches = {}, onPitcherClick }: AllTimeStatsProps) {
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  // Filter outings to 2026 season (Jan 1 - Dec 31, 2026)
  const seasonOutings = useMemo(() => {
    return outings.filter(outing => {
      const date = new Date(outing.date);
      return date.getFullYear() === 2026;
    });
  }, [outings]);

  // Aggregate stats by pitcher
  const pitcherStats = useMemo(() => {
    const statsMap = new Map<string, PitcherStats>();

    seasonOutings.forEach(outing => {
      const existing = statsMap.get(outing.pitcherName) || {
        name: outing.pitcherName,
        totalPitches: 0,
        totalStrikes: 0,
        pitchesWithStrikesTracked: 0,
        strikePercentage: 0,
        maxVelocity: 0,
        bullpens: 0,
        games: 0,
        external: 0,
        practices: 0,
        totalOutings: 0,
      };

      existing.totalPitches += outing.pitchCount;
      // Only count strikes and pitches for strike % when strikes were actually tracked
      if (outing.strikes !== null && outing.strikes !== undefined) {
        existing.totalStrikes += outing.strikes;
        existing.pitchesWithStrikesTracked += outing.pitchCount;
      }
      existing.maxVelocity = Math.max(existing.maxVelocity, outing.maxVelo || 0);
      existing.totalOutings += 1;

      switch (outing.eventType) {
        case 'Bullpen':
          existing.bullpens += 1;
          break;
        case 'Game':
          existing.games += 1;
          break;
        case 'External':
          existing.external += 1;
          break;
        case 'Practice':
          existing.practices += 1;
          break;
      }

      statsMap.set(outing.pitcherName, existing);
    });

    // Calculate strike percentage and sort alphabetically
    return Array.from(statsMap.values())
      .map(stats => ({
        ...stats,
        strikePercentage: stats.pitchesWithStrikesTracked > 0 
          ? Math.round((stats.totalStrikes / stats.pitchesWithStrikesTracked) * 100) 
          : 0,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [seasonOutings]);

  // Calculate team totals
  const teamTotals = useMemo(() => {
    return pitcherStats.reduce(
      (acc, stats) => ({
        totalPitches: acc.totalPitches + stats.totalPitches,
        totalStrikes: acc.totalStrikes + stats.totalStrikes,
        pitchesWithStrikesTracked: acc.pitchesWithStrikesTracked + stats.pitchesWithStrikesTracked,
        bullpens: acc.bullpens + stats.bullpens,
        games: acc.games + stats.games,
        external: acc.external + stats.external,
        practices: acc.practices + stats.practices,
        totalOutings: acc.totalOutings + stats.totalOutings,
      }),
      { totalPitches: 0, totalStrikes: 0, pitchesWithStrikesTracked: 0, bullpens: 0, games: 0, external: 0, practices: 0, totalOutings: 0 }
    );
  }, [pitcherStats]);

  const teamStrikePercentage = teamTotals.pitchesWithStrikesTracked > 0 
    ? Math.round((teamTotals.totalStrikes / teamTotals.pitchesWithStrikesTracked) * 100) 
    : 0;

  return (
    <div className="animate-slide-up">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-bold text-foreground mb-1">
            2026 Season Stats
          </h2>
          <p className="text-muted-foreground">
            January 1 - December 31, 2026 • {pitcherStats.length} pitchers • {teamTotals.totalOutings} total outings
          </p>
        </div>
        <div className="flex items-center bg-secondary rounded-lg p-1 w-fit">
          <Button
            variant="ghost"
            size="sm"
            className={`h-8 px-3 text-sm font-medium gap-1.5 ${viewMode === 'cards' ? 'bg-card shadow-sm' : ''}`}
            onClick={() => setViewMode('cards')}
          >
            <LayoutGrid className="w-4 h-4" />
            Cards
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={`h-8 px-3 text-sm font-medium gap-1.5 ${viewMode === 'table' ? 'bg-card shadow-sm' : ''}`}
            onClick={() => setViewMode('table')}
          >
            <TableIcon className="w-4 h-4" />
            Table
          </Button>
        </div>
      </div>

      {viewMode === 'cards' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {pitchers.map((pitcher) => (
            <PitcherCard
              key={pitcher.id}
              pitcher={pitcher}
              onClick={() => onPitcherClick?.(pitcher)}
              maxWeeklyPitches={pitcherMaxPitches[pitcher.name] || 100}
            />
          ))}
        </div>
      )}

      {viewMode === 'table' && (
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-semibold">Pitcher</TableHead>
                <TableHead className="text-center font-semibold">Total Pitches</TableHead>
                <TableHead className="text-center font-semibold">Total Strikes</TableHead>
                <TableHead className="text-center font-semibold">Strike %</TableHead>
                <TableHead className="text-center font-semibold">Max Velo</TableHead>
                <TableHead className="text-center font-semibold">Bullpens</TableHead>
                <TableHead className="text-center font-semibold">Games</TableHead>
                <TableHead className="text-center font-semibold">External</TableHead>
                <TableHead className="text-center font-semibold">Practices</TableHead>
                <TableHead className="text-center font-semibold">Total Outings</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pitcherStats.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                    No outings recorded for the 2026 season yet.
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {pitcherStats.map((stats) => (
                    <TableRow key={stats.name} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="font-medium">{stats.name}</TableCell>
                      <TableCell className="text-center">{stats.totalPitches}</TableCell>
                      <TableCell className="text-center">{stats.totalStrikes}</TableCell>
                      <TableCell className="text-center">{stats.strikePercentage}%</TableCell>
                      <TableCell className="text-center">
                        {stats.maxVelocity > 0 ? `${stats.maxVelocity} mph` : '—'}
                      </TableCell>
                      <TableCell className="text-center">{stats.bullpens}</TableCell>
                      <TableCell className="text-center">{stats.games}</TableCell>
                      <TableCell className="text-center">{stats.external}</TableCell>
                      <TableCell className="text-center">{stats.practices}</TableCell>
                      <TableCell className="text-center font-medium">{stats.totalOutings}</TableCell>
                    </TableRow>
                  ))}
                  {/* Team Totals Row */}
                  <TableRow className="bg-muted/50 font-semibold border-t-2 border-border">
                    <TableCell>Team Totals</TableCell>
                    <TableCell className="text-center">{teamTotals.totalPitches}</TableCell>
                    <TableCell className="text-center">{teamTotals.totalStrikes}</TableCell>
                    <TableCell className="text-center">{teamStrikePercentage}%</TableCell>
                    <TableCell className="text-center">—</TableCell>
                    <TableCell className="text-center">{teamTotals.bullpens}</TableCell>
                    <TableCell className="text-center">{teamTotals.games}</TableCell>
                    <TableCell className="text-center">{teamTotals.external}</TableCell>
                    <TableCell className="text-center">{teamTotals.practices}</TableCell>
                    <TableCell className="text-center">{teamTotals.totalOutings}</TableCell>
                  </TableRow>
                </>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
