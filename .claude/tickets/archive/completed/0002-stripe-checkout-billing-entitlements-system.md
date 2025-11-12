# 0002 - Stripe Checkout & Billing Entitlements System (Alternative Architecture)

## 🎯 **Description**

**⚠️ IMPORTANT: This ticket represents an alternative architectural approach to ticket #0001. These two approaches are mutually exclusive. Research is required to determine which approach is better suited for this golf SaaS application.**

Implement end-to-end billing using Stripe Checkout Sessions and Customer Portal where feature access is controlled by Stripe-derived entitlements stored in a dedicated `billing` schema. This approach includes:

- **Forced onboarding flow** after email verification requiring plan selection
- **Server-created Checkout Sessions** (not Payment Links) with per-user metadata
- **Stripe Customer Portal** for self-service subscription management
- **Webhook-driven synchronization** to a dedicated billing database schema
- **Promotion code support** including "first 100 users get Premium forever"
- **Strict entitlement-based access control** preventing bypass

## 📋 **User Story**

As an authenticated user, I want to choose a plan and complete payment (or apply an early-adopter promo) so that my account immediately gains the correct feature access without manual intervention or synchronization issues.

## 🔧 **Technical Context**

### Comparison: Ticket #0001 vs #0002

| Aspect              | Ticket #0001 (Payment Links)  | Ticket #0002 (Checkout + Portal)         |
| ------------------- | ----------------------------- | ---------------------------------------- |
| **Payment Method**  | Stripe Payment Links          | Server-created Checkout Sessions         |
| **Database Schema** | Add fields to `profile` table | Dedicated `billing` schema with 3 tables |
| **Onboarding**      | Optional upgrade prompts      | Forced plan selection before app access  |
| **Self-Service**    | Payment Links only            | Full Customer Portal integration         |
| **Metadata**        | Limited customer metadata     | Rich per-session user metadata           |
| **Promotion Codes** | Manual promo handling         | Native Checkout promotion codes          |
| **Complexity**      | Lower (MVP approach)          | Higher (enterprise-grade)                |
| **Flexibility**     | Less flexible, simpler        | More flexible, feature-rich              |
| **Security**        | RLS on profile table          | Dedicated billing schema + RLS           |

### Current State (Discovered via Research)

**Existing Infrastructure:**

- Next.js 15.5.1 with App Router
- Supabase Auth + PostgreSQL via Drizzle ORM
- tRPC API with `authedProcedure` middleware
- Profile table: `id`, `email`, `name`, `handicapIndex`, `verified`, `createdAt`
- Middleware: Basic auth checks, redirects unauthenticated users
- Post-verification flow: Redirects to `/login?verified=true` (no onboarding)
- Existing users: Unknown count (affects early adopter eligibility)

**What Doesn't Exist:**

- No billing/subscription tables
- No onboarding flow or forced plan selection
- No Stripe integration whatsoever
- No round limit tracking or enforcement
- No feature gating infrastructure

**Key Technical Details:**

- Auth: Supabase with email verification via Resend
- API: tRPC routers in `server/api/routers/`
- Deployment: Vercel (webhooks will be publicly accessible)
- Current signup flow: `signup` → email verification → `login`

### Plans & Pricing

**Subscription Tiers:**

1. **Free (Base)**: 25 rounds total, basic features
2. **Premium**: $19/year, unlimited rounds, basic features
3. **Unlimited**: $29/year, unlimited rounds + premium features
4. **Unlimited (Lifetime)**: $149 one-time, everything forever

**Early Adopter Promotion:**

- First **100 users** receive **Premium for $0/year forever**
- Implemented via Stripe promotion code with:
  - `duration: forever`
  - `max_redemptions: 100`
  - Applied during Checkout (not Payment Links)

### Security Model

**Key Security Principle:** Users MUST NOT be able to gain Premium/Unlimited access without a valid Stripe purchase/subscription, except via the early-adopter promotion.

**Entitlement Source of Truth:** Stripe webhooks write to `billing.subscriptions` table. All feature checks read from this table.

## ✅ **Acceptance Criteria**

### Forced Onboarding Flow

