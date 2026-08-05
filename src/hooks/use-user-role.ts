import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { getPrimaryMembership, type TeamRole } from '@/lib/team-membership';

export type { TeamRole };

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
      const primary = await getPrimaryMembership(user.id);
      if (cancelled) return;
      setRole(primary?.role ?? null);
      setTeamId(primary?.teamId ?? null);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user, authLoading]);

  return { role, teamId, loading: authLoading || loading, isScorekeeper: role === 'scorekeeper' };
}
