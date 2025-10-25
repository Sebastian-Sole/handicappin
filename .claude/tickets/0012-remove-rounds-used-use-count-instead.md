# 0012 - Remove rounds_used Column, Use COUNT Instead

## 🎯 **Description**

Remove the denormalized `rounds_used` column from the profile table and replace it with on-demand COUNT queries for free tier users only. This provides a single source of truth (the round table) and eliminates synchronization issues.

## 📋 **User Story**

As a developer, I want round count to be calculated from the round table so that we have a single source of truth that never gets out of sync.

## 🔧 **Technical Context**

**Current Approach (Denormalized):**
- `profile.rounds_used` column tracks round count
- Incremented in `server/api/routers/round.ts:402-412`
- **Problems:**
  - Can get out of sync if rounds deleted manually
  - Adds bloat to profile table
  - Requires maintenance in multiple places
  - Not used for paid users (always shows 0)

**Proposed Approach (Single Source of Truth):**
- Remove `rounds_used` column entirely
- For free users: `COUNT(*)` from round table when checking limits
- For paid users: No counting needed (unlimited)
- **Benefits:**
  - Always accurate (can't get out of sync)
  - Simpler code (no manual incrementing)
  - Better separation of concerns
  - Only adds latency for free users (acceptable trade-off)

**Performance Analysis:**
- COUNT query with user_id index: ~5-20ms
- Only executed for free tier users
- Only executed when:
  1. Checking if user can add round (before submission)
  2. Displaying "X rounds remaining" in UI
- Paid users: Zero overhead

## ✅ **Acceptance Criteria**

- [ ] `rounds_used` column removed from profile table
- [ ] Migration created to drop column safely
- [ ] Round submission checks COUNT for free users
- [ ] Access control returns accurate count for free users
- [ ] UI displays correct remaining rounds
- [ ] No performance regression for paid users
- [ ] Free tier limit (25 rounds) still enforced correctly

## 🚨 **Technical Requirements**

### **Implementation Details**

**1. Create Migration to Drop Column**

```sql
-- supabase/migrations/YYYYMMDDHHMMSS_remove_rounds_used_column.sql

-- Drop the rounds_used column from profile table
ALTER TABLE profile DROP COLUMN IF EXISTS rounds_used;

-- Remove index if it exists
DROP INDEX IF EXISTS idx_profile_rounds_used;

-- Update comment
COMMENT ON TABLE profile IS 'User profile data. Round counts calculated on-demand from round table.';
```

**2. Update Access Control**

File: `utils/billing/access-control.ts`

```typescript
// Update getBasicUserAccess function
export async function getBasicUserAccess(
  userId: string
): Promise<FeatureAccess> {
  const supabase = await createServerComponentClient();

  // Get user profile
  const { data: profile, error: profileError } = await supabase
    .from("profile")
    .select("plan_selected") // REMOVED rounds_used
    .eq("id", userId)
    .single();

  if (profileError) {
    console.error("Error fetching profile:", profileError);
    return createNoAccessResponse();
  }

  if (!profile.plan_selected) {
    return createNoAccessResponse();
  }

  // Free plan - COUNT rounds
  if (profile.plan_selected === "free") {
    const { count, error: countError } = await supabase
      .from("round")
      .select("*", { count: "exact", head: true })
      .eq("userId", userId);

    if (countError) {
      console.error("Error counting rounds:", countError);
      return createFreeTierResponse(0);
    }

    return createFreeTierResponse(count || 0);
  }

  // Paid plans - no counting needed
  return {
    plan: profile.plan_selected as "premium" | "unlimited" | "lifetime",
    hasAccess: true,
    hasPremiumAccess: true,
    hasUnlimitedRounds: hasUnlimitedRounds(profile.plan_selected),
    remainingRounds: Infinity,
    status: "active",
    isLifetime: profile.plan_selected === "lifetime",
    currentPeriodEnd:
      profile.plan_selected === "lifetime"
        ? new Date("2099-12-31T23:59:59.000Z")
        : null,
  };
}

// Update getComprehensiveUserAccess similarly
export async function getComprehensiveUserAccess(
  userId: string
): Promise<FeatureAccess> {
  // ... existing code ...

  if (profile.plan_selected === "free") {
    // COUNT rounds from database
    const { count } = await supabase
      .from("round")
      .select("*", { count: "exact", head: true })
      .eq("userId", userId);

    return createFreeTierResponse(count || 0);
  }

  // ... rest of function ...
}
```

**3. Update Round Submission**

File: `server/api/routers/round.ts`

```typescript
// BEFORE (lines 170-180):
const access = await getComprehensiveUserAccess(userId);

if (access.plan === "free" && access.remainingRounds <= 0) {
  throw new TRPCError({
    code: "FORBIDDEN",
    message: `You've reached your free tier limit...`,
  });
}

// ... insert round ...

// REMOVE THESE LINES (402-412):
// if (access.plan === "free") {
//   await db
//     .update(profile)
//     .set({
//       roundsUsed: sql`${profile.roundsUsed} + 1`,
//     })
//     .where(eq(profile.id, userId));
// }

// AFTER (simplified):
const access = await getComprehensiveUserAccess(userId);