- [ ] After email verification, users are **redirected to `/onboarding`** (not `/login`)
- [ ] Middleware blocks access to main app routes if no entitlement row exists in `billing.subscriptions`
- [ ] Onboarding page displays 4 plan options: Free, Premium (yearly), Unlimited (yearly), Unlimited (lifetime)
- [ ] Free plan selection creates entitlement row server-side without Stripe interaction
- [ ] Paid plan selections create server-side Checkout Session and redirect to Stripe
- [ ] User cannot bypass onboarding by navigating directly to dashboard/rounds

### Checkout Session Creation

- [ ] `POST /api/stripe/checkout` endpoint accepts `{ priceId, mode }` with Zod validation
- [ ] Endpoint retrieves authenticated user via Supabase `auth.getUser()`
- [ ] Finds or creates `billing.customers` row and Stripe Customer (sets `metadata.supabase_user_id`)
- [ ] Creates Checkout Session with:
  - `customer`, `mode`, `line_items`, `client_reference_id=user.id`
  - `metadata.supabase_user_id=user.id` for stable linkage
  - `allow_promotion_codes: true`
  - `success_url=/billing/success?session_id={CHECKOUT_SESSION_ID}`
  - `cancel_url=/onboarding` (return to plan selection)
- [ ] Returns `{ url: session.url }` for client redirect
- [ ] Handles errors gracefully with user-friendly messages

### Stripe Webhook Integration

- [ ] `POST /api/stripe/webhook` endpoint verifies signature with `STRIPE_WEBHOOK_SECRET`
- [ ] Handles `checkout.session.completed`:
  - For `mode='subscription'`: Fetches subscription, maps price→plan, upserts entitlement
  - For `mode='payment'` (lifetime): Sets `plan='unlimited'`, `is_lifetime=true`, `status='active'`
- [ ] Handles `customer.subscription.created|updated|deleted`:
  - Maps price→plan, upserts `status`, `current_period_end`
- [ ] Handles `invoice.payment_succeeded` and `invoice.payment_failed`
- [ ] All DB writes use `upsert_subscription()` RPC (atomic, idempotent)
- [ ] Records all events in `billing.events` table for auditing
- [ ] Returns 200 for handled events, 200 for unknown events (prevents retry storms)

### Customer Portal Integration

- [ ] `POST /api/stripe/portal` endpoint creates Billing Portal session for current user
- [ ] Returns `{ url: portalSession.url }` for redirect
- [ ] Portal accessible from `/billing` page (authenticated users only)
- [ ] Users can cancel, upgrade, downgrade, update payment methods
- [ ] Webhook updates immediately sync portal changes to `billing.subscriptions`

### Promotion Code Support

- [ ] Stripe Dashboard: Create "Premium Forever" promotion code
  - Applies to `STRIPE_PREMIUM_PRICE_ID`
  - `percent_off: 100` or `amount_off` = full price
  - `duration: forever`
  - `max_redemptions: 100`
- [ ] Checkout Sessions have `allow_promotion_codes: true`
- [ ] Onboarding UI hints: "Have a promo code? Enter at checkout"
- [ ] Webhook correctly processes $0 subscriptions with promo codes
- [ ] Optionally display remaining promo redemptions (non-blocking server fetch)

### Feature Gating & Access Control

- [ ] All API routes check `billing.subscriptions` for feature access
- [ ] Server components query: `SELECT plan, status, is_lifetime FROM billing.subscriptions WHERE user_id = auth.uid()`
- [ ] Premium access condition: `(plan IN ('premium','unlimited') AND status IN ('active','trialing')) OR is_lifetime=true`
- [ ] Free tier blocks: Premium features, rounds beyond 25
- [ ] UI components conditionally render based on entitlements
- [ ] Upgrade prompts shown when users try premium features or hit limits

### Database Schema & RLS

- [ ] **Schema `billing`** created
- [ ] **Table `billing.customers`**:
  - `user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE`
  - `stripe_customer_id TEXT UNIQUE NOT NULL`
  - `created_at TIMESTAMPTZ DEFAULT NOW()`
