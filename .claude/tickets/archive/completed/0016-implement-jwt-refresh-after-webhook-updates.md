# 0016 - Implement JWT Refresh After Webhook Updates

## 🎯 **Description**

Force JWT token refresh immediately after Stripe webhooks update billing data to prevent users from experiencing 1-60 minute delays accessing newly purchased features. Currently, webhooks update the database but JWT claims remain stale until automatic refresh (~1 hour) or manual page reload.

## 📋 **User Story**

As a user who just purchased a premium subscription, I want immediate access to premium features so that I don't see "upgrade to premium" messages despite having already paid.

## 🔧 **Technical Context**

**Current State:**
- Webhooks update `profile` table ✅ (app/api/stripe/webhook/route.ts:177-188)
- JWT hook reads from `profile` on token refresh ✅ (supabase/migrations/..._add_billing_jwt_hook.sql)
- NO automatic token refresh after webhook updates ❌
- Users must wait up to 60 minutes for automatic refresh ❌

**User Experience Impact:** 🔴 **CRITICAL**

**Example Flow (BROKEN):**
1. User subscribes to premium plan
2. Stripe sends `checkout.session.completed` webhook
3. Webhook updates `profile.plan_selected = 'premium'` ✅
4. User's JWT still has `billing.plan = 'free'` (not refreshed)
5. Middleware checks JWT: `plan === 'free'` → redirects to /upgrade ❌
6. User sees "Upgrade to Premium" page despite active subscription
7. User must wait up to 60 minutes or manually refresh page

**Security Impact:** 🟡 **MEDIUM**
- Opposite problem also exists: Canceled users retain access for up to 60 minutes
- JWT claims staleness creates authorization window

**References:**
- Security Assessment Evaluation: Lines 19-73 (security-assessment-evaluation.md)
- Middleware: utils/supabase/middleware.ts:134-210
- Webhook Handler: app/api/stripe/webhook/route.ts

## ✅ **Acceptance Criteria**

- [ ] After successful webhook processing, trigger client JWT refresh
- [ ] User gains premium access within 5 seconds of webhook completion
- [ ] Canceled subscriptions revoke access within 5 seconds
- [ ] JWT refresh mechanism doesn't block webhook response (async)
- [ ] Failed JWT refresh attempts are logged but don't fail webhook
- [ ] Works for all billing changes (subscribe, upgrade, downgrade, cancel)
- [ ] Manual testing: Subscribe and access premium feature immediately

## 🚨 **Technical Requirements**

### **Implementation Details**

**Strategy: Server-Sent Events (SSE) for Real-Time Updates**

Since webhooks run server-side without user session context, we need a mechanism to notify the client to refresh their token.

**Architecture:**

```
Stripe Webhook → Update DB → Publish Event → SSE Stream → Client Refreshes JWT
```

**Option 1: Redis Pub/Sub (Recommended for Production)**

```typescript
// lib/redis.ts
import { Redis } from '@upstash/redis';

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Publish billing update event
export async function publishBillingUpdate(userId: string) {
  await redis.publish('billing-updates', JSON.stringify({
    userId,
    timestamp: Date.now(),
    event: 'billing_changed'
  }));
}
```

```typescript
// app/api/billing/stream/route.ts
export async function GET(request: NextRequest) {
  const supabase = await createServerComponentClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }

  const stream = new ReadableStream({
    async start(controller) {
      // Subscribe to billing updates for this user
      const subscriber = redis.subscribe('billing-updates');

      for await (const message of subscriber) {
        const event = JSON.parse(message);

        if (event.userId === user.id) {
          controller.enqueue(
            `data: ${JSON.stringify({ type: 'billing_updated' })}\n\n`
          );
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
```

**Option 2: Database Polling (Simpler, No Redis Required)**

```typescript
// Add to db/schema.ts
export const billingUpdateEvents = pgTable("billing_update_events", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => profile.id),
  eventType: text("event_type").notNull(), // 'subscription_created' | 'subscription_canceled' | etc.
  createdAt: timestamp("created_at").defaultNow().notNull(),
  consumed: boolean("consumed").default(false).notNull(),
});
```

