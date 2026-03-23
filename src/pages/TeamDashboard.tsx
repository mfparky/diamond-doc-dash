import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Outing } from '@/types/pitcher';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Users, Target, Gauge, Activity, Calendar, Trophy } from 'lucide-react';
import { usePageMeta } from '@/hooks/use-page-meta';
import hawksLogo from '@/assets/hawks-logo.png';
import { StrikePercentBar } from '@/components/StrikePercentBar';

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';

interface PitcherSeason {
  id: string;
  name: string;
  outings: Outing[];
  totalPitches: number;
  totalStrikes: number;
  strikePitches: number;
  strikePercent: number;
  maxVelo: number;
  outingCount: number;
}

export default function TeamDashboard() {
  const { teamId } = useParams<{ teamId: string }>();
  const [teamName, setTeamName] = useState('Team');
  const [pitcherSeasons, setPitcherSeasons] = useState<PitcherSeason[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  usePageMeta({
    title: `${teamName} | Season Dashboard`,
    description: `View ${teamName}'s season stats and pitcher performance.`,
  });

  useEffect(() => {
    if (!teamId) {
      setError('Team not found');
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchTeamData() {
      try {
        setIsLoading(true);

        // Fetch team name
        const { data: teamData } = await supabase
          .from('teams')
          .select('name')
          .eq('id', teamId)
          .maybeSingle();

        // Fetch pitchers on the team
        const { data: pitchersData, error: pitchersError } = await supabase
          .from('pitchers')
          .select('*')
          .eq('team_id', teamId);

        if (pitchersError) throw pitchersError;
        if (!pitchersData || pitchersData.length === 0) {
          if (!cancelled) {
            setTeamName(teamData?.name || 'Team');
            setPitcherSeasons([]);
            setIsLoading(false);
          }
          return;
        }

        // Fetch all outings for team pitchers
        const pitcherNames = pitchersData.map((p) => p.name);
        const { data: outingsData, error: outingsError } = await supabase
          .from('outings')
          .select('*')
          .in('pitcher_name', pitcherNames)
          .order('date', { ascending: false });

        if (outingsError) throw outingsError;

        const mappedOutings: Outing[] = (outingsData || []).map((row) => ({
          id: row.id,
          timestamp: row.created_at,
          date: row.date,
          pitcherName: row.pitcher_name,
          eventType: row.event_type as Outing['eventType'],
          pitchCount: row.pitch_count,
          strikes: row.strikes,
          maxVelo: row.max_velocity ?? 0,
          notes: row.notes ?? '',
          videoUrl: row.video_url ?? undefined,
          focus: row.focus ?? undefined,
          coachNotes: row.coach_notes ?? undefined,
        }));

        // Filter to 2026 season
        const seasonOutings = mappedOutings.filter(
          (o) => new Date(o.date).getFullYear() === 2026
        );

        // Build per-pitcher stats
        const seasons: PitcherSeason[] = pitchersData.map((p) => {
          const pOutings = seasonOutings.filter((o) => o.pitcherName === p.name);
          const totalPitches = pOutings.reduce((s, o) => s + o.pitchCount, 0);
          const withStrikes = pOutings.filter((o) => o.strikes !== null);
          const strikePitches = withStrikes.reduce((s, o) => s + o.pitchCount, 0);
          const totalStrikes = withStrikes.reduce((s, o) => s + (o.strikes ?? 0), 0);
          const strikePercent = strikePitches > 0 ? (totalStrikes / strikePitches) * 100 : 0;
          const velocities = pOutings.map((o) => o.maxVelo).filter((v) => v > 0);
          const maxVelo = velocities.length > 0 ? Math.max(...velocities) : 0;

          return {
            id: p.id,
            name: p.name,
            outings: pOutings,
            totalPitches,
            totalStrikes,
            strikePitches,
            strikePercent,
            maxVelo,
            outingCount: pOutings.length,
          };
        });

        // Sort by total pitches descending
        seasons.sort((a, b) => b.totalPitches - a.totalPitches);

        if (!cancelled) {
          setTeamName(teamData?.name || 'Team');
          setPitcherSeasons(seasons);
          setIsLoading(false);
        }
      } catch (err) {
        console.error('Error loading team data:', err);
        if (!cancelled) {
          setError('Failed to load team data');
          setIsLoading(false);
        }
      }
    }

    fetchTeamData();
    return () => { cancelled = true; };
  }, [teamId]);

  // Team-wide totals
  const teamTotals = useMemo(() => {
    const totalPitches = pitcherSeasons.reduce((s, p) => s + p.totalPitches, 0);
    const totalStrikes = pitcherSeasons.reduce((s, p) => s + p.totalStrikes, 0);
    const totalStrikePitches = pitcherSeasons.reduce((s, p) => s + p.strikePitches, 0);
    const strikePercent = totalStrikePitches > 0 ? (totalStrikes / totalStrikePitches) * 100 : 0;
    const totalOutings = pitcherSeasons.reduce((s, p) => s + p.outingCount, 0);
    const velocities = pitcherSeasons.map((p) => p.maxVelo).filter((v) => v > 0);
    const maxVelo = velocities.length > 0 ? Math.max(...velocities) : 0;
    const activePitchers = pitcherSeasons.filter((p) => p.outingCount > 0).length;

    return { totalPitches, totalStrikes, strikePercent, totalOutings, maxVelo, activePitchers };
  }, [pitcherSeasons]);

  // Pitch count bar chart data
  const pitchCountChartData = useMemo(
    () =>
      pitcherSeasons
        .filter((p) => p.totalPitches > 0)
        .map((p) => ({
          name: p.name.split(' ').pop() || p.name, // Last name for chart
          pitches: p.totalPitches,
          fullName: p.name,
        })),
    [pitcherSeasons]
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <p className="text-destructive">{error}</p>
        <Link to="/" className="text-primary hover:underline flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border/50">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center gap-3">
          <img src={hawksLogo} alt="Team" className="w-10 h-10 object-contain shrink-0" />
          <div className="min-w-0">
            <h1 className="font-display text-xl font-bold text-foreground truncate">{teamName}</h1>
            <p className="text-xs text-muted-foreground">2026 Season Dashboard</p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Team Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          <SummaryCard label="Pitchers" value={String(teamTotals.activePitchers)} icon={<Users className="w-4 h-4" />} />
          <SummaryCard label="Outings" value={String(teamTotals.totalOutings)} icon={<Calendar className="w-4 h-4" />} />
          <SummaryCard label="Total Pitches" value={String(teamTotals.totalPitches)} icon={<Activity className="w-4 h-4" />} />
          <SummaryCard label="Strike %" value={`${teamTotals.strikePercent.toFixed(1)}%`} icon={<Target className="w-4 h-4" />} />
          <SummaryCard label="Team Max Velo" value={teamTotals.maxVelo > 0 ? String(teamTotals.maxVelo) : '-'} icon={<Gauge className="w-4 h-4" />} />
          <SummaryCard label="Total Strikes" value={String(teamTotals.totalStrikes)} icon={<Trophy className="w-4 h-4" />} />
        </div>

        {/* Total Pitches by Player Chart */}
        {pitchCountChartData.length > 0 && (
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="font-display text-lg">Pitches by Player</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={pitchCountChartData} margin={{ top: 10, right: 10, left: -10, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                      tickLine={{ stroke: 'hsl(var(--border))' }}
                      axisLine={{ stroke: 'hsl(var(--border))' }}
                      angle={-45}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                      tickLine={{ stroke: 'hsl(var(--border))' }}
                      axisLine={{ stroke: 'hsl(var(--border))' }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        color: 'hsl(var(--foreground))',
                      }}
                      formatter={(value: number, _: string, props: any) => [
                        `${value} pitches`,
                        props.payload.fullName,
                      ]}
                    />
                    <Bar dataKey="pitches" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Strike % Bar Chart */}
        <StrikePercentBar pitcherSeasons={pitcherSeasons} />

        {/* Player Roster Table */}
        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="font-display text-lg">Season Roster</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-muted-foreground border-b border-border/30">
                    <th className="text-left py-2 font-medium">Player</th>
                    <th className="text-center py-2 font-medium">Outings</th>
                    <th className="text-center py-2 font-medium">Pitches</th>
                    <th className="text-center py-2 font-medium">Strike %</th>
                    <th className="text-center py-2 font-medium">Max Velo</th>
                  </tr>
                </thead>
                <tbody>
                  {pitcherSeasons.map((p) => (
                    <tr key={p.id} className="border-b border-border/20">
                      <td className="py-2.5">
                        <Link
                          to={`/player/${p.id}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {p.name}
                        </Link>
                      </td>
                      <td className="text-center text-foreground">{p.outingCount}</td>
                      <td className="text-center text-foreground">{p.totalPitches}</td>
                      <td className="text-center text-foreground">
                        {p.strikePitches > 0 ? `${p.strikePercent.toFixed(1)}%` : '-'}
                      </td>
                      <td className="text-center text-foreground">
                        {p.maxVelo > 0 ? p.maxVelo : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function SummaryCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <Card className="glass-card">
      <CardContent className="p-3 flex flex-col items-center text-center gap-1.5">
        <div className="p-1.5 rounded-lg bg-primary/10 text-primary">{icon}</div>
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className="font-bold text-foreground text-lg">{value}</p>
      </CardContent>
    </Card>
  );
}
