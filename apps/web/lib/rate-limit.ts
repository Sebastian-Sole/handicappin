import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { env } from "@/env";
import { logger } from "@/lib/logging";
import { captureSentryError } from "@/lib/sentry-utils";

/**
 * Rate limiting configuration
 *
 * Two policies live here (see docs/ingress-firewall-state.md and the
 * api-platform ingress runbook, W0):
 *
 * - First-party cookie/session endpoints (checkout, contact, webhooks, …)
 *   keep their historical FAIL-OPEN behavior: if the limiter can't run the
 *   request is allowed, but the failure is now Sentry-alerted instead of
 *   silently logged.
 * - The PUBLIC API surface (`/api/v1` paths and the `api.handicappin.com`
 *   host) FAILS CLOSED via `enforcePublicApiRateLimit()`: if
 *   `RATE_LIMIT_ENABLED` is not "true", KV credentials are missing, Redis
 *   init throws, or the limiter errors at request time, the request is
 *   DENIED and Sentry is alerted. That surface is split into per-route
 *   FAMILIES (`PUBLIC_API_RATE_LIMIT_FAMILIES`), one Redis bucket each, keyed
 *   on the `(client_id, user)` pair — see `getIdentifier`.
 *
 * `RATE_LIMIT_ENABLED` is asserted at startup for production deploys in
 * `apps/web/env.ts` (it must be explicitly "true" or "false"), so a
 * misconfigured deploy fails loudly at build/boot rather than at request
 * time.
 */
const isEnabled = env.RATE_LIMIT_ENABLED === "true";

// Configurable rate limits (validated/defaulted in env.ts)
const PUBLIC_API_LIMIT = env.RATE_LIMIT_PUBLIC_API_PER_MIN;
const CHECKOUT_LIMIT = env.RATE_LIMIT_CHECKOUT_PER_MIN;
const PORTAL_LIMIT = env.RATE_LIMIT_PORTAL_PER_MIN;
const WEBHOOK_LIMIT = env.RATE_LIMIT_WEBHOOK_PER_MIN;
const CONTACT_LIMIT = env.RATE_LIMIT_CONTACT_PER_MIN;
const DELETION_LIMIT = env.RATE_LIMIT_DELETION_PER_HOUR;
const OAUTH_CALLBACK_LIMIT = env.RATE_LIMIT_OAUTH_CALLBACK_PER_MIN;
const GOOGLE_TOKEN_LIMIT = env.RATE_LIMIT_GOOGLE_TOKEN_PER_MIN;
const CONSENT_LIMIT = env.RATE_LIMIT_CONSENT_PER_HOUR;
const AI_EXTRACTION_LIMIT = env.RATE_LIMIT_AI_EXTRACTION_PER_HOUR;

// Public API (`/api/v1`) per-route-family budgets. Names frozen in env.ts.
const V1_ROUNDS_WRITE_LIMIT = env.RATE_LIMIT_ROUNDS_WRITE_PER_MIN;
const V1_READS_LIMIT = env.RATE_LIMIT_API_READS_PER_MIN;
const V1_COURSE_SUBMIT_LIMIT = env.RATE_LIMIT_COURSE_SUBMIT_PER_HOUR;
const V1_PROVISION_LIMIT = env.RATE_LIMIT_PROVISION_PER_HOUR;

/** Why the shared limiter infrastructure is unavailable, if it is. */
export type RateLimiterUnavailableReason =
  | "disabled"
  | "missing-credentials"
  | "init-error";

/** Failure reasons surfaced by the fail-closed public API path. */
export type PublicApiRateLimitFailure =
  | RateLimiterUnavailableReason
  | "runtime-error";

let limiterUnavailableReason: RateLimiterUnavailableReason | null = null;

