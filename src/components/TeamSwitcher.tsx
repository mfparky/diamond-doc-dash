import { Users } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTeamMemberships } from '@/hooks/use-team-memberships';

/**
 * Only renders when the signed-in user belongs to more than one team.
 * Changing the selection updates the app-wide active team (persisted in
 * localStorage) that hooks/components scope their reads and writes to.
 */
export function TeamSwitcher() {
  const { memberships, activeTeamId, setActiveTeamId, loading } = useTeamMemberships();

  if (loading || memberships.length <= 1) return null;

  return (
    <Select value={activeTeamId ?? undefined} onValueChange={setActiveTeamId}>
      <SelectTrigger className="h-8 w-auto gap-1.5 text-xs">
        <Users className="w-3.5 h-3.5" />
        <SelectValue placeholder="Select team" />
      </SelectTrigger>
      <SelectContent>
        {memberships.map((m) => (
          <SelectItem key={m.teamId} value={m.teamId}>
            {m.teamName}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
