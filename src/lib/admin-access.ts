/**
 * Allow-list of email addresses with access to the Player Rankings page.
 * Kept as a simple constant for now — easy to find when we want to widen
 * access or move it to a database-backed setting.
 *
 * Comparison is case-insensitive (emails per RFC 5321 are technically
 * case-sensitive in the local part but treating them otherwise has been
 * the de-facto standard for decades).
 */
const RANKINGS_ALLOWED_EMAILS = new Set<string>(['hawkscoachmatt@gmail.com']);

export function isRankingsAdminEmail(email: string | undefined | null): boolean {
  if (!email) return false;
  return RANKINGS_ALLOWED_EMAILS.has(email.trim().toLowerCase());
}

/**
 * Allow-list of email addresses who can approve/reject new coach signups
 * app-wide (the "Pending approvals" screen). Kept separate from the
 * rankings allow-list since they're different privileges, even though
 * today's list happens to be the same person.
 *
 * The manage-approvals edge function enforces this same check server-side
 * with its own copy of this list (edge functions run in Deno, outside this
 * Vite build, so it can't import this file) — keep both in sync.
 */
const PLATFORM_ADMIN_EMAILS = new Set<string>(['hawkscoachmatt@gmail.com']);

export function isPlatformAdminEmail(email: string | undefined | null): boolean {
  if (!email) return false;
  return PLATFORM_ADMIN_EMAILS.has(email.trim().toLowerCase());
}
