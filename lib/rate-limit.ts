import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

/**
 * Rate limiting configuration
 * - Controlled by RATE_LIMIT_ENABLED environment variable
 * - Set to 'false' in development to avoid hitting limits during testing
 * - Set to 'true' in production to enable protection
 */
const isEnabled = process.env.RATE_LIMIT_ENABLED === 'true';

// Configurable rate limits from environment variables
const CHECKOUT_LIMIT = parseInt(process.env.RATE_LIMIT_CHECKOUT_PER_MIN || '10', 10);
const PORTAL_LIMIT = parseInt(process.env.RATE_LIMIT_PORTAL_PER_MIN || '5', 10);
const WEBHOOK_LIMIT = parseInt(process.env.RATE_LIMIT_WEBHOOK_PER_MIN || '100', 10);
const CONTACT_LIMIT = parseInt(process.env.RATE_LIMIT_CONTACT_PER_MIN || '3', 10);
const DELETION_LIMIT = parseInt(process.env.RATE_LIMIT_DELETION_PER_HOUR || '3', 10);

// Initialize Redis client (only if rate limiting is enabled)
let redis: Redis | null = null;
try {
  if (isEnabled) {
    // Use Upstash REST API credentials from Vercel KV
    const restUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
    const restToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

    if (restUrl && restToken) {
      redis = new Redis({
        url: restUrl,
        token: restToken,
      });
      console.log(`[Rate Limit] ✅ Connected to Upstash Redis`);
    } else {
      console.warn('[Rate Limit] ⚠️  No Redis credentials found');
      console.warn('[Rate Limit] Set KV_REST_API_URL and KV_REST_API_TOKEN');
    }
  } else {
    console.log('[Rate Limit] Disabled (RATE_LIMIT_ENABLED=false)');
  }
} catch (error) {
  console.error('[Rate Limit] ❌ Failed to initialize Redis client:', error);
  console.error('[Rate Limit] Will fail-open (allow all requests)');
}

/**
 * Create rate limiter with sliding window algorithm
 * @param limit - Max requests per window
 * @param prefix - Redis key prefix for this limiter
 */
function createRateLimiter(limit: number, prefix: string) {
  // If rate limiting disabled, return bypass limiter
  if (!isEnabled) {
    console.log(`[Rate Limit] Disabled for ${prefix} (RATE_LIMIT_ENABLED not set to 'true')`);
    return {
      limit: async () => ({
        success: true,
        limit,
        remaining: limit,
        reset: Date.now() + 60000,
      }),
    };
  }

  // If Redis client not available, fail open
  if (!redis) {
    console.warn(`[Rate Limit] Redis not available for ${prefix} - failing open`);
    return {
      limit: async () => ({
        success: true,
        limit,
        remaining: limit,
        reset: Date.now() + 60000,
      }),
    };
  }

  try {
    const limiter = new Ratelimit({
      redis: redis,
      limiter: Ratelimit.slidingWindow(limit, '1 m'),
      analytics: false, // Disable analytics to save Redis commands
      prefix: `ratelimit:${prefix}`,
    });
    console.log(`[Rate Limit] Created active limiter for ${prefix} (${limit}/min)`);
    return limiter;
  } catch (error) {
    console.error(`[Rate Limit] Failed to create limiter for ${prefix}:`, error);
    // Fail open - return bypass limiter
    return {
      limit: async () => ({
        success: true,
        limit,
        remaining: limit,
        reset: Date.now() + 60000,
      }),
    };
  }
}

/**
 * Create rate limiter with sliding window algorithm (hourly)
 * @param limit - Max requests per hour
 * @param prefix - Redis key prefix for this limiter
 */
function createHourlyRateLimiter(limit: number, prefix: string) {
  // If rate limiting disabled, return bypass limiter
  if (!isEnabled) {
    console.log(`[Rate Limit] Disabled for ${prefix} (RATE_LIMIT_ENABLED not set to 'true')`);
    return {
      limit: async () => ({
        success: true,
        limit,
        remaining: limit,
        reset: Date.now() + 3600000,
      }),
    };
  }

  // If Redis client not available, fail open
  if (!redis) {
    console.warn(`[Rate Limit] Redis not available for ${prefix} - failing open`);
    return {
      limit: async () => ({
        success: true,
        limit,
        remaining: limit,
        reset: Date.now() + 3600000,
      }),
    };
  }

  try {
    const limiter = new Ratelimit({
      redis: redis,
      limiter: Ratelimit.slidingWindow(limit, '1 h'),
      analytics: false,
      prefix: `ratelimit:${prefix}`,
    });
    console.log(`[Rate Limit] Created active limiter for ${prefix} (${limit}/hour)`);
    return limiter;
  } catch (error) {
    console.error(`[Rate Limit] Failed to create limiter for ${prefix}:`, error);
    return {
      limit: async () => ({
        success: true,
        limit,
        remaining: limit,
        reset: Date.now() + 3600000,
      }),
    };
  }
}

// Create rate limiters for each endpoint
export const checkoutRateLimit = createRateLimiter(CHECKOUT_LIMIT, 'checkout');
export const portalRateLimit = createRateLimiter(PORTAL_LIMIT, 'portal');
export const webhookRateLimit = createRateLimiter(WEBHOOK_LIMIT, 'webhook');
export const contactRateLimit = createRateLimiter(CONTACT_LIMIT, 'contact');
export const deletionRateLimit = createHourlyRateLimiter(DELETION_LIMIT, 'deletion');

/**
 * Extract identifier for rate limiting
 * - Authenticated requests: Use user ID (per-user limits)
 * - Unauthenticated requests: Use IP address (per-IP limits)
 *
 * @param request - Next.js request object
 * @param userId - Optional user ID from auth
 * @returns Identifier string for rate limiting
 */
export function getIdentifier(request: Request, userId?: string): string {
  // Prefer user ID for authenticated requests
  if (userId) {
    return `user:${userId}`;
  }

  // Fall back to IP address for unauthenticated requests
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');

  // x-forwarded-for can contain multiple IPs (client, proxy1, proxy2)
  // Take the first one (original client IP)
  const ip = forwarded?.split(',')[0]?.trim() || realIp || 'unknown';

  return `ip:${ip}`;
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
