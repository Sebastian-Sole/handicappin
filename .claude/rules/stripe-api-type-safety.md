# Stripe API Type Safety Guidelines

This project uses a **type-safe Stripe integration** with Zod validation and shared types. Follow these guidelines when creating or modifying Stripe-related code.

## Architecture Overview

```
┌─────────────────────┐
│  lib/stripe-types.ts│  ← Single source of truth for all Stripe types
└──────────┬──────────┘
           │
    ┌──────┴────────┐
    │               │
┌───▼────────┐  ┌──▼──────────────┐
│ Backend    │  │ Frontend         │
│ API Routes │  │ API Client       │
└────────────┘  └──────────────────┘
```

## Core Files

### 1. `lib/stripe-types.ts` - Type Definitions
**Purpose:** Single source of truth for all Stripe-related types and Zod schemas.

**Contents:**
- Plan types: `PlanType`, `PlanSchema`
- Subscription statuses: `SubscriptionStatus`, `SubscriptionStatusSchema`
- Request schemas: `CheckoutRequestSchema`, `UpdateSubscriptionRequestSchema`
- Response schemas: `CheckoutResponseSchema`, `PortalResponseSchema`, etc.
- Error types: `ErrorResponse`, `ApiResult<T>`

**When to update:**
- Adding new plan types
- Adding new API endpoints
- Changing request/response shapes
- Adding new subscription statuses

### 2. `lib/api-validation.ts` - Validation Utilities
**Purpose:** Reusable helpers for validating requests and creating responses.

**Exports:**
- `validateRequest<T>(request, schema)` - Validates request body with Zod
- `successResponse<T>(data, headers?)` - Type-safe success responses
- `errorResponse(error, status, details?)` - Type-safe error responses

**Do NOT modify** these utilities unless adding new validation patterns.

### 3. `lib/stripe-api-client.ts` - Frontend API Client
**Purpose:** Type-safe wrapper for frontend fetch calls.

**Exports:**
- `createCheckout(request)` - Create Stripe checkout session
- `createPortal()` - Create customer portal session
- `getSubscription()` - Get subscription info
- `updateSubscription(request)` - Update subscription plan

**When to update:**
- Adding new Stripe API endpoints
- Changing request/response types

## Creating a New Stripe API Endpoint

### Step 1: Define Types in `lib/stripe-types.ts`

```typescript
// 1. Define request schema
export const NewFeatureRequestSchema = z.object({
  field1: z.string(),
  field2: z.number().optional(),
});

export type NewFeatureRequest = z.infer<typeof NewFeatureRequestSchema>;

// 2. Define response schema
export const NewFeatureResponseSchema = z.object({
  success: z.boolean(),
  data: z.string(),
});

export type NewFeatureResponse = z.infer<typeof NewFeatureResponseSchema>;
```

### Step 2: Create API Route

**File:** `app/api/stripe/new-feature/route.ts`

```typescript
import { NextRequest } from "next/server";
import { validateRequest, successResponse, errorResponse } from "@/lib/api-validation";
import { NewFeatureRequestSchema, NewFeatureResponseSchema } from "@/lib/stripe-types";
import { createServerComponentClient } from "@/utils/supabase/server";

export async function POST(request: NextRequest) {
  try {
    // 1. Auth check
    const supabase = await createServerComponentClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return errorResponse("Unauthorized", 401);
    }

    // 2. Validate request with Zod
    const validation = await validateRequest(request, NewFeatureRequestSchema);
    if ("error" in validation) {
      return validation.error;
    }
    const { field1, field2 } = validation.data;

    // 3. Your business logic here
    const result = await doSomething(field1, field2);

    // 4. Return validated response
    const response = NewFeatureResponseSchema.parse({
      success: true,
      data: result,
    });

    return successResponse(response);
  } catch (error) {
    console.error("Error in new feature:", error);
    return errorResponse("Failed to process request");
  }
}
```

### Step 3: Add to Frontend API Client

**File:** `lib/stripe-api-client.ts`

```typescript
/**
 * Description of what this does
 */
export async function callNewFeature(
  request: NewFeatureRequest
): Promise<ApiResult<NewFeatureResponse>> {
  return apiFetch<NewFeatureResponse>("/api/stripe/new-feature", {
    method: "POST",
    body: JSON.stringify(request),
  });
}
```

### Step 4: Use in Components

```typescript
import { callNewFeature } from "@/lib/stripe-api-client";

const result = await callNewFeature({ field1: "value" });

if (!result.success) {
  // Handle error with type-safe error object
  if (result.error.retryAfter) {
    alert(`Wait ${result.error.retryAfter} seconds`);
  } else {
    alert(result.error.error);
  }
  return;
}

// TypeScript knows result.data is NewFeatureResponse
console.log(result.data.success);
```

