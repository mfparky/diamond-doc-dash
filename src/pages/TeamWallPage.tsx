import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Flame } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { WorkoutGallery } from '@/components/WorkoutGallery';
import { usePageMeta } from '@/hooks/use-page-meta';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export default function TeamWallPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const navigate = useNavigate();
  const [teamName, setTeamName] = useState('Team');
  const [pitcherIds, setPitcherIds] = useState<string[]>([]);

  usePageMeta({
    title: `${teamName} | Workout Wall`,
    description: `Celebrating the hard work from ${teamName}.`,
  });

  useEffect(() => {
    if (!teamId) return;
    async function load() {
      const [{ data: team }, { data: pitchers }] = await Promise.all([
        supabase.from('teams').select('name').eq('id', teamId!).single(),
        supabase.from('pitchers').select('id').eq('team_id', teamId!),
      ]);
      if (team) setTeamName(team.name);
      if (pitchers) setPitcherIds(pitchers.map((p) => p.id));
    }
    load();
  }, [teamId]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b">
        <div className="max-w-2xl mx-auto flex items-center gap-3 px-4 py-3">
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Flame className="w-4 h-4 text-primary" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-bold text-foreground truncate">Workout Wall</h1>
              <p className="text-[11px] text-muted-foreground truncate">{teamName}</p>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </div>

      {/* Feed */}
      <div className="max-w-2xl mx-auto px-4 py-6">
        {teamId && (
          <WorkoutGallery
            teamId={teamId}
            pitcherIds={pitcherIds.length > 0 ? pitcherIds : undefined}
          />
        )}
      </div>
    </div>
  );
}
