# 0022 - Implement Database-Level Round Limit Constraint

## 🎯 **Description**

Replace the application-level race condition protection for free tier round limits with a database-level atomic constraint to completely eliminate the possibility of users exceeding the 25-round limit through concurrent requests. The current implementation has a small window for race conditions between pre-check and post-check.

## 📋 **User Story**

As a platform owner, I want free tier users to be unable to exceed 25 rounds under any circumstances so that premium plans remain valuable and resource usage stays predictable.

## 🔧 **Technical Context**

**Current Implementation:**

```typescript:server/api/routers/round.ts
// Lines 172-188 - Pre-check
const access = await getComprehensiveUserAccess(userId);

if (access.plan === "free" && access.remainingRounds <= 0) {
  throw new TRPCError({
    code: "FORBIDDEN",
    message: "You've reached your free tier limit of 25 rounds..."
  });
}

// ... insert round ...

// Lines 247-276 - Post-check (race condition protection)
if (access.plan === "free") {
  const { count } = await ctx.supabase
    .from("round")
    .select("*", { count: "exact", head: true })
    .eq("userId", userId);

  if (count && count > FREE_TIER_ROUND_LIMIT) {
    // Rollback
    await db.delete(round).where(eq(round.id, newRound.id));
    throw new TRPCError({ code: "FORBIDDEN", message: "..." });
  }
}
```

**The Problem:**

```
Request A                    Request B
    |                            |
    ├─ Pre-check: 24 rounds      |
    |  ✅ Can add (24 < 25)      |
    |                            ├─ Pre-check: 24 rounds
    |                            |  ✅ Can add (24 < 25)
    ├─ INSERT round (25th)       |
    |                            ├─ INSERT round (26th) ❌
    ├─ Post-check: 25 rounds     |
    |  ✅ OK (25 ≤ 25)           |
    |                            ├─ Post-check: 26 rounds
    |                            |  ❌ ROLLBACK
```

**Race Condition Window:** Between Request A's INSERT and Request B's pre-check completing, Request B can also insert, briefly allowing 26 rounds.

**Security Assessment Reference:**
- Lines 360-411 (security-assessment.md)
- "Race condition protection exists but imperfect"
- Recommends database-level constraint

**Security Impact:** 🟢 **LOW**
- Very small window (milliseconds)
- Self-correcting (post-check rollback)
- But not theoretically impossible

## ✅ **Acceptance Criteria**

- [ ] Add `rounds_used` column to `profile` table
- [ ] Create database-level CHECK constraint for free tier limit
- [ ] Use atomic transaction for increment + insert
- [ ] Remove application-level post-check (no longer needed)
- [ ] Migration backfills `rounds_used` from actual count
- [ ] Failed increments return proper error without rollback
- [ ] Paid users bypass constraint entirely
- [ ] Manual testing: Concurrent requests cannot exceed limit

## 🚨 **Technical Requirements**

### **Implementation Details**

**1. Database Schema Changes**

```sql
-- supabase/migrations/YYYYMMDDHHMMSS_add_rounds_used_with_constraint.sql

-- Add rounds_used column
ALTER TABLE profile
ADD COLUMN rounds_used INTEGER DEFAULT 0 NOT NULL;

-- Backfill rounds_used from actual round count
UPDATE profile
SET rounds_used = (
  SELECT COUNT(*)
  FROM round
  WHERE round."userId" = profile.id
);

-- Add check constraint (only enforced for free plan)
-- Note: PostgreSQL CHECK constraints can't reference other tables,
-- so we'll enforce this at application level with atomic transaction
-- But we can add a simple constraint to prevent negative values
ALTER TABLE profile
ADD CONSTRAINT rounds_used_non_negative CHECK (rounds_used >= 0);

-- Create index for fast updates
CREATE INDEX idx_profile_rounds_used ON profile(rounds_used) WHERE plan_selected = 'free';

-- Add comment for documentation
COMMENT ON COLUMN profile.rounds_used IS
  'Cached count of rounds created by user. Updated atomically with round creation.';
```

**2. Update Drizzle Schema**

```typescript:db/schema.ts
export const profile = pgTable("profile", {
  id: text("id").primaryKey(),
  // ... existing fields ...
  planSelected: text("plan_selected"),
  roundsUsed: integer("rounds_used").default(0).notNull(),
  // ... rest of fields ...
});
```

**3. Update Round Submission Logic**