### Step 5: Add Tests

**File:** `__tests__/lib/stripe-types.test.ts`

```typescript
describe("NewFeatureRequestSchema", () => {
  it("should accept valid request", () => {
    const result = NewFeatureRequestSchema.safeParse({
      field1: "test",
      field2: 123
    });
    expect(result.success).toBe(true);
  });

  it("should reject invalid request", () => {
    const result = NewFeatureRequestSchema.safeParse({ field1: 123 });
    expect(result.success).toBe(false);
  });
});
```

## Modifying Existing Endpoints

### DO ✅

1. **Update types first** in `lib/stripe-types.ts`
2. **Use the validation utilities** from `lib/api-validation.ts`
3. **Test with invalid data** to ensure validation works
4. **Update tests** in `__tests__/lib/stripe-types.test.ts`
5. **Parse responses** with Zod schemas before returning

### DON'T ❌

1. **Don't use type assertions** like `as { plan: string }`
2. **Don't use raw `NextResponse.json()`** - use `successResponse()` or `errorResponse()`
3. **Don't skip validation** - always use `validateRequest()`
4. **Don't duplicate types** - import from `lib/stripe-types.ts`
5. **Don't use raw `fetch()`** in components - use the API client

## Common Patterns

### Pattern: Adding a New Plan Type

```typescript
// 1. Update in lib/stripe-types.ts
export const PLAN_TYPES = [
  "free",
  "premium",
  "unlimited",
  "lifetime",
  "enterprise" // NEW
] as const;

// 2. Update in lib/stripe.ts
export const PLAN_TO_PRICE_MAP = {
  premium: process.env.STRIPE_PREMIUM_PRICE_ID ?? "",
  unlimited: process.env.STRIPE_UNLIMITED_PRICE_ID ?? "",
  lifetime: process.env.STRIPE_UNLIMITED_LIFETIME_PRICE_ID ?? "",
  enterprise: process.env.STRIPE_ENTERPRISE_PRICE_ID ?? "", // NEW
} as const;

// 3. TypeScript will now enforce the new type everywhere!
```

### Pattern: Rate Limiting

```typescript
import { someRateLimit, getIdentifier } from '@/lib/rate-limit';

// Check rate limit
const identifier = getIdentifier(request, user.id);
const { success, limit, remaining, reset } = await someRateLimit.limit(identifier);

const rateLimitHeaders = {
  'X-RateLimit-Limit': limit.toString(),
  'X-RateLimit-Remaining': remaining.toString(),
  'X-RateLimit-Reset': new Date(reset).toISOString(),
};

if (!success) {
  const retryAfterSeconds = Math.ceil((reset - Date.now()) / 1000);
  return errorResponse(
    'Too many requests',
    429,
    { retryAfter: retryAfterSeconds }
  );
}

// Later, include headers in success response
return successResponse(data, rateLimitHeaders);
```

### Pattern: Error Handling in Components

```typescript
const result = await createCheckout({ plan: "premium" });

if (!result.success) {
  // Type-safe error handling
  if (result.error.retryAfter) {
    alert(`Please wait ${result.error.retryAfter} seconds and try again.`);
  } else {
    alert(result.error.error);
    if (result.error.details) {
      console.error("Details:", result.error.details);
    }
  }
  return;
}

// TypeScript knows result.data exists and its shape
window.location.href = result.data.url;
```

## Testing Checklist

When adding/modifying Stripe endpoints:

- [ ] Types defined in `lib/stripe-types.ts`
- [ ] Zod schemas created for request/response
- [ ] API route uses `validateRequest()`
- [ ] API route returns `successResponse()` or `errorResponse()`
- [ ] Frontend client function added to `lib/stripe-api-client.ts`
- [ ] Unit tests added for Zod schemas
- [ ] Build passes: `pnpm build`
- [ ] Tests pass: `pnpm test:unit`
- [ ] Lint passes: `pnpm lint`
- [ ] Manual test with invalid data returns 400
- [ ] TypeScript autocomplete works in IDE

## Why This Approach?

This type-safe approach provides:

1. **Runtime Validation** - Zod catches invalid data before it reaches business logic
2. **End-to-End Type Safety** - Types flow from database → API → frontend
3. **Single Source of Truth** - All types defined once in `lib/stripe-types.ts`
4. **Better DX** - IDE autocomplete and type checking work perfectly
5. **Maintainability** - Changes to types are enforced everywhere
6. **No tRPC Migration** - Achieves same benefits with existing API routes

## References

- Original plan: `.claude/plans/0005-improve-stripe-type-safety/251123.md`
- Zod documentation: https://zod.dev/
- Stripe API docs: https://docs.stripe.com/api
