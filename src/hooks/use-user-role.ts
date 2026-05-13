import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';

export type TeamRole = 'owner' | 'member' | 'scorekeeper';

/**
 * Returns the highest-privilege role this user holds across any team.
 * Scorekeepers are restricted to the live pitch counter only.
 */
export function useUserRole() {
  const { user, loading: authLoading } = useAuth();
  const [role, setRole] = useState<TeamRole | null>(null);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setRole(null);
      setTeamId(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('team_members')
        .select('role, team_id')
        .eq('user_id', user.id);
      if (cancelled) return;
      const rows = (data || []) as { role: string; team_id: string }[];
      // Priority: owner > member > scorekeeper
      const priority = (r: string) => (r === 'owner' ? 3 : r === 'member' ? 2 : r === 'scorekeeper' ? 1 : 0);
      const top = rows.sort((a, b) => priority(b.role) - priority(a.role))[0];
      setRole((top?.role as TeamRole) ?? null);
      setTeamId(top?.team_id ?? null);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user, authLoading]);

  return { role, teamId, loading: authLoading || loading, isScorekeeper: role === 'scorekeeper' };
}
