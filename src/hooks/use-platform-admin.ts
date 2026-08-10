import { useAuth } from '@/hooks/use-auth';
import { isPlatformAdminEmail } from '@/lib/admin-access';

/**
 * True only for the small allow-list of people who can approve/reject new
 * coach signups app-wide. Used to gate the "Pending approvals" menu entry
 * so non-admins never see it — the manage-approvals edge function enforces
 * the same check server-side regardless.
 */
export function useIsPlatformAdmin(): { isAdmin: boolean; isLoading: boolean } {
  const { user, loading } = useAuth();
  return { isAdmin: isPlatformAdminEmail(user?.email), isLoading: loading };
}
