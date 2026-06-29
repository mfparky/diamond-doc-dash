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
