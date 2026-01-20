import { useMemo } from 'react';
import { Outing } from '@/types/pitcher';
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
}

interface PitcherStats {
  name: string;
  totalPitches: number;
  totalStrikes: number;
  strikePercentage: number;
  maxVelocity: number;
  bullpens: number;
  games: number;
  liveABs: number;
  practices: number;
  totalOutings: number;
}

export function AllTimeStats({ outings }: AllTimeStatsProps) {
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
        strikePercentage: 0,
        maxVelocity: 0,
        bullpens: 0,
        games: 0,
        liveABs: 0,
        practices: 0,
        totalOutings: 0,
      };

      existing.totalPitches += outing.pitchCount;
      existing.totalStrikes += outing.strikes || 0;
      existing.maxVelocity = Math.max(existing.maxVelocity, outing.maxVelo || 0);
      existing.totalOutings += 1;

      switch (outing.eventType) {
        case 'Bullpen':
          existing.bullpens += 1;
          break;
        case 'Game':
          existing.games += 1;
          break;
        case 'Live':
          existing.liveABs += 1;
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
        strikePercentage: stats.totalPitches > 0 
          ? Math.round((stats.totalStrikes / stats.totalPitches) * 100) 
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
        bullpens: acc.bullpens + stats.bullpens,
        games: acc.games + stats.games,
        liveABs: acc.liveABs + stats.liveABs,
        practices: acc.practices + stats.practices,
        totalOutings: acc.totalOutings + stats.totalOutings,
      }),
      { totalPitches: 0, totalStrikes: 0, bullpens: 0, games: 0, liveABs: 0, practices: 0, totalOutings: 0 }
    );
  }, [pitcherStats]);

  const teamStrikePercentage = teamTotals.totalPitches > 0 
    ? Math.round((teamTotals.totalStrikes / teamTotals.totalPitches) * 100) 
    : 0;

  return (
    <div className="animate-slide-up">
      <div className="mb-6">
        <h2 className="font-display text-2xl font-bold text-foreground mb-1">
          2026 Season Stats
        </h2>
        <p className="text-muted-foreground">
          January 1 - December 31, 2026 • {pitcherStats.length} pitchers • {teamTotals.totalOutings} total outings
        </p>
      </div>

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
              <TableHead className="text-center font-semibold">Live ABs</TableHead>
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
                    <TableCell className="text-center">{stats.liveABs}</TableCell>
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
                  <TableCell className="text-center">{teamTotals.liveABs}</TableCell>
                  <TableCell className="text-center">{teamTotals.practices}</TableCell>
                  <TableCell className="text-center">{teamTotals.totalOutings}</TableCell>
                </TableRow>
              </>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
