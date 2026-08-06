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
 * How long the consent card is willing to wait for the server-side
 * `api_connect_completed` capture (T12/D9) before redirecting anyway.
 */
export const CONNECT_ANALYTICS_DEADLINE_MS = 2_000;

/**
 * Wait for `work`, but never longer than `deadlineMs`; resolves either way and
 * never rejects.
 *
 * This exists for the one spot where the consent card fires the server-side
 * `api_connect_completed` capture and then hands control back to the
 * connecting app via `window.location.assign`:
 *
 * - Fire-and-forget is wrong here — the navigation on the very next line
 *   aborts in-flight fetches, so the capture would be dropped most of the
 *   time, and this is the event's only call site.
 * - An unbounded `await` is also wrong — nothing in the tRPC link chain
 *   (`@/trpc/react`, `@/trpc/query-client`) sets a timeout or AbortSignal, so
 *   a stalled analytics call would hold the user on the consent page instead
 *   of returning them to the app.
 *
 * Bounding the wait keeps the capture in the normal case and caps the
 * pathological one.
 */
export function settleWithin(
  work: Promise<unknown>,
  deadlineMs: number,
): Promise<void> {
  return new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, deadlineMs);
    void work
      .catch(() => undefined)
      .then(() => {
        clearTimeout(timer);
        resolve();
      });
  });
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
