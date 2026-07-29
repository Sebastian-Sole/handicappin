/**
 * Pure helpers for the /oauth/consent Connect flow (api-platform subplan 004).
 *
 * Extracted from the consent page/card and the login resume path so the flow
 * logic is unit-testable in the node environment (repo pattern: UI logic
 * lives in `@/lib` with plain vitest coverage; there is no DOM-render test
 * infra — full-page behavior belongs to e2e).
 */

/**
 * Query param the login surfaces honor to resume an interrupted flow after
 * sign-in (e.g. a signed-out user arriving at /oauth/consent via a deeplink).
 */
export const LOGIN_REDIRECT_PARAM = "redirect";

/**
 * Validate a candidate post-login redirect as an INTERNAL app path.
 *
 * Open-redirect guard: only single-slash-rooted paths pass. "//evil.example"
 * (protocol-relative) and "/\evil.example" (browsers normalize the backslash)
 * would leave the origin, and absolute URLs never qualify. Returns null for
 * anything unsafe so callers fall back to their default destination.
 */
export function safeInternalPath(
  candidate: string | null | undefined,
): string | null {
  if (!candidate) return null;
  if (!candidate.startsWith("/")) return null;
  if (candidate.startsWith("//") || candidate.startsWith("/\\")) return null;
  return candidate;
}

/** The consent page URL for a pending authorization (GoTrue's param name). */
export function consentPath(authorizationId: string): string {
  return `/oauth/consent?authorization_id=${encodeURIComponent(authorizationId)}`;
}

/**
 * Login URL that resumes the pending consent request after sign-in. The
 * pending authorization survives server-side, so completing login and
 * returning to the consent path continues the flow seamlessly.
 */
export function loginPathForConsent(authorizationId: string): string {
  return `/login?${LOGIN_REDIRECT_PARAM}=${encodeURIComponent(
    consentPath(authorizationId),
  )}`;
}

/**
 * Best-effort host extraction for display ("You will be sent back to X").
 * Returns null when the value isn't an absolute URL with a host.
 */
export function deriveHost(uri: string | null | undefined): string | null {
  if (!uri) return null;
  try {
    return new URL(uri).host || null;
  } catch {
    return null;
  }
}
