import { supabase } from '@/integrations/supabase/client';

export type TeamRole = 'owner' | 'member' | 'scorekeeper';

const ROLE_PRIORITY: Record<string, number> = { owner: 3, member: 2, scorekeeper: 1 };

/**
 * Picks the user's highest-privilege team membership (owner > member > scorekeeper).
 * Single-team-per-user heuristic — shared by useUserRole and by insert paths that
 * need to stamp team_id on a new row. Superseded by an explicit "active team"
 * selection once a user can belong to multiple teams (Phase 3).
 */
export async function getPrimaryMembership(
  userId: string,
): Promise<{ teamId: string; role: TeamRole } | null> {
  const { data } = await supabase
    .from('team_members')
    .select('role, team_id')
    .eq('user_id', userId);

  const rows = (data || []) as { role: string; team_id: string }[];
  if (rows.length === 0) return null;

  const top = rows.sort(
    (a, b) => (ROLE_PRIORITY[b.role] ?? 0) - (ROLE_PRIORITY[a.role] ?? 0),
  )[0];

  return { teamId: top.team_id, role: top.role as TeamRole };
}