// Access check now includes accurate count from getComprehensiveUserAccess
if (access.plan === "free" && access.remainingRounds <= 0) {
  throw new TRPCError({
    code: "FORBIDDEN",
    message: `You've reached your free tier limit of 25 rounds. Please upgrade to continue.`,
  });
}

// ... insert round ...
// No manual increment needed - COUNT handles it automatically!
```

**4. Update Schema**

File: `db/schema.ts`

```typescript
export const profile = pgTable(
  "profile",
  {
    id: uuid().primaryKey().notNull(),
    email: text().notNull(),
    name: text(),
    handicapIndex: decimal<"number">().notNull().default(54),
    verified: boolean().default(false).notNull(),
    initialHandicapIndex: decimal<"number">().notNull().default(54),
    createdAt: timestamp()
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),

    // Billing fields (REMOVED rounds_used)
    planSelected: text("plan_selected").$type<
      "free" | "premium" | "unlimited" | "lifetime" | null
    >(),
    planSelectedAt: timestamp("plan_selected_at"),

    // Subscription tracking
    subscriptionStatus: text("subscription_status")
      .$type<"active" | "trialing" | "past_due" | "canceled" | "paused" | "incomplete" | "incomplete_expired" | "unpaid">()
      .default("active")
      .notNull(),
    currentPeriodEnd: integer("current_period_end"),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false).notNull(),
    billingVersion: integer("billing_version").default(1).notNull(),
  },
  // ... constraints ...
);
```

### **Dependencies**

- `supabase/migrations/` - New migration file
- `utils/billing/access-control.ts` - Update COUNT logic
- `server/api/routers/round.ts` - Remove increment
- `db/schema.ts` - Update schema definition

### **Integration Points**

- tRPC round submission procedure
- Middleware access checks
- UI components showing "rounds remaining"
- Profile page display

## 🔍 **Implementation Notes**

**Migration Safety:**
1. Create migration with `IF EXISTS` clause
2. No data loss (rounds are in round table)
3. Can rollback by adding column back

**Performance Considerations:**
- COUNT query is fast with proper indexes
- Only executed for free users
- Acceptable latency increase (~10-20ms)
- No impact on paid users

**Index Verification:**
```sql
-- Verify index exists for fast COUNT
-- Should already exist from foreign key constraint
SELECT * FROM pg_indexes
WHERE tablename = 'round'
AND indexdef LIKE '%userId%';
```

**Count Caching (Future Enhancement):**
If COUNT becomes slow with many rounds, consider:
- Redis caching with TTL
- Materialized view with trigger updates
- Background job to update cached value

**Current Decision:** Start simple with direct COUNT. Optimize later if needed.

## 📊 **Definition of Done**

- [ ] Migration created and tested locally
- [ ] `rounds_used` column dropped in database
- [ ] Access control uses COUNT for free tier
- [ ] Round submission no longer increments
- [ ] UI shows correct remaining rounds
- [ ] All tests pass
- [ ] No performance regression measured
- [ ] Documentation updated

## 🧪 **Testing Requirements**

### **Database Migration Testing**
- [ ] Run migration on local database
- [ ] Verify column dropped successfully
- [ ] Check no references to rounds_used remain
- [ ] Verify rollback works if needed

### **Functional Testing**
- [ ] Create free account, add 24 rounds → Can add 25th
- [ ] Try to add 26th round → Blocked with correct error
- [ ] Upgrade to paid → Can add unlimited rounds
- [ ] Delete rounds as free user → Count updates correctly
- [ ] Profile page shows correct "X rounds remaining"

### **Performance Testing**
- [ ] Measure COUNT query time (should be <20ms)
- [ ] Test with 100 rounds in database
- [ ] Verify no regression for paid users
- [ ] Check middleware latency

### **Edge Cases**
- [ ] User with 0 rounds (new account)
- [ ] User with exactly 25 rounds
- [ ] User who was paid, downgraded to free
- [ ] Concurrent round submissions (race conditions)

## 🚫 **Out of Scope**

- Adding round count caching (Redis)
- Optimizing COUNT query further
- Changing free tier limit
- Adding round analytics
- Modifying paid user round tracking
- Implementing soft deletes for rounds

## 📝 **Notes**

**Why COUNT is Better:**
1. **Accuracy**: Always correct, can't get out of sync
2. **Simplicity**: No manual increment logic
3. **Maintainability**: One source of truth
4. **Flexibility**: Easy to add filters (e.g., approved rounds only)

**Migration Rollback Plan:**
If needed, restore column:
```sql
ALTER TABLE profile ADD COLUMN rounds_used INTEGER DEFAULT 0;

UPDATE profile
SET rounds_used = (
  SELECT COUNT(*)
  FROM round
  WHERE round."userId" = profile.id
)
WHERE plan_selected = 'free';
```

**Related Discussions:**
- Original implementation: `supabase/migrations/20251011130000_add_plan_tracking_to_profile.sql`
- Comment on line 11: "Tracks number of rounds used by free tier users"

## 🏷️ **Labels**

- `priority: high`
- `type: refactor`
- `component: billing`
- `component: database`
- `technical-debt`
- `performance`
- `data-integrity`