// Initialize Redis client (only if rate limiting is enabled)
let redis: Redis | null = null;
if (!isEnabled) {
  limiterUnavailableReason = "disabled";
  logger.info("Rate limit: Disabled (RATE_LIMIT_ENABLED is not 'true')");
} else {
  // Upstash Redis REST credentials (set directly from the Upstash console).
  // These are required by env.ts, but a deploy built with SKIP_ENV_VALIDATION
  // could still reach here without them — hence the runtime check.
  const restUrl = env.UPSTASH_REDIS_REST_URL;
  const restToken = env.UPSTASH_REDIS_REST_TOKEN;

  if (!restUrl || !restToken) {
    limiterUnavailableReason = "missing-credentials";
    logger.error("Rate limit: No Redis credentials found", {
      hint: "Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN",
    });
  } else {
    try {
      redis = new Redis({
        url: restUrl,
        token: restToken,
      });
      logger.info("Rate limit: Connected to Upstash Redis");
    } catch (error) {
      limiterUnavailableReason = "init-error";
      logger.error("Rate limit: Failed to initialize Redis client", {
        error: error instanceof Error ? error.message : String(error),
        firstPartyBehavior: "fail-open (allow)",
        publicApiBehavior: "fail-closed (deny)",
      });
    }
  }

  // Rate limiting was requested but cannot run: alert Sentry once at init so
  // fail-open on first-party paths (and fail-closed on the public API path)
  // never goes unnoticed. "disabled" is an explicit operator choice and is
  // not alerted here.
  if (limiterUnavailableReason) {
    captureSentryError(
      new Error(
        `Rate limiter unavailable at init (${limiterUnavailableReason}) while RATE_LIMIT_ENABLED=true`
      ),
      {
        level: "error",
        eventType: "rate-limit-unavailable",
        tags: { reason: limiterUnavailableReason },
      }
    );
  }
}

