/**
 * THE SEAM between the `/v1` scaffolding (this PR) and the `/v1` rate
 * limiters (T13.0a, which owns `apps/web/lib/rate-limit.ts` and `env.ts`).
 *
 * ── Why there is no import from `@/lib/rate-limit` here ────────────────────
 * T13.0a is adding the four `RATE_LIMIT_*` env vars and the per-route-family
 * limiters to that module concurrently. Importing its types would put this
 * file in the path of those edits for no benefit, so the seam is defined
 * STRUCTURALLY instead: `V1RateLimitOutcome` below is a subset of the shipped
 * `PublicApiRateLimitResult` (`lib/rate-limit.ts:306-316`), so a value of
 * that type is assignable here with no adapter, no cast, and no import. If
 * T13.0a's per-route limiters keep returning that shape — and §3 requires
 * them to, since the response contract is populated "from the limiter
 * result" — the two halves compose on first contact.
 *
 * ── The contract of the seam (contract §3, ~:200-201) ─────────────────────
 * A route handler calls T13.0a's fail-closed limiter, gets back a result
 * carrying limit / remaining / reset, and hands it to `rateLimitResponse()`:
 *
 *   const limit = await enforce<Family>RateLimit(request, identifier);
 *   if (!limit.success) return rateLimitResponse(limit);
 *
 * That renders exactly two outcomes, and no others:
 *
 *   - budget exhausted (`failedClosed: false`) → **429 `rate_limited`** with
 *     `Retry-After` (seconds, derived from `reset`) plus the
 *     `X-RateLimit-Limit` / `-Remaining` / `-Reset` trio (unix seconds).
 *   - limiter infrastructure unavailable (`failedClosed: true`) →
 *     **503 `service_unavailable`** with `Retry-After: 60`.
 *
 * The internal reason (`disabled` / `missing-credentials` / `init-error` /
 * `runtime-error`) is NOT read here and must never reach the body — the
 * registry stays closed and `detail` leaks no infrastructure reason (§1).
 * The shipped limiter already Sentry-alerts every fail-closed denial, so
 * this module deliberately does not alert again.
 *
 * ── What this module does NOT do ──────────────────────────────────────────
 * It does not create limiters, read env vars, or touch Redis. That is
 * T13.0a's half. The one thing it contributes to the key is
 * `v1RateLimitIdentifier()`, because the `(client_id, user)` pair is derived
 * from the PRINCIPAL, which is this PR's piece.
 */

import { createProblem, type ProblemDocument } from "@/lib/api/problem";
import { problemResponse } from "@/app/api/v1/_lib/problem-response";
import type { V1Principal } from "@/app/api/v1/_lib/principal";

/**
 * The subset of a limiter result `/v1` renders from. Structurally satisfied
 * by `PublicApiRateLimitResult` — see the header for why it is not imported.
 */
export interface V1RateLimitOutcome {
  /** Whether the request may proceed. */
  success: boolean;
  /** True when the denial came from the fail-closed policy, not a real limit. */
  failedClosed: boolean;
  /** The budget for the window. */
  limit: number;
  /** Requests left in the window. */
  remaining: number;
  /** Window reset, epoch **milliseconds** (as `@upstash/ratelimit` returns). */
  reset: number;
}

/** `Retry-After` for a fail-closed 503 (§3). */
export const SERVICE_UNAVAILABLE_RETRY_AFTER_SECONDS = 60;

/**
 * Seconds until the window resets, floored at 1 — a `Retry-After: 0` invites
 * an immediate retry into the same exhausted bucket.
 */
export function retryAfterSeconds(
  outcome: V1RateLimitOutcome,
  now: number = Date.now()
): number {
  if (outcome.failedClosed) {
    return SERVICE_UNAVAILABLE_RETRY_AFTER_SECONDS;
  }
  return Math.max(1, Math.ceil((outcome.reset - now) / 1000));
}

/**
 * Headers for a limited response.
 *
 * The `X-RateLimit-*` trio is emitted only on a real 429: on a fail-closed
 * 503 the limiter never ran, so `limit: 0 / remaining: 0` are placeholders
 * and publishing them would state a budget that does not exist. `Retry-After`
 * is emitted in both cases. (`X-RateLimit-Reset` is unix SECONDS — the
 * convention of the target fitness-API domain — while `reset` is millis.)
 */
export function rateLimitHeaders(
  outcome: V1RateLimitOutcome,
  now: number = Date.now()
): Record<string, string> {
  const headers: Record<string, string> = {
    "Retry-After": String(retryAfterSeconds(outcome, now)),
  };
  if (!outcome.failedClosed) {
    headers["X-RateLimit-Limit"] = String(outcome.limit);
    headers["X-RateLimit-Remaining"] = String(Math.max(0, outcome.remaining));
    headers["X-RateLimit-Reset"] = String(Math.ceil(outcome.reset / 1000));
  }
  return headers;
}

/** `429 rate_limited` or `503 service_unavailable`, per §3. */
export function rateLimitProblem(
  outcome: V1RateLimitOutcome,
  context: { instance?: string } = {}
): ProblemDocument {
  return createProblem({
    code: outcome.failedClosed ? "service_unavailable" : "rate_limited",
    instance: context.instance,
  });
}

/** The full response a handler returns when the limiter denies. */
export function rateLimitResponse(
  outcome: V1RateLimitOutcome,
  context: { instance?: string; now?: number } = {}
): Response {
  const now = context.now ?? Date.now();
  return problemResponse(rateLimitProblem(outcome, context), {
    headers: rateLimitHeaders(outcome, now),
  });
}

/**
 * The `/v1` rate-limit identifier (§3, and D6 which ratifies it).
 *
 * - OAuth principal  → `client:{client_id}:user:{sub}` — the PAIR. Keying on
 *   `client_id` alone would collapse every fitbull user into one bucket so a
 *   single heavy user throttles everyone; keying on the user alone loses
 *   per-client attribution the moment a second client exists.
 * - First-party principal → `user:{sub}`, matching `getIdentifier`'s existing
 *   authenticated encoding (`lib/rate-limit.ts:423-427`) exactly.
 *
 * Pre-auth / invalid-token requests are keyed `ip:{ip}` — that path never
 * has a principal, so it is the limiter's own `getIdentifier` fallback and
 * is deliberately not reproduced here.
 */
export function v1RateLimitIdentifier(principal: V1Principal): string {
  return principal.class === "oauth"
    ? `client:${principal.clientId}:user:${principal.userId}`
    : `user:${principal.userId}`;
}