```typescript:server/api/routers/round.ts
submitScorecard: authedProcedure
  .input(scorecardSchema)
  .mutation(async ({ ctx, input }) => {
    const { userId } = input;

    // 0. Check user access (plan selected)
    const access = await getComprehensiveUserAccess(userId);

    // 0a. First check: Has user selected a plan?
    if (!access.hasAccess) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Please select a plan to continue...",
      });
    }

    // 0b. ✅ NEW: Atomic increment for free tier users
    if (access.plan === "free") {
      // Use transaction to atomically check limit AND increment
      const incrementResult = await db.transaction(async (tx) => {
        // Lock the profile row and check limit
        const userProfile = await tx
          .select()
          .from(profile)
          .where(eq(profile.id, userId))
          .for('update') // Row-level lock
          .limit(1);

        if (!userProfile[0]) {
          throw new Error("User profile not found");
        }

        const currentCount = userProfile[0].roundsUsed;

        if (currentCount >= FREE_TIER_ROUND_LIMIT) {
          // Already at limit - abort transaction
          throw new TRPCError({
            code: "FORBIDDEN",
            message: `You've reached your free tier limit of ${FREE_TIER_ROUND_LIMIT} rounds. Please upgrade to continue.`,
          });
        }

        // Increment counter (within same transaction)
        await tx
          .update(profile)
          .set({ roundsUsed: sql`${profile.roundsUsed} + 1` })
          .where(eq(profile.id, userId));

        return { success: true };
      });

      if (!incrementResult.success) {
        // Should not reach here, but safety check
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Failed to update round count",
        });
      }
    }

    // ✅ For paid users, skip counter entirely

    console.log("✅ Round limit check passed", {
      plan: access.plan,
      hasAccess: access.hasAccess,
    });

    // 1-4. ... existing round creation logic ...

    // 5. Insert round (AFTER increment success)
    const [newRound] = await db.insert(round).values(roundInsert).returning();

    // ❌ REMOVE: Post-check rollback logic (no longer needed!)
    // The atomic transaction above guarantees correctness

    // If insert fails, transaction rollback will revert increment automatically
    // No manual rollback needed!

    return newRound;
  }),
```

**4. Decrement Counter on Round Deletion (Optional)**

```typescript:server/api/routers/round.ts
deleteRound: authedProcedure
  .input(z.object({ roundId: z.number() }))
  .mutation(async ({ ctx, input }) => {
    const { roundId } = input;
    const userId = ctx.user.id;

    // Get round to verify ownership
    const existingRound = await db
      .select()
      .from(round)
      .where(eq(round.id, roundId))
      .limit(1);

    if (!existingRound[0]) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Round not found" });
    }

    if (existingRound[0].userId !== userId) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Not authorized" });
    }

    // Delete round and decrement counter atomically
    await db.transaction(async (tx) => {
      await tx.delete(round).where(eq(round.id, roundId));

      // Decrement counter for free tier users
      const userProfile = await tx
        .select()
        .from(profile)
        .where(eq(profile.id, userId))
        .limit(1);

      if (userProfile[0]?.planSelected === 'free') {
        await tx
          .update(profile)
          .set({ roundsUsed: sql`GREATEST(0, ${profile.roundsUsed} - 1)` })
          .where(eq(profile.id, userId));
      }
    });

    return { success: true };
  }),
```

**5. Reconciliation Job (Periodic Consistency Check)**

```typescript:app/api/cron/reconcile-round-counts/route.ts
import { NextResponse } from "next/server";
import { db } from "@/db";
import { profile, round } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

/**
 * Reconciliation job to fix any drift in rounds_used counter
 * Run this daily via cron or scheduled task
 */