interface RateLimitResponse {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

interface Limiter {
  limit: (identifier: string) => Promise<RateLimitResponse>;
}

/** Fail-open bypass limiter used by first-party paths when the real limiter can't run. */
function bypassLimiter(limit: number, windowMs: number): Limiter {
  return {
    limit: async () => ({
      success: true,
      limit,
      remaining: limit,
      reset: Date.now() + windowMs,
    }),
  };
}

/**
 * Wrap a live first-party limiter so that a throw from `.limit()` at REQUEST
 * time fails OPEN instead of propagating to the caller.
 *
 * The init-time guards above only cover a limiter that never came up. Once the
 * limiter exists, a transient Upstash DNS/network blip surfaces as
 * `TypeError: fetch failed` (`getaddrinfo ENOTFOUND ...upstash.io`) out of the
 * `@upstash/ratelimit` pipeline. Without this wrapper that error propagates and
 * breaks the documented fail-open contract on revenue-adjacent flows (checkout,
 * webhooks, contact, AI extraction). We fall back to the bypass response and
 * still alert Sentry so the outage stays visible.
 */
function failOpenAtRuntime(
  limiter: Limiter,
  prefix: string,
  limit: number,
  windowMs: number
): Limiter {
  const bypass = bypassLimiter(limit, windowMs);
  return {
    limit: async (identifier: string) => {
      try {
        return await limiter.limit(identifier);
      } catch (error) {
        logger.error("Rate limit: limiter threw at request time - failing open", {
          prefix,
          error: error instanceof Error ? error.message : String(error),
        });
        captureSentryError(
          new Error(
            `First-party rate limiter threw at request time (${prefix}) — failing open`
          ),
          {
            level: "error",
            eventType: "rate-limit-runtime-error",
            tags: { prefix, behavior: "fail-open" },
          }
        );
        return bypass.limit(identifier);
      }
    },
  };
}

/**
 * Create a first-party rate limiter with sliding window algorithm.
 * FAIL-OPEN: falls back to a bypass limiter both when the infrastructure is
 * unavailable at init (init failures are Sentry-alerted above) AND when the
 * live limiter throws at request time (see `failOpenAtRuntime`). Public API
 * traffic must NOT use these — see `enforcePublicApiRateLimit()`.
 *
 * @param limit - Max requests per window
 * @param prefix - Redis key prefix for this limiter
 * @param window - Sliding window ("1 m" or "1 h")
 */
function createRateLimiter(
  limit: number,
  prefix: string,
  window: "1 m" | "1 h" = "1 m"
): Limiter {
  const windowMs = window === "1 h" ? 3_600_000 : 60_000;

  // If rate limiting disabled, return bypass limiter
  if (!isEnabled) {
    logger.debug("Rate limit: Disabled for limiter", {
      prefix,
      reason: "RATE_LIMIT_ENABLED not set to 'true'",
    });
    return bypassLimiter(limit, windowMs);
  }

  // If Redis client not available, fail open (first-party only)
  if (!redis) {
    logger.warn("Rate limit: Redis not available - failing open", { prefix });
    return bypassLimiter(limit, windowMs);
  }

  try {
    const limiter = new Ratelimit({
      redis: redis,
      limiter: Ratelimit.slidingWindow(limit, window),
      analytics: false, // Disable analytics to save Redis commands
      prefix: `ratelimit:${prefix}`,
    });
    logger.debug("Rate limit: Created active limiter", {
      prefix,
      limit,
      window,
    });
    // Wrap so a runtime throw (e.g. a transient Upstash blip) fails open at
    // request time, not just at init — see failOpenAtRuntime.
    return failOpenAtRuntime(limiter, prefix, limit, windowMs);
  } catch (error) {
    logger.error("Rate limit: Failed to create limiter", {
      prefix,
      error: error instanceof Error ? error.message : String(error),
    });
    // Fail open - return bypass limiter (first-party only)
    return bypassLimiter(limit, windowMs);
  }
}

// Create rate limiters for each first-party endpoint (fail-open, see above)
export const checkoutRateLimit = createRateLimiter(CHECKOUT_LIMIT, "checkout");
export const portalRateLimit = createRateLimiter(PORTAL_LIMIT, "portal");
export const webhookRateLimit = createRateLimiter(WEBHOOK_LIMIT, "webhook");
export const contactRateLimit = createRateLimiter(CONTACT_LIMIT, "contact");
export const deletionRateLimit = createRateLimiter(
  DELETION_LIMIT,
  "deletion",
  "1 h"
);
export const oauthCallbackRateLimit = createRateLimiter(
  OAUTH_CALLBACK_LIMIT,
  "oauth-callback"
);
export const googleTokenRateLimit = createRateLimiter(
  GOOGLE_TOKEN_LIMIT,
  "google-token"
);
export const consentRecordingRateLimit = createRateLimiter(
  CONSENT_LIMIT,
  "consent",
  "1 h"
);
export const aiExtractionRateLimit = createRateLimiter(
  AI_EXTRACTION_LIMIT,
  "ai-extraction",
  "1 h"
);

// ---------------------------------------------------------------------------
// Public API surface (fail-closed)
// ---------------------------------------------------------------------------

/** Path prefix of the public versioned API (route handlers land in 005/W4). */
export const PUBLIC_API_PATH_PREFIX = "/api/v1";
/** Grey-clouded (DNS-only) API host — fitbull's and the native app's base URL. */
export const PUBLIC_API_HOST = "api.handicappin.com";

/**
 * Is this request on the public API surface (`/api/v1` path or the
 * `api.handicappin.com` host)? Public API traffic gets the fail-closed
 * rate-limit policy.
 */
export function isPublicApiRequest(request: Request): boolean {
  const url = new URL(request.url);
  const rawHost = request.headers.get("host") ?? url.host;
  const hostname = rawHost.split(":")[0]?.trim().toLowerCase() ?? "";
  if (hostname === PUBLIC_API_HOST) {
    return true;
  }
  return (
    url.pathname === PUBLIC_API_PATH_PREFIX ||
    url.pathname.startsWith(`${PUBLIC_API_PATH_PREFIX}/`)
  );
}

/**
 * Route families of the public `/v1` surface, each with its own budget and
 * its own Redis bucket (api-platform plans/005-phase0-contract.md §3).
 *
 * One `Ratelimit` per family, prefixed `ratelimit:public-api:<family>`, so a
 * burst of reads cannot consume a user's write budget (and vice versa). This
 * replaces the single global `ratelimit:public-api` bucket for every route
 * that names a family; the unfamilied bucket survives only as the legacy
 * default of `enforcePublicApiRateLimit()` (see its JSDoc).
 *
 * `course-submit` and `provision` have no day-one route (D9 defers the
 * endpoints they guard) — their limiters exist so the route PR is a one-line
 * change rather than a limiter design discussion.
 */
export const PUBLIC_API_RATE_LIMIT_FAMILIES = {
  /** `POST /v1/rounds` — the round write path. */
  "rounds-write": { limit: V1_ROUNDS_WRITE_LIMIT, window: "1 m" },
  /** Every `/v1` GET (health, courses, tees, rounds). */
  reads: { limit: V1_READS_LIMIT, window: "1 m" },
  /** Deferred (D9): client-submitted course data. */
  "course-submit": { limit: V1_COURSE_SUBMIT_LIMIT, window: "1 h" },
  /** Deferred (D9): `POST /v1/profile/provision`. */
  provision: { limit: V1_PROVISION_LIMIT, window: "1 h" },
} as const satisfies Record<
  string,
  { limit: number; window: "1 m" | "1 h" }
>;

/** Name of a `/v1` route family — the unit a budget is enforced against. */
export type PublicApiRateLimitFamily =
  keyof typeof PUBLIC_API_RATE_LIMIT_FAMILIES;

const PUBLIC_API_FAMILY_NAMES = Object.keys(
  PUBLIC_API_RATE_LIMIT_FAMILIES
) as PublicApiRateLimitFamily[];

/** Redis key prefix for a family's bucket. */
export function publicApiFamilyPrefix(
  family: PublicApiRateLimitFamily
): string {
  return `ratelimit:public-api:${family}`;
}

/**
 * `Retry-After` advertised when the limiter itself is unavailable. Fixed at
 * 60s by the contract (§3) rather than derived, so a 503 never leaks how the
 * infrastructure failed through a distinctive backoff value.
 */
const FAIL_CLOSED_RETRY_AFTER_SECONDS = 60;

// The real fail-closed limiter for the public surface (null when unavailable).
let publicApiLimiter: Limiter | null = null;
/** One fail-closed limiter per route family (empty when unavailable). */
const publicApiFamilyLimiters = new Map<PublicApiRateLimitFamily, Limiter>();
if (redis && !limiterUnavailableReason) {
  try {
    publicApiLimiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(PUBLIC_API_LIMIT, "1 m"),
      analytics: false,
      prefix: "ratelimit:public-api",
    });
    for (const family of PUBLIC_API_FAMILY_NAMES) {
      const { limit, window } = PUBLIC_API_RATE_LIMIT_FAMILIES[family];
      publicApiFamilyLimiters.set(
        family,
        new Ratelimit({
          redis,
          limiter: Ratelimit.slidingWindow(limit, window),
          analytics: false,
          prefix: publicApiFamilyPrefix(family),
        })
      );
    }
  } catch (error) {
    limiterUnavailableReason = "init-error";
    publicApiLimiter = null;
    publicApiFamilyLimiters.clear();
    logger.error("Rate limit: Failed to create public API limiter", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * The authenticated principal behind a `/v1` request, as read from the
 * validated Bearer token's claims.
 *
 * Principal CLASS is decided by `clientId` presence, never by the absence of
 * some other claim (contract §6): an OAuth-client token carries `client_id`,
 * a first-party web/native token does not.
 */
export interface PublicApiPrincipal {
  /** `sub` claim — the Supabase user id. */
  userId: string;
  /**
   * `client_id` claim — present only on OAuth-client tokens. The claim is
   * stamped by GoTrue's `custom_access_token_hook`
   * (`supabase/migrations/20260728090000_oauth_client_id_claims.sql`) and is
   * read from the token by the caller, not here; `isExternalOAuthClientToken`
   * (`apps/web/server/api/trpc.ts:91`) is the existing precedent.
   */
  clientId?: string;
}

export interface PublicApiRateLimitResult {
  /** Whether the request may proceed. */
  success: boolean;
  /** True when the denial came from the fail-closed policy, not a real limit. */
  failedClosed: boolean;
  /** Set when `success` is false due to infrastructure failure. */
  reason?: PublicApiRateLimitFailure;
  /** Family whose bucket was consulted (absent on the legacy global bucket). */
  family?: PublicApiRateLimitFamily;
  limit: number;
  remaining: number;
  reset: number;
}

function denyClosed(
  reason: PublicApiRateLimitFailure,
  identifier: string,
  family?: PublicApiRateLimitFamily,
  error?: unknown
): PublicApiRateLimitResult {
  // Only the identifier KIND (client vs user vs ip) is emitted — the raw
  // identifier carries an IP address or a user id, neither of which may
  // reach Sentry or Vercel logs.
  const identifierKind = identifier.split(":")[0] ?? "unknown";
  logger.error("Rate limit: public API fail-closed", {
    reason,
    identifierKind,
    family,
    error: error instanceof Error ? error.message : undefined,
  });
  captureSentryError(
    new Error(`Public API rate limiter unavailable (${reason}) — failing closed`),
    {
      level: "error",
      eventType: "rate-limit-fail-closed",
      tags: { reason, ...(family ? { family } : {}) },
      extra: { identifierKind },
    }
  );
  return {
    success: false,
    failedClosed: true,
    reason,
    family,
    limit: 0,
    remaining: 0,
    reset: Date.now() + FAIL_CLOSED_RETRY_AFTER_SECONDS * 1000,
  };
}

/**
 * Rate-limit a request on the PUBLIC API surface. FAIL-CLOSED:
 *
 * - `RATE_LIMIT_ENABLED` unset / not "true"  → deny (`reason: "disabled"`)
 * - KV credentials missing                   → deny (`reason: "missing-credentials"`)
 * - Redis/limiter init threw                 → deny (`reason: "init-error"`)
 * - limiter throws at request time           → deny (`reason: "runtime-error"`)
 *
 * Every fail-closed denial is Sentry-alerted. Callers turn the result into a
 * response with `rateLimitDenialStatus()` + `rateLimitHeaders()` below; the
 * problem body belongs to the `/v1` error mapper, not to this module.
 *
 * @param request - Incoming request (used to derive the anonymous identifier)
 * @param principal - Authenticated principal, preferred over IP when present.
 *   A bare string is accepted as the user id for pre-`/v1` callers.
 * @param family - Route family whose bucket to consult. OMITTING IT falls
 *   back to the legacy global `ratelimit:public-api` bucket, which exists
 *   only for callers that predate the families — every `/v1` route names one.
 */
export async function enforcePublicApiRateLimit(
  request: Request,
  principal?: string | PublicApiPrincipal,
  family?: PublicApiRateLimitFamily
): Promise<PublicApiRateLimitResult> {
  const resolved: Partial<PublicApiPrincipal> =
    typeof principal === "string" ? { userId: principal } : principal ?? {};
  const identifier = getIdentifier(
    request,
    resolved.userId,
    resolved.clientId
  );

  const limiter = family
    ? publicApiFamilyLimiters.get(family) ?? null
    : publicApiLimiter;

  if (limiterUnavailableReason || !limiter) {
    return denyClosed(
      limiterUnavailableReason ?? "init-error",
      identifier,
      family
    );
  }

  try {
    const result = await limiter.limit(identifier);
    return {
      success: result.success,
      failedClosed: false,
      family,
      limit: result.limit,
      remaining: result.remaining,
      reset: result.reset,
    };
  } catch (error) {
    return denyClosed("runtime-error", identifier, family, error);
  }
}

// ---------------------------------------------------------------------------
// Response seam (consumed by the /v1 RFC 9457 error mapper — T13.0b)
// ---------------------------------------------------------------------------

/** Response header names of the `/v1` rate-limit contract (§3). */
export const RATE_LIMIT_HEADERS = {
  limit: "X-RateLimit-Limit",
  remaining: "X-RateLimit-Remaining",
  reset: "X-RateLimit-Reset",
  retryAfter: "Retry-After",
} as const;

/**
 * HTTP status a denial maps to, or `null` when the request may proceed.
 *
 * - budget exhausted        → **429** (mapper body: `code: "rate_limited"`)
 * - limiter unavailable     → **503** (mapper body: `code: "service_unavailable"`)
 *
 * The internal `reason` never leaves this module's result object: it goes to
 * Sentry (see `denyClosed`) and must not reach the response body.
 */
export function rateLimitDenialStatus(
  result: PublicApiRateLimitResult
): 429 | 503 | null {
  if (result.success) {
    return null;
  }
  return result.failedClosed ? 503 : 429;
}

/**
 * Headers to merge into the response for a rate-limited request.
 *
 * - allowed / genuinely over-limit → the `X-RateLimit-*` trio, plus
 *   `Retry-After` (whole seconds, >= 1) when over-limit.
 * - fail-closed (503) → `Retry-After: 60` ONLY. The `X-RateLimit-*` trio is
 *   deliberately withheld: a zeroed budget on a 503 would describe the
 *   outage, and the contract specifies only `Retry-After` for that case.
 *
 * @param now - Injectable clock, for deterministic tests.
 */
export function rateLimitHeaders(
  result: PublicApiRateLimitResult,
  now: number = Date.now()
): Record<string, string> {
  if (result.failedClosed) {
    return {
      [RATE_LIMIT_HEADERS.retryAfter]: String(FAIL_CLOSED_RETRY_AFTER_SECONDS),
    };
  }

  const headers: Record<string, string> = {
    [RATE_LIMIT_HEADERS.limit]: String(result.limit),
    [RATE_LIMIT_HEADERS.remaining]: String(Math.max(0, result.remaining)),
    // Unix SECONDS, per the contract — the limiter reports milliseconds.
    [RATE_LIMIT_HEADERS.reset]: String(Math.ceil(result.reset / 1000)),
  };

  if (!result.success) {
    headers[RATE_LIMIT_HEADERS.retryAfter] = String(
      Math.max(1, Math.ceil((result.reset - now) / 1000))
    );
  }

  return headers;
}

// ---------------------------------------------------------------------------
// Identifier resolution
// ---------------------------------------------------------------------------

/**
 * Client-IP headers in trust order.
 *
 * - `cf-connecting-ip`: set by Cloudflare when the request traversed an
 *   orange-clouded zone. Behind orange-cloud, Vercel's `x-real-ip` is a
 *   Cloudflare EDGE IP — using it bucketed all anonymous traffic into a
 *   handful of shared rate buckets (the W0 runbook bug), so the Cloudflare
 *   header must win when present.
 * - `x-real-ip`: set by Vercel to the connecting client's IP. Correct for
 *   direct-to-Vercel traffic: the grey-clouded (DNS-only)
 *   `api.handicappin.com` host, and any host after broad grey-clouding.
 *
 * Trade-off, documented deliberately: a client hitting Vercel directly can
 * forge `cf-connecting-ip` to mint fresh anonymous buckets. Accepted because
 * (a) authenticated traffic is keyed by principal, not IP; (b) the Vercel
 * WAF rate rule is the flood backstop; and (c) the alternative (trusting
 * `x-real-ip` behind orange-cloud) collapses all legitimate anonymous users
 * into one bucket. Revisit if the orange-clouded web zone is retired.
 */
const CLIENT_IP_HEADERS = ["cf-connecting-ip", "x-real-ip"] as const;

/**
 * Extract identifier for rate limiting. Three principal shapes, three keys
 * (api-platform plans/005-phase0-contract.md §3):
 *
 * - **OAuth-client token** (`client_id` + `sub` claims) → the
 *   `(client_id, user)` PAIR, encoded `client:{clientId}:user:{userId}`.
 *   Keying on `client_id` alone would collapse every user of a connected app
 *   into one shared bucket; keying on the user alone would lose per-client
 *   attribution the moment a second client exists.
 * - **First-party token** (no `client_id`) → `user:{userId}`, unchanged.
 * - **Pre-auth / invalid token** (no principal) → `ip:{ip}` via the
 *   `CLIENT_IP_HEADERS` trust order below. Authenticated traffic is NEVER
 *   keyed per-IP — a `userId` always wins over every IP header.
 *
 * `clientId` without a `userId` is not a real principal (an OAuth token
 * always carries `sub`); it falls through to the IP key rather than minting
 * a per-client bucket that any caller could claim.
 *
 * @param request - Next.js request object
 * @param userId - Optional `sub` claim from the validated token
 * @param clientId - Optional `client_id` claim; OAuth-client tokens only
 * @returns Identifier string for rate limiting
 */
export function getIdentifier(
  request: Request,
  userId?: string,
  clientId?: string
): string {
  // Prefer the authenticated principal for authenticated requests
  if (userId) {
    return clientId
      ? `client:${clientId}:user:${userId}`
      : `user:${userId}`;
  }

  for (const header of CLIENT_IP_HEADERS) {
    const value = request.headers.get(header)?.trim();
    if (value) {
      return `ip:${value}`;
    }
  }

  // Fallback only (non-Vercel/local): take the LAST hop of x-forwarded-for —
  // the closest proxy. The LEFTMOST entry is attacker-chosen (a client can
  // prepend arbitrary IPs and proxies append the real one on the right) and
  // must never be used.
  const forwardedLast = request.headers
    .get("x-forwarded-for")
    ?.split(",")
    .pop()
    ?.trim();

  return `ip:${forwardedLast || "unknown"}`;
}

/**
 * Type guard to check if rate limiter is available
 */
export function isRateLimitEnabled(): boolean {
  return isEnabled;
}

/**
 * Get the Redis client for direct operations (e.g., OTP storage)
 * Returns null if Redis is not configured
 */
export function getRedisClient(): Redis | null {
  return redis;
}
