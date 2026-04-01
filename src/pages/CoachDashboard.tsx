import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Outing } from '@/types/pitcher';
import { ArrowLeft } from 'lucide-react';
import { usePageMeta } from '@/hooks/use-page-meta';
import hawksLogo from '@/assets/hawks-logo.png';
import { CombinedDashboard } from '@/components/CombinedDashboard';
import { PitchTypeConfig, DEFAULT_PITCH_TYPES } from '@/types/pitch-location';

export default function CoachDashboard() {
  const navigate = useNavigate();
  const { userId } = useParams<{ userId: string }>();
  const [outings, setOutings] = useState<Outing[]>([]);
  const [pitcherPitchTypes, setPitcherPitchTypes] = useState<Record<string, PitchTypeConfig>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  usePageMeta({
    title: 'Season Dashboard',
    description: 'View all pitcher stats for the season.',
  });

  useEffect(() => {
    if (!userId) {
      setError('Invalid link');
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchData() {
      try {
        setIsLoading(true);

        // Fetch all pitchers owned by this user
        const { data: pitchersData, error: pitchersError } = await supabase
          .from('pitchers')
          .select('*')
          .eq('user_id', userId);

        if (pitchersError) throw pitchersError;

        if (!pitchersData || pitchersData.length === 0) {
          if (!cancelled) {
            setOutings([]);
            setIsLoading(false);
          }
          return;
        }

        // Build pitch types map
        const ptMap: Record<string, PitchTypeConfig> = {};
        pitchersData.forEach((p) => {
          ptMap[p.name] = (p.pitch_types as PitchTypeConfig) || DEFAULT_PITCH_TYPES;
        });

        // Fetch all outings for these pitchers
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

        if (!cancelled) {
          setOutings(mappedOutings);
          setPitcherPitchTypes(ptMap);
          setIsLoading(false);
        }
      } catch (err) {
        console.error('Error loading dashboard data:', err);
        if (!cancelled) {
          setError('Failed to load data');
          setIsLoading(false);
        }
      }
    }

    fetchData();
    return () => { cancelled = true; };
  }, [userId]);

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
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border/50">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full hover:bg-secondary/80 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-foreground" />
          </button>
          <img src={hawksLogo} alt="Team" className="w-10 h-10 object-contain shrink-0" />
          <div className="min-w-0">
            <h1 className="font-display text-xl font-bold text-foreground truncate">All Pitchers</h1>
            <p className="text-xs text-muted-foreground">Season Dashboard</p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        <CombinedDashboard
          outings={outings}
          pitcherPitchTypes={pitcherPitchTypes}
          parentMode
        />
      </main>
    </div>
  );
}