export async function GET() {
  try {
    // Find profiles where rounds_used doesn't match actual count
    const driftedProfiles = await db.execute(sql`
      SELECT
        p.id,
        p.rounds_used as cached_count,
        COUNT(r.id) as actual_count
      FROM profile p
      LEFT JOIN round r ON r."userId" = p.id
      WHERE p.plan_selected = 'free'
      GROUP BY p.id, p.rounds_used
      HAVING p.rounds_used != COUNT(r.id)
    `);

    let fixedCount = 0;

    for (const profile_row of driftedProfiles.rows) {
      const { id, actual_count } = profile_row as { id: string; actual_count: number };

      await db
        .update(profile)
        .set({ roundsUsed: actual_count })
        .where(eq(profile.id, id));

      fixedCount++;
      console.log(`✅ Reconciled profile ${id}: ${actual_count} rounds`);
    }

    return NextResponse.json({
      success: true,
      checked: driftedProfiles.rows.length,
      fixed: fixedCount,
    });
  } catch (error) {
    console.error("Reconciliation failed:", error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
```

### **Dependencies**

- Database migration to add `rounds_used` column
- Drizzle schema update
- `server/api/routers/round.ts` - Update round creation logic
- Optional: Reconciliation cron job

### **Integration Points**

- Round creation (submitScorecard)
- Round deletion (deleteRound) - optional
- Profile table
- Periodic reconciliation job

## 🔍 **Implementation Notes**

### **Why This Eliminates Race Conditions:**

**Database Transaction with Row Lock:**

```sql
BEGIN;
  SELECT * FROM profile WHERE id = 'user-123' FOR UPDATE; -- Row-level lock
  -- Other requests wait here until lock released
  UPDATE profile SET rounds_used = rounds_used + 1 WHERE id = 'user-123';
  INSERT INTO round (...) VALUES (...);
COMMIT;
-- Lock released
```

**Concurrent Request Behavior:**

```
Request A                              Request B
    |                                      |
    ├─ BEGIN TRANSACTION                   |
    ├─ SELECT ... FOR UPDATE (lock)        |
    |  rounds_used = 24                    |
    |                                      ├─ BEGIN TRANSACTION
    |                                      ├─ SELECT ... FOR UPDATE
    |                                      |  ⏸️ WAITING (blocked by A's lock)
    ├─ CHECK: 24 < 25 ✅                   |
    ├─ UPDATE rounds_used = 25             |
    ├─ INSERT round                        |
    ├─ COMMIT (releases lock)              |
    |                                      ├─ 🔓 Lock acquired
    |                                      ├─ rounds_used = 25
    |                                      ├─ CHECK: 25 < 25 ❌
    |                                      ├─ ROLLBACK (throws error)
    |                                      └─ User gets error ✅
```

**No Race Condition Possible:** Database enforces serialization via row locks.

### **Performance Considerations:**

- Row-level lock is fast (microseconds) if no contention
- Only blocks concurrent requests for SAME user
- Free tier users typically don't submit rounds concurrently
- Paid users skip this entirely (no locking)

### **Edge Cases:**

1. **Transaction Rollback:**
   - If INSERT fails, transaction rolls back automatically
   - Counter decrement happens automatically
   - No manual cleanup needed

2. **Counter Drift:**
   - Can happen if rounds deleted manually in database
   - Reconciliation job fixes drift daily
   - Not critical (always reconciled before next submission)

3. **Paid Users:**
   - Skip counter entirely (no performance impact)
   - Can create unlimited rounds

## 📊 **Definition of Done**

- [ ] Database migration created and applied
- [ ] `rounds_used` column added to profile table
- [ ] Drizzle schema updated
- [ ] Round creation uses atomic transaction
- [ ] Post-check rollback logic removed
- [ ] Reconciliation job implemented (optional)
- [ ] Manual testing: Concurrent requests cannot exceed limit
- [ ] Load testing: 10 concurrent requests at limit boundary
- [ ] Verify paid users unaffected

## 🧪 **Testing Requirements**

### **Concurrency Test:**

```typescript
test('should prevent race condition with concurrent requests', async () => {
  // Setup user with 24 rounds
  await db.insert(profile).values({
    id: 'user-123',
    planSelected: 'free',
    roundsUsed: 24,
  });

  // Create 10 concurrent requests
  const requests = Array(10).fill(null).map(() =>
    submitScorecard({
      userId: 'user-123',
      // ... scorecard data ...
    })
  );

  // Only 1 should succeed, 9 should fail
  const results = await Promise.allSettled(requests);

  const successes = results.filter(r => r.status === 'fulfilled');
  const failures = results.filter(r => r.status === 'rejected');

  expect(successes.length).toBe(1); // Exactly 1 succeeds (25th round)
  expect(failures.length).toBe(9);  // 9 fail at limit

  // Verify final count is exactly 25
  const user = await db.select().from(profile).where(eq(profile.id, 'user-123'));
  expect(user[0].roundsUsed).toBe(25);

  const actualRounds = await db.select().from(round).where(eq(round.userId, 'user-123'));
  expect(actualRounds.length).toBe(25); // Exactly 25 rounds in database
});
```

### **Manual Testing:**

```bash
# Create script to send concurrent requests
for i in {1..10}; do
  curl -X POST http://localhost:3000/api/trpc/round.submitScorecard \
    -H "Content-Type: application/json" \
    -d '{"userId":"test-user","..."}' &
done
wait

# Check database
psql $DATABASE_URL -c "SELECT rounds_used FROM profile WHERE id = 'test-user';"
psql $DATABASE_URL -c "SELECT COUNT(*) FROM round WHERE \"userId\" = 'test-user';"

# Both should match and be ≤ 25
```

## 🚫 **Out of Scope**

- Throttling/rate limiting (separate concern)
- Round quota reset mechanism (monthly limits)
- Counter for paid users (unnecessary overhead)
- Real-time counter updates in UI
- Historical tracking of counter changes

## 📝 **Notes**

**Why This is Better Than Application-Level Checks:**

| Approach | Race Condition? | Rollback Needed? | Complexity |
|----------|----------------|------------------|------------|
| Current (pre + post check) | Tiny window | Yes (manual) | High |
| Database transaction | Impossible | Automatic | Medium |
| Database CHECK constraint | Impossible | N/A | Low (but can't check dynamically) |

**Why Not Database CHECK Constraint?**

PostgreSQL CHECK constraints can't reference:
- Other tables (can't count rounds)
- Dynamic values (can't check based on plan)

So we use **atomic transaction with row lock** instead.

**PostgreSQL Isolation Levels:**

Drizzle/Postgres uses `READ COMMITTED` by default:
- Row-level locks prevent concurrent updates
- `FOR UPDATE` ensures serialization
- Transaction guarantees atomicity

**Related Tickets:**
- None directly, but complements Ticket #0013 (plan enforcement)

## 🏷️ **Labels**

- `priority: medium`
- `type: enhancement`
- `component: billing`
- `component: database`
- `race-condition`
- `data-integrity`
- `free-tier`
