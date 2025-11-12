# 0023 - Add Rate Limiting to Stripe Endpoints

## 🎯 **Description**

Implement rate limiting on Stripe API endpoints to prevent abuse, protect against denial-of-service attacks, and avoid hitting Stripe's API rate limits. Currently, checkout, portal, and webhook endpoints have no rate limiting, allowing unlimited requests from a single user or IP address.

## 📋 **User Story**

As a platform owner, I want to prevent abuse of Stripe API endpoints so that malicious actors cannot spam checkout sessions, overwhelm the webhook handler, or cause API rate limit issues with Stripe.

## 🔧 **Technical Context**

**Current Endpoints Without Rate Limiting:**

1. `/api/stripe/checkout` - Create checkout session
2. `/api/stripe/portal` - Create billing portal session
3. `/api/stripe/webhook` - Receive webhook events

**Attack Scenarios:**

**Scenario 1: Checkout Session Spam**
```bash
# Attacker creates 1000 checkout sessions in 1 minute
for i in {1..1000}; do
  curl -X POST /api/stripe/checkout \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"plan":"premium"}' &
done
```
- Hits Stripe API rate limits (100 req/sec)
- Creates thousands of abandoned checkout sessions
- Clutters Stripe dashboard
- Could trigger Stripe account review

**Scenario 2: Portal Session Spam**
```bash
# Attacker spams portal session creation
while true; do
  curl -X POST /api/stripe/portal \
    -H "Authorization: Bearer $TOKEN"
done
```
- Similar issues as checkout spam
- Wasted Stripe API quota

