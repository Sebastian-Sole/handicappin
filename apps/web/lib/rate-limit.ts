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
 *   DENIED and Sentry is alerted.
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
  // Upstash REST API credentials from Vercel KV. These are required by
  // env.ts, but a deploy built with SKIP_ENV_VALIDATION could still reach
  // here without them — hence the runtime check.
  const restUrl = env.KV_REST_API_URL;
  const restToken = env.KV_REST_API_TOKEN;

  if (!restUrl || !restToken) {
    limiterUnavailableReason = "missing-credentials";
    logger.error("Rate limit: No Redis credentials found", {
      hint: "Set KV_REST_API_URL and KV_REST_API_TOKEN",
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

// The real fail-closed limiter for the public surface (null when unavailable).
let publicApiLimiter: Limiter | null = null;
if (redis && !limiterUnavailableReason) {
  try {
    publicApiLimiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(PUBLIC_API_LIMIT, "1 m"),
      analytics: false,
      prefix: "ratelimit:public-api",
    });
  } catch (error) {
    limiterUnavailableReason = "init-error";
    logger.error("Rate limit: Failed to create public API limiter", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export interface PublicApiRateLimitResult {
  /** Whether the request may proceed. */
  success: boolean;
  /** True when the denial came from the fail-closed policy, not a real limit. */
  failedClosed: boolean;
  /** Set when `success` is false due to infrastructure failure. */
  reason?: PublicApiRateLimitFailure;
  limit: number;
  remaining: number;
  reset: number;
}

function denyClosed(
  reason: PublicApiRateLimitFailure,
  identifier: string,
  error?: unknown
): PublicApiRateLimitResult {
  // Only the identifier KIND (user vs ip) is emitted — the raw identifier
  // carries an IP address, which must reach neither Sentry nor Vercel logs.
  const identifierKind = identifier.split(":")[0] ?? "unknown";
  logger.error("Rate limit: public API fail-closed", {
    reason,
    identifierKind,
    error: error instanceof Error ? error.message : undefined,
  });
  captureSentryError(
    new Error(`Public API rate limiter unavailable (${reason}) — failing closed`),
    {
      level: "error",
      eventType: "rate-limit-fail-closed",
      tags: { reason },
      extra: { identifierKind },
    }
  );
  return {
    success: false,
    failedClosed: true,
    reason,
    limit: 0,
    remaining: 0,
    reset: Date.now() + 60_000,
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
 * Every fail-closed denial is Sentry-alerted. Callers should map
 * `success: false` to a 429 (with `Retry-After` derived from `reset`), or a
 * 503 when `failedClosed` is true.
 *
 * @param request - Incoming request (used to derive the anonymous identifier)
 * @param userId - Authenticated principal, preferred over IP when present
 */
export async function enforcePublicApiRateLimit(
  request: Request,
  userId?: string
): Promise<PublicApiRateLimitResult> {
  const identifier = getIdentifier(request, userId);

  if (limiterUnavailableReason || !publicApiLimiter) {
    return denyClosed(limiterUnavailableReason ?? "init-error", identifier);
  }

  try {
    const result = await publicApiLimiter.limit(identifier);
    return {
      success: result.success,
      failedClosed: false,
      limit: result.limit,
      remaining: result.remaining,
      reset: result.reset,
    };
  } catch (error) {
    return denyClosed("runtime-error", identifier, error);
  }
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
 * Extract identifier for rate limiting
 * - Authenticated requests: Use user ID (per-user limits)
 * - Unauthenticated requests: Use client IP address (per-IP limits)
 *
 * @param request - Next.js request object
 * @param userId - Optional user ID from auth
 * @returns Identifier string for rate limiting
 */
export function getIdentifier(request: Request, userId?: string): string {
  // Prefer the authenticated principal for authenticated requests
  if (userId) {
    return `user:${userId}`;
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