- [ ] **Table `billing.subscriptions`**:
  - `user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE`
  - `stripe_subscription_id TEXT NULL`
  - `plan TEXT NOT NULL` (enum: 'free' | 'premium' | 'unlimited')
  - `status TEXT NOT NULL` (e.g., 'active', 'canceled', 'past_due')
  - `current_period_end TIMESTAMPTZ NULL`
  - `is_lifetime BOOLEAN DEFAULT FALSE NOT NULL`
  - `updated_at TIMESTAMPTZ DEFAULT NOW()`
- [ ] **Table `billing.events`** (optional audit log):
  - `id BIGSERIAL PRIMARY KEY`
  - `user_id UUID NULL`
  - `type TEXT NOT NULL`
  - `payload JSONB NOT NULL`
  - `created_at TIMESTAMPTZ DEFAULT NOW()`
- [ ] **PostgreSQL enum or check constraint** for `plan` values
- [ ] **RPC `upsert_subscription(p_user_id UUID, p_patch JSONB)`**:
  - `INSERT ... ON CONFLICT (user_id) DO UPDATE`
  - Sets `updated_at = NOW()`
  - Atomic operation, idempotent
- [ ] **RLS enabled** on all `billing.*` tables
- [ ] **RLS policies**:
  - SELECT: `user_id = auth.uid()`
  - INSERT/UPDATE/DELETE: **Disabled** for anon/authenticated roles
  - Webhook/server writes use **Service Role key** (bypasses RLS)

### Middleware Integration

- [ ] Middleware checks if authenticated user has row in `billing.subscriptions`
- [ ] If no entitlement row exists → redirect to `/onboarding`
- [ ] Public paths exempt: `/`, `/login`, `/signup`, `/verify-email`, `/api`, `/about`, `/calculators`
- [ ] `/onboarding` accessible only to authenticated users without entitlements

### Error Handling & Edge Cases

- [ ] Checkout Session creation errors return user-friendly messages
- [ ] Webhook signature verification failures return 401
- [ ] Duplicate webhook events are idempotent (no double-writes)
- [ ] `past_due` or `incomplete` subscription status denies premium access
- [ ] Email change in Supabase doesn't break linkage (uses `metadata.supabase_user_id`)
- [ ] Lifetime purchase while active subscription exists: Sets `is_lifetime=true`, optionally cancels subscription at period end
- [ ] Stripe API/network errors gracefully handled with retries where appropriate

## 🚨 **Technical Requirements**

### Implementation Files

**New Files to Create:**

1. **Database Migration**: `supabase/migrations/YYYYMMDD_create_billing_schema.sql`

   - Create `billing` schema
   - Create `billing.customers`, `billing.subscriptions`, `billing.events` tables
   - Create `upsert_subscription()` RPC function
   - Create RLS policies
   - Add indexes

2. **Stripe Library**: `lib/stripe.ts`

   - Initialize Stripe client with secret key
   - Export price ID constants
   - Helper functions: `getOrCreateCustomer()`, `mapPriceToPlan()`, `createCheckoutSession()`, `createPortalSession()`

3. **Billing Types**: `types/billing.ts`

   - TypeScript types for `Subscription`, `Customer`, `Plan`, `SubscriptionStatus`
   - Zod schemas for API validation

4. **API Routes**:

   - `app/api/stripe/checkout/route.ts` - Create Checkout Session
   - `app/api/stripe/portal/route.ts` - Create Portal Session
   - `app/api/stripe/webhook/route.ts` - Handle Stripe webhooks

5. **Onboarding Page**: `app/onboarding/page.tsx`

   - Server component fetching available plans
   - Client component for plan selection
   - Server action for free plan selection
   - API calls for paid plan Checkout redirects

6. **Billing Page**: `app/billing/page.tsx`

   - Display current subscription status
   - Link to Customer Portal
   - Success/cancel callback handling

7. **Utilities**:

   - `utils/billing/access-control.ts` - Feature gating helpers
   - `utils/billing/entitlements.ts` - Check user plan/status

8. **Middleware Updates**: `utils/supabase/middleware.ts`
   - Add entitlement check
   - Redirect to `/onboarding` if missing

**Files to Modify:**

