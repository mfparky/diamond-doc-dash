import { useAuth } from '@/hooks/use-auth';
import { isRankingsAdminEmail } from '@/lib/admin-access';

/**
 * True only for the small allow-list of coaches with access to the Player
 * Rankings page. Used to gate both the route and the More-sheet entry so
 * non-admins never see it.
 */
export function useIsRankingsAdmin(): { isAdmin: boolean; isLoading: boolean } {
  const { user, loading } = useAuth();
  return { isAdmin: isRankingsAdminEmail(user?.email), isLoading: loading };
}
