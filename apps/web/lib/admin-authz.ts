/**
 * Admin moderation allowlist check.
 *
 * `ADMIN_EMAILS` is a comma-separated list of emails allowed to moderate
 * pending submissions. Deliberately separate from `ADMIN_ALERT_EMAILS`
 * (who receives notification emails) — see plans/002-admin-moderation-console.
 *
 * An env-var allowlist beats a `profile.isAdmin` column for now: no schema
 * change, no RLS surface to get wrong, no self-grant path.
 *
 * Extracted from `adminProcedure` (server/api/trpc.ts) so it is unit-testable
 * and reusable by the page-level defense-in-depth check.
 */

/**
 * Parse a comma-separated admin allowlist into normalized, case-insensitive
 * entries. Trims whitespace and drops empty entries.
 */
function parseAdminAllowlist(raw: string): string[] {
  return raw
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0);
}

/**
 * Returns true if `email` is present in the `ADMIN_EMAILS` allowlist.
 * Case-insensitive. Returns false for a null/undefined/empty email or an
 * empty allowlist.
 */
export function isAdminEmail(
  email: string | null | undefined,
  adminEmails: string,
): boolean {
  if (!email) {
    return false;
  }

  const allowlist = parseAdminAllowlist(adminEmails);
  return allowlist.includes(email.trim().toLowerCase());
}