```typescript
// app/api/billing/poll-updates/route.ts
export async function GET(request: NextRequest) {
  const supabase = await createServerComponentClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const lastCheck = request.nextUrl.searchParams.get('since');
  const sinceTimestamp = lastCheck ? new Date(parseInt(lastCheck)) : new Date(Date.now() - 60000);

  const updates = await db
    .select()
    .from(billingUpdateEvents)
    .where(
      and(
        eq(billingUpdateEvents.userId, user.id),
        eq(billingUpdateEvents.consumed, false),
        gt(billingUpdateEvents.createdAt, sinceTimestamp)
      )
    )
    .limit(10);

  if (updates.length > 0) {
    // Mark as consumed
    await db
      .update(billingUpdateEvents)
      .set({ consumed: true })
      .where(
        inArray(billingUpdateEvents.id, updates.map(u => u.id))
      );

    return NextResponse.json({ hasUpdates: true, updates });
  }

  return NextResponse.json({ hasUpdates: false });
}
```

**Option 3: Supabase Realtime (Easiest, Uses Existing Infrastructure)**

```typescript
// In webhook handler, after updating profile
await db.update(profile).set({
  planSelected: plan,
  billingVersion: sql`billing_version + 1`, // ✅ Already incrementing
});

// Supabase Realtime automatically broadcasts this change
// Client listens to profile table changes
```

```typescript
// Client-side: components/billing-sync.tsx
'use client';

import { useEffect } from 'react';
import { createClientComponentClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';

export function BillingSync({ userId }: { userId: string }) {
  const supabase = createClientComponentClient();
  const router = useRouter();

  useEffect(() => {
    const channel = supabase
      .channel('billing-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profile',
          filter: `id=eq.${userId}`,
        },
        async (payload) => {
          console.log('Billing update detected, refreshing JWT...');

          // Force JWT refresh
          const { data, error } = await supabase.auth.refreshSession();

          if (!error && data.session) {
            console.log('JWT refreshed with new billing data');
            router.refresh(); // Refresh server components
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, supabase, router]);

  return null; // This component has no UI
}
```

### **Recommended Approach: Supabase Realtime**

**Pros:**
- No additional infrastructure (Redis, polling endpoints)
- Uses existing `billingVersion` increment in webhooks
- Real-time updates (< 1 second latency)
- Automatic cleanup (no consumed events to manage)

**Cons:**
- Requires Supabase Realtime enabled (already available)
- Client must be online to receive update

### **Implementation Steps:**

**1. Enable Supabase Realtime for `profile` table**

```sql
-- In Supabase dashboard or migration
ALTER PUBLICATION supabase_realtime ADD TABLE profile;
```

**2. Create `BillingSync` component**

```typescript
// components/billing-sync.tsx
'use client';

import { useEffect } from 'react';
import { createClientComponentClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';

export function BillingSync({ userId }: { userId: string }) {
  const supabase = createClientComponentClient();
  const router = useRouter();

  useEffect(() => {
    const channel = supabase
      .channel('billing-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profile',
          filter: `id=eq.${userId}`,
        },
        async (payload) => {
          const newBillingVersion = payload.new.billing_version;
          const oldBillingVersion = payload.old.billing_version;

          // Only refresh if billing_version changed (indicates webhook update)
          if (newBillingVersion !== oldBillingVersion) {
            console.log('🔄 Billing update detected, refreshing JWT...', {
              old: oldBillingVersion,
              new: newBillingVersion,
            });

            try {
              // Force JWT refresh
              const { data, error } = await supabase.auth.refreshSession();

              if (error) {
                console.error('❌ JWT refresh failed:', error);
                return;
              }

              if (data.session) {
                console.log('✅ JWT refreshed with new billing data');
                router.refresh(); // Refresh server components
              }
            } catch (err) {
              console.error('❌ Error during JWT refresh:', err);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, supabase, router]);

  return null;
}
```

**3. Add `BillingSync` to root layout**

```typescript
// app/layout.tsx
import { BillingSync } from '@/components/billing-sync';

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerComponentClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <html lang="en">
      <body>
        {user && <BillingSync userId={user.id} />}
        {children}
      </body>
    </html>
  );
}
```

**4. Webhook handler already increments `billingVersion`** ✅

The webhook handler already does this at line 185:

