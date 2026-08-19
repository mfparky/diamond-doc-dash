import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import type { TeamRole } from '@/lib/team-membership';

export interface TeamMembership {
  teamId: string;
  teamName: string;
  role: TeamRole;
}

const ACTIVE_TEAM_STORAGE_KEY = 'diamond-doc-dash:active-team-id';

function readStoredActiveTeamId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_TEAM_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStoredActiveTeamId(teamId: string | null) {
  try {
    if (teamId) {
      localStorage.setItem(ACTIVE_TEAM_STORAGE_KEY, teamId);
    } else {
      localStorage.removeItem(ACTIVE_TEAM_STORAGE_KEY);
    }
  } catch {
    // localStorage unavailable (private mode, etc.) — active team just
    // won't persist across reloads, not fatal.
  }
}

/**
 * Full list of the current user's team memberships, plus which one is
 * "active" (used to scope reads/writes app-wide). Supersedes the
 * single-team assumption in useUserRole for any UI that needs to show or
 * change all of a multi-team user's memberships.
 */
export function useTeamMemberships() {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id ?? null;
  const [memberships, setMemberships] = useState<TeamMembership[]>([]);
  const [activeTeamId, setActiveTeamIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!userId) {
      setMemberships([]);
      setActiveTeamIdState(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase.rpc('get_my_team_memberships');
    if (error) {
      setLoading(false);
      return;
    }

    const rows: TeamMembership[] = (data || []).map((row) => ({
      teamId: row.team_id,
      teamName: row.team_name,
      role: row.role as TeamRole,
    }));
    setMemberships(rows);

    setActiveTeamIdState((prevActive) => {
      const stored = readStoredActiveTeamId();
      const candidates = [prevActive, stored].filter(
        (id): id is string => !!id && rows.some((r) => r.teamId === id),
      );
      const next = candidates[0] ?? rows[0]?.teamId ?? null;
      writeStoredActiveTeamId(next);
      return next;
    });

    setLoading(false);
  }, [userId]);

  useEffect(() => {
    if (authLoading) return;
    refetch();
  }, [authLoading, refetch]);

  const setActiveTeamId = useCallback((teamId: string) => {
    setActiveTeamIdState(teamId);
    writeStoredActiveTeamId(teamId);
  }, []);

  return {
    memberships,
    activeTeamId,
    activeMembership: memberships.find((m) => m.teamId === activeTeamId) ?? null,
    setActiveTeamId,
    loading: authLoading || loading,
    refetch,
  };
}
