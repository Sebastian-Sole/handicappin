# 0005 - Migrate Stripe Endpoints to tRPC

## 🎯 **Description**

Investigate and migrate Stripe billing endpoints from Next.js API routes to tRPC procedures for better type safety, code organization, and consistency with the rest of the application.

## 📋 **User Story**

As a developer, I want billing endpoints to use tRPC so that I have end-to-end type safety, better error handling, and a consistent API pattern across the application.

## 🔧 **Technical Context**

Currently, Stripe billing uses Next.js API routes (`/api/stripe/*`):
- `/api/stripe/checkout` - Creates checkout sessions
- `/api/stripe/portal` - Creates customer portal sessions
- `/api/stripe/webhook` - Handles Stripe webhook events

The rest of the application uses tRPC for API calls, which provides:
- Automatic TypeScript type inference
- Built-in error handling
- Request/response validation with Zod
- Better testing patterns

**Challenge:** Webhooks must remain as API routes (external Stripe calls), but user-initiated actions can move to tRPC.

## ✅ **Acceptance Criteria**

- [ ] Checkout session creation moved to tRPC procedure
- [ ] Customer portal session creation moved to tRPC procedure
- [ ] Webhook endpoint remains as API route (external)
- [ ] Free tier subscription action moved to tRPC procedure
- [ ] All tRPC procedures have proper Zod input validation
- [ ] Error handling uses tRPC error types
- [ ] Frontend components updated to use tRPC hooks
- [ ] Build passes with full type safety
- [ ] All existing functionality works identically

## 🚨 **Technical Requirements**

### **Implementation Details**

1. **Create Billing Router**
```typescript
// server/api/routers/billing.ts
export const billingRouter = createTRPCRouter({
  createCheckoutSession: protectedProcedure
    .input(
      z.object({
        plan: z.enum(['premium', 'unlimited', 'lifetime']),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx;

      const session = input.plan === 'lifetime'
        ? await createLifetimeCheckoutSession({
            userId: user.id,
            email: user.email!,
            priceId: PLAN_TO_PRICE_MAP[input.plan],
            successUrl: `${process.env.NEXT_PUBLIC_SITE_URL}/billing/success`,
            cancelUrl: `${process.env.NEXT_PUBLIC_SITE_URL}/onboarding`,
          })
        : await createCheckoutSession({ /* ... */ });

      return { url: session.url };
    }),

  createPortalSession: protectedProcedure
    .mutation(async ({ ctx }) => {
      const { user } = ctx;

      // Get customer ID from database
      const { data: customer, error } = await ctx.supabase
        .from('stripe_customers')
        .select('stripe_customer_id')
        .eq('user_id', user.id)
        .single();

      if (error || !customer) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'No Stripe customer found',
        });
      }

      const session = await createPortalSession({
        customerId: customer.stripe_customer_id,
        returnUrl: `${process.env.NEXT_PUBLIC_SITE_URL}/billing`,
      });

      return { url: session.url };
    }),

  selectFreePlan: protectedProcedure
    .mutation(async ({ ctx }) => {
      const { error } = await ctx.supabase
        .from('profile')
        .update({
          plan_selected: 'free',
          plan_selected_at: new Date().toISOString(),
        })
        .eq('id', ctx.user.id);

      if (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update plan selection',
        });
      }

      return { success: true };
    }),
});
```

2. **Update Frontend Components**
```typescript
// components/billing/plan-selector.tsx
const { mutate: createCheckout } = api.billing.createCheckoutSession.useMutation({
  onSuccess: (data) => {
    if (data.url) window.location.href = data.url;
  },
  onError: (error) => {
    toast({
      title: "Error",
      description: error.message,
      variant: "destructive",
    });
  },
});

const { mutate: selectFree } = api.billing.selectFreePlan.useMutation({
  onSuccess: () => {
    router.push('/');
    router.refresh();
  },
  onError: (error) => {
    toast({
      title: "Error",
      description: error.message,
      variant: "destructive",
    });
  },
});

const handlePaidPlan = (plan: 'premium' | 'unlimited' | 'lifetime') => {
  createCheckout({ plan });
};

const handleFreePlan = () => {
  selectFree();
};
```

3. **Keep Webhook as Separate API Route**
```typescript
// app/api/stripe/webhook/route.ts
// This MUST stay as a dedicated API route (not a tRPC procedure) because:
// - Stripe needs to POST to a specific URL (/api/stripe/webhook)
// - Requires raw request body access for signature verification
// - tRPC procedures are accessed via /api/trpc/[trpc] with tRPC protocol
// - External webhooks cannot use tRPC's client-server communication pattern
```

### **Dependencies**

- `server/api/routers/billing.ts` - new file to create
- `server/api/root.ts` - add billing router
- `components/billing/plan-selector.tsx` - update to use tRPC
- `components/billing/manage-subscription-button.tsx` - update to use tRPC
- `app/onboarding/actions.ts` - can be removed after migration
- `app/api/stripe/checkout/route.ts` - remove after migration
- `app/api/stripe/portal/route.ts` - remove after migration

### **Integration Points**

- tRPC context for user authentication
- Supabase client for database queries
- Stripe SDK for API calls
- Frontend components using tRPC hooks

## 🔍 **Implementation Notes**

**Benefits of tRPC Migration:**
1. **Type Safety**: Full TypeScript inference from server to client
2. **Validation**: Automatic Zod schema validation on inputs
3. **Error Handling**: Structured error types with codes
4. **Consistency**: Same pattern as auth, rounds, courses, etc.
5. **Developer Experience**: Better autocomplete and refactoring

**Migration Strategy:**
1. Create new tRPC procedures alongside existing API routes
2. Update one component at a time to use tRPC
3. Test each component thoroughly
4. Remove old API routes once all components migrated
5. Keep webhook as API route (external requirement)

**Webhook Consideration:**
The webhook endpoint CANNOT be migrated to tRPC because:
- Stripe makes external HTTP POST requests
- tRPC is designed for internal client-server communication
- Webhooks need raw request body for signature verification

## 📊 **Definition of Done**

- [ ] All user-initiated billing actions use tRPC
- [ ] Webhook remains as API route
- [ ] No breaking changes to functionality
- [ ] Type safety verified across all billing flows
- [ ] Old API routes removed (except webhook)
- [ ] Frontend components updated
- [ ] Code review completed
- [ ] Documentation updated

## 🧪 **Testing Requirements**

- [ ] Test free plan selection via tRPC
- [ ] Test premium/unlimited checkout via tRPC
- [ ] Test lifetime checkout via tRPC
- [ ] Test customer portal via tRPC
- [ ] Verify webhook still works as API route
- [ ] Test error scenarios (no customer, invalid plan, etc.)
- [ ] Verify type safety in IDE (autocomplete, errors)

## 🚫 **Out of Scope**

- Migrating webhook to tRPC (impossible - external calls)
- Adding new billing features
- Changing business logic
- UI/UX improvements
- Performance optimizations
- Adding analytics or tracking

## 📝 **Notes**

**tRPC Pattern in Codebase:**
The app already uses tRPC extensively:
- `server/api/routers/auth.ts` - authentication
- `server/api/routers/round.ts` - round management
- `server/api/routers/scorecard.ts` - scorecard operations

Follow these existing patterns for consistency.

**Error Handling Example:**
```typescript
throw new TRPCError({
  code: 'BAD_REQUEST',
  message: 'Invalid plan selection',
});
```

## 🏷️ **Labels**

- `priority: medium`
- `type: enhancement`
- `component: billing`
- `technical-improvement`
- `type-safety`