1. `env.js` - Add Stripe environment variables with Zod validation
2. `middleware.ts` - Integrate billing checks
3. `components/layout/navbar.tsx` - Add billing/upgrade links
4. `app/verify-email/page.tsx` - Redirect to `/onboarding` instead of `/login`
5. `server/api/routers/round.ts` - Add round limit checks for free tier
6. `server/api/trpc.ts` - Optionally add `paidProcedure` middleware

### Environment Variables

```bash
# Stripe API Keys
STRIPE_SECRET_KEY=sk_test_... # sk_live_... in production
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_... # pk_live_... in production
STRIPE_WEBHOOK_SECRET=whsec_...

# Stripe Price IDs (from Stripe Dashboard)
STRIPE_PREMIUM_PRICE_ID=price_...
STRIPE_UNLIMITED_PRICE_ID=price_...
STRIPE_UNLIMITED_LIFETIME_PRICE_ID=price_...

# Site URL for redirects
NEXT_PUBLIC_SITE_URL=http://localhost:3000 # https://handicappin.com in production
```

### Stripe Dashboard Setup

**Products & Prices:**

1. **Premium Plan**

   - Name: "Premium"
   - Billing: Recurring - Yearly
   - Price: $19/year
   - Copy `price_id` to `STRIPE_PREMIUM_PRICE_ID`

2. **Unlimited Plan**

   - Name: "Unlimited"
   - Billing: Recurring - Yearly
   - Price: $29/year
   - Copy `price_id` to `STRIPE_UNLIMITED_PRICE_ID`

3. **Unlimited Lifetime**
   - Name: "Unlimited Lifetime"
   - Billing: One-time
   - Price: $149
   - Copy `price_id` to `STRIPE_UNLIMITED_LIFETIME_PRICE_ID`

**Promotion Code:**

- **Name**: "PREMIUM100" (or similar)
- **Applies to**: Premium Plan (`STRIPE_PREMIUM_PRICE_ID`)
- **Discount**: 100% off
- **Duration**: Forever
- **Max Redemptions**: 100
- **Active**: Yes

**Webhook Configuration:**

1. Add endpoint: `https://your-domain.com/api/stripe/webhook`
2. Select events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
3. Copy **Signing Secret** to `STRIPE_WEBHOOK_SECRET`

**Customer Portal:**

- Enable all self-service features:
  - Cancel subscription
  - Update payment method
  - View invoice history
- Configure business information (name, email, support URL)

### Dependencies

**New NPM Packages:**

```bash
pnpm add stripe @stripe/stripe-js
pnpm add -D @types/stripe-event-types # Optional: Type-safe webhook events
```

**Existing Dependencies:**

- Next.js App Router (existing)
- Supabase client (existing)
- Drizzle ORM (existing)
- tRPC (existing)
- Zod (existing)

### Integration Points

**Supabase:**

- Auth: `auth.users.id` links to `billing.customers.user_id` and `billing.subscriptions.user_id`
- Database: Service Role key for webhook writes (bypasses RLS)
- RLS: Prevents client-side billing table modifications

**tRPC:**

- Add entitlement checks to existing procedures
- Optionally create `paidProcedure` middleware extending `authedProcedure`
- Round submission checks subscription tier

**Middleware:**

- Integrate entitlement check after auth check
- Redirect flow: Unauthenticated → `/login`, Authenticated without entitlement → `/onboarding`

**UI Components:**

- Dashboard: Display subscription status, upgrade prompts
- Navbar: Link to billing page
- Feature gates: Conditionally render premium features

## 🔍 **Implementation Notes**

### Critical Security Considerations

**DO NOT:**

- Trust client-provided plan/tier data
- Allow client-side writes to `billing.*` tables
- Expose Stripe Secret Key to client
- Skip webhook signature verification
- Hard-code price IDs in UI (use environment variables)

**DO:**

- Derive all feature access from `billing.subscriptions` table written by webhooks
- Use Service Role key for webhook database writes
- Validate all API inputs with Zod
- Use `metadata.supabase_user_id` for stable Stripe↔Supabase linkage
- Implement idempotent webhook handlers (upsert pattern)
- Log all webhook events to `billing.events` for debugging

### Price ID Mapping Strategy

