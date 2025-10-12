# 0004 - Refactor and Clean Up Stripe Billing Code

## 🎯 **Description**

Clean up and refactor the Stripe billing implementation code to remove redundancy, improve maintainability, and ensure database migrations are properly managed through Drizzle ORM.

## 📋 **User Story**

As a developer, I want clean, maintainable billing code so that future changes and debugging are easier and the codebase follows best practices.

## 🔧 **Technical Context**

The MVP Stripe integration is functional but has technical debt:

- Duplicate customer creation logic in both checkout functions
- Manual SQL migration may not be synced with Drizzle schema
- Check constraint needs updating for "lifetime" plan
- Inconsistent error handling across billing endpoints
- Repeated logging patterns that could be centralized

## ✅ **Acceptance Criteria**

- [ ] Customer creation/lookup logic extracted to single reusable function
- [ ] Database schema matches all applied migrations
- [ ] Check constraint includes all plan types: 'free', 'premium', 'unlimited', 'lifetime'
- [ ] Error handling is consistent across all billing endpoints
- [ ] Logging utility created for webhook events
- [ ] No duplicate code between `createCheckoutSession` and `createLifetimeCheckoutSession`
- [ ] Build passes without warnings
- [ ] All existing tests still pass

## 🚨 **Technical Requirements**

### **Implementation Details**

1. **Extract Customer Management**

```typescript
// lib/stripe-customer.ts
export async function getOrCreateStripeCustomer({
  email,
  userId,
}: {
  email: string;
  userId: string;
}): Promise<string> {
  // Search for existing customer
  const existing = await stripe.customers.list({ email, limit: 1 });
  if (existing.data.length > 0) return existing.data[0].id;

  // Create new customer with metadata
  const customer = await stripe.customers.create({
    email,
    metadata: { supabase_user_id: userId },
  });
  return customer.id;
}
```

2. **Verify Migration Status**

- Check if `supabase/migrations/20251011130000_add_plan_tracking_to_profile.sql` matches current schema
- Generate new migration if schema has diverged
- Update constraint to include "lifetime" plan type

3. **Create Webhook Logger**

```typescript
// lib/webhook-logger.ts
export function logWebhookEvent(type: string, data: any) {
  console.log(`📥 Webhook: ${type}`, {
    timestamp: new Date().toISOString(),
    ...data,
  });
}
```

### **Dependencies**

- `lib/stripe.ts` - needs refactoring
- `app/api/stripe/webhook/route.ts` - use new logger
- `db/schema.ts` - verify matches migrations
- `supabase/migrations/20251011130000_add_plan_tracking_to_profile.sql` - may need update
- `utils/supabase/middleware.ts` - Potential refactoring opportunities
- `utils/billing/access-control.ts` - Potential refactoring opportunities

### **Integration Points**

- Stripe API calls
- Database schema/migrations
- Webhook handlers
- Checkout session creation

## 🔍 **Implementation Notes**

**Customer Creation Refactor:**

- Both checkout functions have identical customer lookup logic
- Extract to shared utility function
- Add proper error handling and logging
- Consider caching for performance

**Migration Verification:**

- Run `pnpm db:generate` to see if new migration is created
- If new migration exists, existing SQL migration is outdated
- Update SQL migration or rely on Drizzle-generated migration

**Constraint Update:**

- Current constraint: `CHECK (plan_selected IN ('free', 'premium', 'unlimited'))`
- Needed: `CHECK (plan_selected IN ('free', 'premium', 'unlimited', 'lifetime') OR plan_selected IS NULL)`

## 📊 **Definition of Done**

- [ ] No duplicate customer creation logic
- [ ] Single source of truth for customer management
- [ ] Database schema and migrations are in sync
- [ ] Check constraint includes "lifetime" plan
- [ ] Webhook logging uses centralized utility
- [ ] Code review completed
- [ ] Documentation updated

## 🧪 **Testing Requirements**

- [ ] Run `pnpm db:generate` and verify no unexpected migrations
- [ ] Test customer creation with new/existing customers
- [ ] Verify constraint allows "lifetime" plan in database
- [ ] Test all checkout flows still work
- [ ] Webhook logs format correctly

## 🚫 **Out of Scope**

- Adding new features to billing system
- Changing business logic or plan pricing
- Modifying UI components
- Adding new webhook event types
- Performance optimizations beyond basic refactoring

## 📝 **Notes**

**Files to Review:**

- `lib/stripe.ts` (lines 42-110) - duplicate customer logic
- `app/api/stripe/webhook/route.ts` (lines 94-173) - logging patterns
- `supabase/migrations/20251011130000_add_plan_tracking_to_profile.sql` (line 4) - constraint definition
- `utils/supabase/middleware.ts`
- `utils/billing/access-control.ts`

## 🏷️ **Labels**

- `priority: high`
- `type: refactor`
- `component: billing`
- `technical-debt`
- `database-migration`