**Scenario 3: Webhook Replay Attack**
```bash
# Attacker captures webhook payload and replays it
while true; do
  curl -X POST /api/stripe/webhook \
    -H "Stripe-Signature: $CAPTURED_SIG" \
    -d "$CAPTURED_PAYLOAD"
done
```
- Without rate limiting, could overwhelm database
- Idempotency protects against data corruption (Ticket #0015)
- But still causes resource exhaustion

**Security Assessment Reference:**
- Lines 481-491 (security-assessment.md)
- "No Rate Limiting" - MEDIUM priority

**Security Impact:** 🟡 **MEDIUM**
- API abuse and resource exhaustion
- Stripe API rate limit violations
- Potential service degradation
- Not direct security breach but enables DoS

## ✅ **Acceptance Criteria**

- [ ] Rate limiting implemented for `/api/stripe/checkout`
- [ ] Rate limiting implemented for `/api/stripe/portal`
- [ ] Rate limiting implemented for `/api/stripe/webhook` (IP-based)
- [ ] Different limits for authenticated vs unauthenticated requests
- [ ] Rate limit headers returned (X-RateLimit-Limit, X-RateLimit-Remaining)
- [ ] 429 status code returned when limit exceeded
- [ ] Redis or in-memory store for rate limit tracking
- [ ] Configurable limits via environment variables
- [ ] Manual testing: Trigger rate limit and verify 429 response

## 🚨 **Technical Requirements**

### **Recommended Rate Limits:**

| Endpoint | User-Based Limit | IP-Based Limit | Window |
|----------|-----------------|----------------|---------|
| `/api/stripe/checkout` | 10 req/minute | 50 req/minute | 1 min |
| `/api/stripe/portal` | 5 req/minute | 20 req/minute | 1 min |
| `/api/stripe/webhook` | N/A (IP only) | 100 req/minute | 1 min |

### **Implementation Details**

**Option 1: Upstash Redis (Recommended for Production)**

```bash
# Install dependencies
npm install @upstash/ratelimit @upstash/redis
```

```typescript:lib/rate-limit.ts
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Create Redis client
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Create rate limiters
export const checkoutRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '1 m'), // 10 requests per minute
  analytics: true,
  prefix: 'ratelimit:checkout',
});

export const portalRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '1 m'), // 5 requests per minute
  analytics: true,
  prefix: 'ratelimit:portal',
});

export const webhookRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(100, '1 m'), // 100 requests per minute
  analytics: true,
  prefix: 'ratelimit:webhook',
});

/**
 * Helper to extract identifier from request
 * Prefers user ID, falls back to IP address
 */
export function getIdentifier(request: Request, userId?: string): string {
  if (userId) {
    return `user:${userId}`;
  }

  // Get IP from headers
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0] : 'unknown';

  return `ip:${ip}`;
}
```

**Option 2: In-Memory Rate Limiting (Simpler, Single Server Only)**

```typescript:lib/rate-limit-memory.ts
type RateLimitStore = Map<string, { count: number; resetAt: number }>;

const stores: Record<string, RateLimitStore> = {
  checkout: new Map(),
  portal: new Map(),
  webhook: new Map(),
};

export async function checkRateLimit(
  endpoint: 'checkout' | 'portal' | 'webhook',
  identifier: string,
  limit: number,
  windowMs: number
): Promise<{ success: boolean; remaining: number; resetAt: number }> {
  const store = stores[endpoint];
  const now = Date.now();

  const entry = store.get(identifier);

  // Clean up expired entries periodically
  if (store.size > 10000) {
    for (const [key, value] of store.entries()) {
      if (value.resetAt < now) {
        store.delete(key);
      }
    }
  }

  if (!entry || entry.resetAt < now) {
    // First request or window expired
    store.set(identifier, {
      count: 1,
      resetAt: now + windowMs,
    });

    return {
      success: true,
      remaining: limit - 1,
      resetAt: now + windowMs,
    };
  }

  if (entry.count >= limit) {
    // Rate limit exceeded
    return {
      success: false,
      remaining: 0,
      resetAt: entry.resetAt,
    };
  }

  // Increment count
  entry.count++;
  store.set(identifier, entry);

  return {
    success: true,
    remaining: limit - entry.count,
    resetAt: entry.resetAt,
  };
}
```

**Update Checkout Endpoint:**

```typescript:app/api/stripe/checkout/route.ts
import { checkoutRateLimit, getIdentifier } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerComponentClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ✅ NEW: Rate limiting
    const identifier = getIdentifier(request, user.id);
    const { success, limit, remaining, reset } = await checkoutRateLimit.limit(identifier);

    // Add rate limit headers
    const headers = {
      'X-RateLimit-Limit': limit.toString(),
      'X-RateLimit-Remaining': remaining.toString(),
      'X-RateLimit-Reset': reset.toString(),
    };

    if (!success) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded. Please try again later.',
          retryAfter: Math.ceil((reset - Date.now()) / 1000),
        },
        {
          status: 429,
          headers: {
            ...headers,
            'Retry-After': Math.ceil((reset - Date.now()) / 1000).toString(),
          },
        }
      );
    }

    // ... existing checkout logic ...

    return NextResponse.json({ url: session.url }, { headers });
  } catch (error) {
    console.error("Error creating checkout session:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
```

**Update Portal Endpoint:**

```typescript:app/api/stripe/portal/route.ts
import { portalRateLimit, getIdentifier } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerComponentClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ✅ NEW: Rate limiting
    const identifier = getIdentifier(request, user.id);
    const { success, limit, remaining, reset } = await portalRateLimit.limit(identifier);

    const headers = {
      'X-RateLimit-Limit': limit.toString(),
      'X-RateLimit-Remaining': remaining.toString(),
      'X-RateLimit-Reset': reset.toString(),
    };

    if (!success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429, headers }
      );
    }

    // ... existing portal logic ...

    return NextResponse.json({ url: session.url }, { headers });
  } catch (error) {
    console.error("Error creating portal session:", error);
    return NextResponse.json(
      { error: "Failed to create portal session" },
      { status: 500 }
    );
  }
}
```

**Update Webhook Endpoint:**

```typescript:app/api/stripe/webhook/route.ts
import { webhookRateLimit, getIdentifier } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  try {
    // ✅ NEW: Rate limiting (IP-based only, no user context)
    const identifier = getIdentifier(request);
    const { success, limit, remaining } = await webhookRateLimit.limit(identifier);

    if (!success) {
      console.warn(`⚠️ Webhook rate limit exceeded for ${identifier}`);
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    const body = await request.text();
    const signature = request.headers.get("stripe-signature");

    // ... existing webhook logic ...

  } catch (error) {
    // ... existing error handling ...
  }
}
```

### **Environment Variables:**

```bash
# .env.local

# Upstash Redis (for rate limiting)
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token

# Rate Limit Configuration (optional overrides)
RATE_LIMIT_CHECKOUT_MAX=10
RATE_LIMIT_PORTAL_MAX=5
RATE_LIMIT_WEBHOOK_MAX=100
```

### **Dependencies**

- `@upstash/ratelimit` - Rate limiting library
- `@upstash/redis` - Redis client
- OR: In-memory implementation (no dependencies)
- All Stripe API endpoints

### **Integration Points**

- `/api/stripe/checkout`
- `/api/stripe/portal`
- `/api/stripe/webhook`
- Redis (Upstash) for distributed rate limiting
- OR: In-memory store for single-server deployments

## 🔍 **Implementation Notes**

### **Why Upstash Redis?**

**Pros:**
- Serverless-friendly (HTTP-based)
- Works with Vercel/serverless deployments
- Distributed (works across multiple instances)
- Built-in analytics
- Low latency (~50ms)

**Cons:**
- External dependency
- Small cost (~$0.20/month for hobby tier)
- Network latency

### **Why In-Memory Fallback?**

**Pros:**
- No external dependencies
- Zero latency
- Free

**Cons:**
- Only works with single server
- Lost on server restart
- Doesn't work on serverless (separate instances)

### **Recommended Approach:**

Use Upstash Redis for production, in-memory for development:

```typescript:lib/rate-limit.ts
const isDevelopment = process.env.NODE_ENV === 'development';

export const checkoutRateLimit = isDevelopment
  ? createInMemoryRateLimit('checkout', 10, 60000)
  : new Ratelimit({ /* Redis config */ });
```

### **Rate Limit Strategy:**

**Sliding Window:**
- More accurate than fixed window
- Prevents "burst at boundary" attacks
- Example: 10 req/min = max 10 in any 60-second window

**Fixed Window:**
- Simpler implementation
- Allows bursts at window boundaries
- Example: 10 req/min = reset at :00, :01, :02...

**Token Bucket:**
- Allows short bursts
- Replenishes over time
- Good for APIs with bursty traffic

**Recommendation:** Use sliding window for Stripe endpoints (prevents abuse).

## 📊 **Definition of Done**

- [ ] Rate limiting library installed and configured
- [ ] Checkout endpoint rate limited (10 req/min per user)
- [ ] Portal endpoint rate limited (5 req/min per user)
- [ ] Webhook endpoint rate limited (100 req/min per IP)
- [ ] Rate limit headers returned in responses
- [ ] 429 status code with Retry-After header
- [ ] Environment variables for configuration
- [ ] Manual testing: Trigger rate limits
- [ ] Load testing: Verify limits enforced under load

## 🧪 **Testing Requirements**

### **Manual Testing:**

```bash
# Test checkout rate limit
for i in {1..15}; do
  echo "Request $i:"
  curl -X POST http://localhost:3000/api/stripe/checkout \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"plan":"premium"}' \
    -w "\nStatus: %{http_code}\n\n"
  sleep 1
done

# First 10 should return 200
# Requests 11-15 should return 429
```

### **Load Testing:**

```typescript
import { test } from '@playwright/test';

test('should enforce rate limit under concurrent load', async ({ request }) => {
  // Send 20 concurrent requests
  const requests = Array(20).fill(null).map(() =>
    request.post('/api/stripe/checkout', {
      headers: { Authorization: `Bearer ${TOKEN}` },
      data: { plan: 'premium' },
    })
  );

  const responses = await Promise.all(requests);

  // Count 200 vs 429 responses
  const successful = responses.filter(r => r.status() === 200);
  const rateLimited = responses.filter(r => r.status() === 429);

  expect(successful.length).toBeLessThanOrEqual(10); // At most 10 succeed
  expect(rateLimited.length).toBeGreaterThanOrEqual(10); // At least 10 rate limited
});
```

## 🚫 **Out of Scope**

- Dynamic rate limit adjustment (ML-based)
- Per-plan rate limits (premium users get higher limits)
- Rate limit dashboard/analytics UI
- IP reputation scoring
- CAPTCHA for rate-limited requests
- Distributed rate limiting across regions

## 📝 **Notes**

**Stripe's Rate Limits:**
- Standard: 100 requests/second
- Checkout: 25 requests/second
- Webhooks: 1000 requests/second (incoming)

**Our Limits Are More Conservative:**
- Protects against user error (infinite loops in code)
- Prevents accidental API abuse
- Leaves headroom for Stripe's limits

**Rate Limit HTTP Headers (RFC 6585):**
```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 3
X-RateLimit-Reset: 1640000000
Retry-After: 45
```

**Client Implementation:**
```typescript
// Client should handle 429 gracefully
try {
  const response = await fetch('/api/stripe/checkout', { ... });

  if (response.status === 429) {
    const retryAfter = response.headers.get('Retry-After');
    showError(`Please wait ${retryAfter} seconds before trying again`);
    return;
  }

  // ... handle success ...
} catch (error) {
  // ... handle error ...
}
```

**Related Tickets:**
- Ticket #0015: Webhook Idempotency (prevents duplicate processing)
- Ticket #0021: Missing Webhook Handlers (handles various events)

## 🏷️ **Labels**

- `priority: medium`
- `type: security`
- `component: api`
- `component: stripe`
- `rate-limiting`
- `dos-prevention`
- `api-protection`