**Never string-compare product names.** Map price IDs via environment variables:

```typescript
// lib/stripe.ts
export const PRICE_TO_PLAN_MAP: Record<string, "premium" | "unlimited"> = {
  [process.env.STRIPE_PREMIUM_PRICE_ID!]: "premium",
  [process.env.STRIPE_UNLIMITED_PRICE_ID!]: "unlimited",
  [process.env.STRIPE_UNLIMITED_LIFETIME_PRICE_ID!]: "unlimited",
};

export function mapPriceToPlan(
  priceId: string
): "premium" | "unlimited" | null {
  return PRICE_TO_PLAN_MAP[priceId] ?? null;
}
```

### Lifetime Purchase Handling

**Scenario:** User has active yearly subscription, then purchases lifetime.

**Approach 1 (Recommended):**

- Set `is_lifetime=true` in `billing.subscriptions`
- Keep subscription active until current period end
- Optionally cancel subscription at period end via Stripe API

**Approach 2:**

- Immediately cancel subscription via webhook
- Set `is_lifetime=true`
- Subscription status becomes `canceled`

**Access logic:** `(status IN ('active', 'trialing') AND ...) OR is_lifetime=true`

### Email Change Resilience

- Supabase allows users to change email
- Stripe Customer is linked via `metadata.supabase_user_id` (UUID)
- Email changes don't break Stripe↔Supabase linkage
- Optionally sync email changes to Stripe Customer (future enhancement)

### Webhook Idempotency

Stripe may send duplicate webhook events. Use **upsert pattern**:

```sql
-- RPC: upsert_subscription
INSERT INTO billing.subscriptions (user_id, plan, status, stripe_subscription_id, current_period_end, updated_at)
VALUES ($1, $2, $3, $4, $5, NOW())
ON CONFLICT (user_id)
DO UPDATE SET
  plan = EXCLUDED.plan,
  status = EXCLUDED.status,
  stripe_subscription_id = EXCLUDED.stripe_subscription_id,
  current_period_end = EXCLUDED.current_period_end,
  updated_at = NOW();
```

### Reconciliation Job (Future Enhancement)

**Purpose:** Detect and fix Stripe↔Database drift.

**Approach:**

- Daily server job (cron or Vercel Cron)
- For all users with `stripe_subscription_id`, fetch from Stripe
- Compare with `billing.subscriptions` row
- Re-upsert if mismatched
- Log discrepancies for manual review

**Out of scope for MVP but recommended for production.**

### Early Adopter Cutoff

**Challenge:** How to enforce "first 100 users" when promotion code has 100 redemptions?

**Approach 1:** Rely on Stripe promotion code `max_redemptions=100` (automatic cutoff).

**Approach 2:** Track early adopter count in database:

- Query `SELECT COUNT(*) FROM billing.subscriptions WHERE plan='premium' AND status='active' AND stripe_subscription_id IS NULL OR [promo applied]`
- If count >= 100, hide promo code hint in UI
- Stripe enforces hard limit anyway

**Recommendation:** Use Approach 1 (rely on Stripe) for simplicity.

### Payment Links vs Checkout Sessions