```typescript
billingVersion: sql`billing_version + 1`
```

No changes needed!

### **Dependencies**

- Supabase Realtime (already available)
- `components/billing-sync.tsx` (new component)
- `app/layout.tsx` (add BillingSync component)
- Webhook handler (already increments billingVersion)

### **Integration Points**

- All webhook handlers that update profile.plan_selected
- Root layout for client-side sync component
- Supabase Realtime PostgreSQL changes channel

## 🔍 **Implementation Notes**

### **Edge Cases:**

1. **User Not Online During Webhook:**
   - On next page load, middleware will read updated JWT claims
   - No action needed - eventual consistency is acceptable

2. **JWT Refresh Fails:**
   - Log error but don't block user
   - User can manually refresh page
   - Automatic refresh will happen within 60 minutes anyway

3. **Multiple Rapid Webhooks:**
   - `billingVersion` increment ensures each update triggers refresh
   - Client deduplicates rapid refreshes (React useEffect cleanup)

4. **Canceled Subscriptions:**
   - Same mechanism revokes access immediately
   - Critical for security (prevent post-cancellation access)

### **Performance Considerations:**

- Supabase Realtime has minimal overhead (WebSocket connection)
- JWT refresh is lightweight (~100ms)
- Only triggers on `billingVersion` change (not every profile update)

## 📊 **Definition of Done**

- [ ] Supabase Realtime enabled for `profile` table
- [ ] `BillingSync` component created and added to root layout
- [ ] Component listens for `billing_version` changes
- [ ] JWT refresh triggered automatically on billing updates
- [ ] Server components refresh after JWT update
- [ ] Manual testing: Subscribe and access premium feature < 5 seconds
- [ ] Manual testing: Cancel and lose access < 5 seconds
- [ ] Error handling for failed JWT refresh attempts

## 🧪 **Testing Requirements**

### **Integration Tests:**

```typescript
test('should refresh JWT after webhook updates billing', async () => {
  // 1. Subscribe user via Stripe webhook
  await handleCheckoutCompleted(mockCheckoutSession);

  // 2. Wait for Realtime notification
  await waitFor(() => {
    expect(mockRouter.refresh).toHaveBeenCalled();
  });

  // 3. Verify JWT has new billing data
  const { data: { session } } = await supabase.auth.getSession();
  expect(session?.user.app_metadata.billing.plan).toBe('premium');
});
```

### **Manual Testing:**

```bash
# Terminal 1: Start dev server
pnpm dev

# Terminal 2: Forward Stripe webhooks
stripe listen --forward-to localhost:3000/api/stripe/webhook

# Terminal 3: Trigger test subscription
stripe trigger checkout.session.completed

# Browser: Watch console logs for:
# "🔄 Billing update detected, refreshing JWT..."
# "✅ JWT refreshed with new billing data"
```

**Test Scenarios:**
1. Subscribe to premium → Access premium feature immediately
2. Cancel subscription → Lose access immediately
3. Upgrade from premium to unlimited → New limits apply immediately
4. User offline during webhook → Access updated on next page load

## 🚫 **Out of Scope**

- Offline sync/retry mechanism (handled by eventual consistency)
- Admin dashboard for monitoring JWT refresh rates
- Alerting for failed JWT refresh attempts
- Custom retry logic (Supabase handles reconnection)
- Polling fallback for browsers without WebSocket support

## 📝 **Notes**

**Why Supabase Realtime is Best Choice:**
- Already available (no new infrastructure)
- Real-time (< 1 second latency)
- Leverages existing `billingVersion` increment
- Automatic reconnection and error handling
- Scales with Supabase infrastructure

**Alternative Approaches Considered:**
1. **Redis Pub/Sub** - Requires additional infrastructure, overkill for this use case
2. **Database Polling** - Higher latency (5-10 seconds), more database load
3. **Webhook → Client Direct** - No way to identify which clients to notify

**Related Tickets:**
- Ticket #0015: Webhook Idempotency Tracking
- Ticket #0017: Verify Payment Status Before Granting Access

## 🏷️ **Labels**

- `priority: high`
- `type: enhancement`
- `component: billing`
- `component: auth`
- `user-experience`
- `real-time`
- `supabase-realtime`