**Why NOT use Payment Links (like ticket #0001)?**

Payment Links are great for simple use cases, but lack:

- Per-user metadata (can't link customer to Supabase user reliably)
- Promotion code support (less flexible)
- Programmatic customization per session
- Integration with Customer Portal metadata

**Why USE Checkout Sessions (this approach)?**

- Rich metadata per session (`client_reference_id`, `metadata.supabase_user_id`)
- Built-in promotion code support
- Programmatic control over success/cancel URLs
- Better integration with Customer Portal
- Industry-standard for SaaS billing

### Taxes & SCA (Strong Customer Authentication)

**Out of scope for MVP but easy to add:**

Enable in Stripe Checkout Session:

```typescript
automatic_tax: { enabled: true },
payment_method_types: ['card'], // SCA handled automatically
```

No custom code required if using Stripe Tax.

## 📊 **Definition of Done**

### Functional Requirements

- [ ] Users cannot access dashboard/rounds without an entitlement row
- [ ] Onboarding hard-stops all app access until plan selected
- [ ] Free plan selection creates entitlement without Stripe
- [ ] Paid plan selection redirects to Stripe Checkout
- [ ] Checkout includes promotion code field
- [ ] "Premium Forever" promo works, results in `plan='premium'`, `status='active'`, $0 charge
- [ ] Webhooks reliably upsert entitlements
- [ ] Customer Portal allows cancel/upgrade/downgrade
- [ ] Portal changes immediately reflected in database via webhooks
- [ ] Premium/Unlimited features blocked for free tier users
- [ ] Round limit (25) enforced for free tier
- [ ] Lifetime purchases grant permanent access

### Security Requirements

- [ ] Client cannot modify `billing.*` tables (RLS blocks)
- [ ] Webhook signature verification rejects invalid requests
- [ ] Service Role key used only server-side for webhook writes
- [ ] Price IDs validated against environment variables
- [ ] User metadata ensures correct user linkage

### Testing Requirements

- [ ] **Manual Testing**:

  - Free tier selection (onboarding → entitlement created → dashboard access)
  - Premium yearly purchase (Checkout → success → webhook → entitlement updated)
  - Unlimited yearly purchase and cancellation via Portal
  - Unlimited lifetime purchase (one-time payment → permanent access)
  - Promo code application (100% off, `duration=forever`)
  - Middleware redirect when no entitlement
  - Feature gating (free user blocked from premium features)
  - Round limit enforcement (free tier 26th round blocked)

- [ ] **Edge Cases**:

  - `past_due` subscription status denies access
  - `incomplete` subscription status denies access
  - Email change doesn't break linkage
  - Webhook replay (idempotency - no duplicate entitlements)
  - Lifetime purchase while active subscription exists
  - Stripe API error handling (network failures, invalid requests)
  - Promotion code exceeding 100 redemptions (Stripe blocks)

- [ ] **Automated Testing** (future enhancement):
  - Unit tests for price→plan mapping
  - Integration tests for webhook handlers (using Stripe CLI `stripe trigger`)
  - Entitlement check unit tests

## 🧪 **Testing Strategy**

### Local Development Testing

**Setup:**

1. Install Stripe CLI: `brew install stripe/stripe-cli/stripe`
2. Login: `stripe login`
3. Forward webhooks: `stripe listen --forward-to localhost:3000/api/stripe/webhook`
4. Copy webhook signing secret to `.env.local`

**Test Scenarios:**

1. **Free Plan Onboarding:**

   - Sign up → verify email → redirected to `/onboarding`
   - Select "Free" → server action creates entitlement
   - Verify `billing.subscriptions` row exists with `plan='free'`
   - Access dashboard successfully

2. **Paid Plan Checkout:**

   - Sign up → onboarding → select "Premium"
   - Redirected to Stripe Checkout
   - Use test card: `4242 4242 4242 4242`
   - Complete checkout → redirected to `/billing/success`
   - Verify webhook received and `billing.subscriptions` updated
   - Access premium features

3. **Promotion Code:**

   - Start Premium checkout
   - Enter promo code at Checkout
   - Complete with $0 payment
   - Verify `plan='premium'`, `status='active'`
   - Access unlimited rounds

4. **Customer Portal:**

   - Navigate to `/billing`
   - Click "Manage Subscription"
   - Cancel subscription
   - Verify webhook updates `status='canceled'`
   - Subscription active until period end

5. **Webhook Replay:**
   - Use Stripe CLI: `stripe trigger checkout.session.completed`
   - Verify idempotency (no duplicate rows)
   - Check `billing.events` for logged event

### Production Testing

**Pre-Launch Checklist:**

- [ ] Switch to live Stripe keys (`sk_live_...`, `pk_live_...`)
- [ ] Create live products/prices in Stripe Dashboard
- [ ] Configure live webhook endpoint
- [ ] Test live promotion code (use test promo, don't waste the 100 limit)
- [ ] Verify webhook signature with live secret
- [ ] Test real payment (small amount, refund immediately)
- [ ] Monitor Stripe Dashboard for webhook delivery
- [ ] Set up Stripe webhook monitoring/alerts

## 🚫 **Out of Scope**

### NOT Included in This Ticket

- **Team/seat-based billing** - Single-user accounts only
- **Usage-based metering** - Fixed tiers, not consumption-based
- **Multi-tenant organizations** - One user = one subscription
- **Custom proration logic** - Rely on Stripe Portal defaults
- **Referral system** - Future enhancement
- **Affiliate tracking** - Future enhancement
- **Custom invoice generation** - Use Stripe's built-in invoices
- **Payment method variety** - Credit cards only (Stripe default)
- **Tax calculation customization** - Use Stripe Tax or ignore (add later)
- **Advanced analytics** - Basic subscription tracking only
- **A/B testing pricing** - Fixed pricing for MVP
- **Grace period for failed payments** - Use Stripe defaults
- **Subscription pausing** - Cancel/reactivate only

### Future Enhancements (Post-MVP)

- Reconciliation job to sync Stripe→Database
- Email change syncing to Stripe Customer
- Usage analytics dashboard
- Subscription metrics (MRR, churn, LTV)
- Custom email notifications (Stripe handles by default)
- Multiple payment methods (ACH, Apple Pay, etc.)
- International pricing (multi-currency)
- Stripe Tax integration
- Dunning management for failed payments

## 📝 **Notes**

### Why This Approach is Industry-Standard

This architecture follows SaaS billing best practices used by companies like:

- **GitHub** (Checkout + Portal)
- **Vercel** (entitlement-based access)
- **Linear** (webhook-driven sync)
- **Supabase itself** (Stripe Billing integration)

**Advantages:**

- **Security**: Entitlements derived from Stripe (source of truth)
- **Flexibility**: Customer Portal for self-service
- **Scalability**: Webhook-driven, no polling
- **Reliability**: Idempotent webhook handlers prevent drift
- **User Experience**: Smooth onboarding, clear upgrade paths
- **Developer Experience**: Type-safe API, clear separation of concerns

**Disadvantages vs Payment Links:**

- More complex initial setup
- More API routes to maintain
- Requires webhook endpoint configuration
- Higher development effort

### Comparison to Ticket #0001

**When to choose Ticket #0001 (Payment Links):**

- You need to launch quickly (MVP in days, not weeks)
- Your team is small and prefers simplicity
- Self-service subscription management is not critical
- You can tolerate manual intervention for edge cases

**When to choose Ticket #0002 (Checkout + Portal):**

- You want enterprise-grade billing from day one
- Self-service is critical for user experience
- You anticipate complex billing scenarios (prorations, upgrades, etc.)
- You have development resources for proper implementation
- You want to minimize future refactoring

### Recommendation

**RESEARCH REQUIRED:** Before implementing, investigate:

1. **Current user count** - How close are you to 100 users? Affects early adopter strategy.
2. **Development timeline** - Ticket #0001 ships faster; #0002 is more robust.
3. **Team expertise** - Does your team have Stripe Checkout experience?
4. **Product roadmap** - Will you need Customer Portal soon anyway?
5. **User feedback** - What do beta users expect for subscription management?

**Suggested approach:**

- If launching in <2 weeks → Start with #0001, migrate to #0002 later
- If launching in >4 weeks → Implement #0002 for long-term stability
- If unsure → Prototype both, measure complexity

## 🏷️ **Labels**

- `priority: high`
- `type: feature`
- `component: billing`
- `component: payments`
- `backend`
- `frontend`
- `security`
- `stripe`
- `supabase`
- `database-migration`
- `requires-research`
- `alternative-architecture`
- `conflicts-with: 0001`

---

**Estimated Effort:** 40-60 hours (2-3 sprint cycles)

**Complexity:** Very High (dedicated schema, multiple integrations, robust error handling)

**Business Impact:** Critical (primary monetization strategy)

**User Impact:** High (affects onboarding and entire user journey)

**Risk Level:** Medium-High (more moving parts than Payment Links approach)

**Dependencies:** Stripe account, public webhook URL (Vercel deployment)

**Related Tickets:**

- **#0001** - Stripe Payment Links approach (mutually exclusive)

**Decision Required:** Choose between #0001 (simple) or #0002 (robust) before implementation.
