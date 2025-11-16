import { stripe, mapPriceToPlan } from "@/lib/stripe";
import { db } from "@/db";
import { profile, stripeCustomers } from "@/db/schema";
import { eq, sql, inArray } from "drizzle-orm";

type ReconciliationResult = {
  checked: number;
  drift_detected: number;
  auto_fixed: number;
  manual_review: number;
  errors: number;
  issues: DriftIssue[];
  duration_ms: number;
};

type DriftIssue = {
  userId: string;
  field: string;
  database_value: any;
  stripe_value: any;
  severity: "low" | "medium" | "high";
  action: "auto_fixed" | "manual_review" | "error";
  error?: string;
};

/**
 * Main reconciliation function - verifies all paid users' billing data matches Stripe
 */
export async function reconcileStripeSubscriptions(): Promise<ReconciliationResult> {
  const startTime = Date.now();

  const result: ReconciliationResult = {
    checked: 0,
    drift_detected: 0,
    auto_fixed: 0,
    manual_review: 0,
    errors: 0,
    issues: [],
    duration_ms: 0,
  };

  console.log("🔄 Starting Stripe reconciliation...");

  // Get all users with paid plans (exclude free and null)
  const paidUsers = await db
    .select({
      id: profile.id,
      planSelected: profile.planSelected,
      subscriptionStatus: profile.subscriptionStatus,
      currentPeriodEnd: profile.currentPeriodEnd,
      cancelAtPeriodEnd: profile.cancelAtPeriodEnd,
    })
    .from(profile)
    .where(inArray(profile.planSelected, ["premium", "unlimited", "lifetime"]));

  console.log(`📊 Found ${paidUsers.length} users with paid plans`);

  for (const user of paidUsers) {
    result.checked++;

    try {
      const issue = await reconcileUser(user);

      if (issue) {
        result.drift_detected++;
        result.issues.push(issue);

        if (issue.action === "auto_fixed") {
          result.auto_fixed++;
        } else if (issue.action === "manual_review") {
          result.manual_review++;
        }
      }
    } catch (error) {
      result.errors++;
      console.error(`❌ Error reconciling user ${user.id}:`, error);

      result.issues.push({
        userId: user.id,
        field: "reconciliation",
        database_value: user.planSelected,
        stripe_value: "error",
        severity: "high",
        action: "error",
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Rate limiting: 100 requests/second to Stripe
    // Sleep 10ms between users = ~100 req/sec
    await sleep(10);
  }

  result.duration_ms = Date.now() - startTime;

  console.log("✅ Reconciliation complete:", {
    checked: result.checked,
    drift_detected: result.drift_detected,
    auto_fixed: result.auto_fixed,
    manual_review: result.manual_review,
    errors: result.errors,
    duration_seconds: (result.duration_ms / 1000).toFixed(2),
  });

  // Send alert if critical drift detected
  if (result.manual_review > 0) {
    sendReconciliationAlert(result);
  }

  return result;
}

/**
 * Reconcile a single user's billing data
 */
async function reconcileUser(user: {
  id: string;
  planSelected: string | null;
  subscriptionStatus: string | null;
  currentPeriodEnd: number | null;
  cancelAtPeriodEnd: boolean;
}): Promise<DriftIssue | null> {
  // Get user's Stripe customer ID
  const customerRecord = await db
    .select()
    .from(stripeCustomers)
    .where(eq(stripeCustomers.userId, user.id))
    .limit(1);

  if (!customerRecord[0]) {
    // No Stripe customer - this is okay for lifetime users who paid once
    if (user.planSelected === "lifetime") {
      // Lifetime users might not have ongoing customer relationship
      // TODO: Verify lifetime payment exists in Stripe charges (future enhancement)
      return null;
    }

    // Premium/unlimited without customer is drift
    return {
      userId: user.id,
      field: "stripe_customer_id",
      database_value: null,
      stripe_value: "missing",
      severity: "high",
      action: "manual_review",
    };
  }

  const stripeCustomerId = customerRecord[0].stripeCustomerId;

  // For subscription plans, check active subscriptions
  if (user.planSelected === "premium" || user.planSelected === "unlimited") {
    return await reconcileSubscription(user, stripeCustomerId);
  }

  // For lifetime plans, we trust webhook handling
  // (Verifying lifetime payments requires scanning all charges - expensive)
  if (user.planSelected === "lifetime") {
    return null;
  }

  return null;
}

/**
 * Reconcile subscription plan
 */
async function reconcileSubscription(
  user: {
    id: string;
    planSelected: string | null;
    subscriptionStatus: string | null;
    currentPeriodEnd: number | null;
    cancelAtPeriodEnd: boolean;
  },
  stripeCustomerId: string
): Promise<DriftIssue | null> {
  // Get active subscriptions from Stripe (one API call gets all)
  const subscriptions = await stripe.subscriptions.list({
    customer: stripeCustomerId,
    status: "all", // Include canceled, past_due, etc.
    limit: 10,
  });

  const activeSubscription: any = subscriptions.data.find(
    (s) => s.status === "active" || s.status === "trialing"
  );

  // Case 1: Database says active, Stripe says no subscription
  if (!activeSubscription && user.subscriptionStatus === "active") {
    console.warn(
      `⚠️ Drift detected: User ${user.id} has active status but no Stripe subscription`
    );

    // Auto-fix: Revert to free tier
    await db
      .update(profile)
      .set({
        planSelected: "free",
        planSelectedAt: new Date(),
        subscriptionStatus: "canceled",
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        billingVersion: sql`billing_version + 1`,
      })
      .where(eq(profile.id, user.id));

    return {
      userId: user.id,
      field: "subscription_status",
      database_value: "active",
      stripe_value: "none",
      severity: "high",
      action: "auto_fixed",
    };
  }

  // Case 2: Database says canceled/null, Stripe says active
  if (activeSubscription && user.subscriptionStatus !== "active") {
    console.warn(
      `⚠️ Drift detected: User ${user.id} not active in DB but active in Stripe`
    );

    // Auto-fix: Restore active status
    const priceId = activeSubscription.items.data[0]?.price.id;
    const plan = mapPriceToPlan(priceId);

    if (plan) {
      await db
        .update(profile)
        .set({
          planSelected: plan,
          planSelectedAt: new Date(),
          subscriptionStatus: activeSubscription.status,
          currentPeriodEnd: activeSubscription.current_period_end as number,
          cancelAtPeriodEnd: activeSubscription.cancel_at_period_end || false,
          billingVersion: sql`billing_version + 1`,
        })
        .where(eq(profile.id, user.id));

      return {
        userId: user.id,
        field: "subscription_status",
        database_value: user.subscriptionStatus,
        stripe_value: "active",
        severity: "high",
        action: "auto_fixed",
      };
    }
  }

  // Case 3: Status mismatch (past_due, paused, etc.)
  if (
    activeSubscription &&
    activeSubscription.status !== user.subscriptionStatus
  ) {
    console.warn(
      `⚠️ Drift detected: Status mismatch for user ${user.id} (DB: ${user.subscriptionStatus}, Stripe: ${activeSubscription.status})`
    );

    // Auto-fix: Update status to match Stripe
    await db
      .update(profile)
      .set({
        subscriptionStatus: activeSubscription.status,
        billingVersion: sql`billing_version + 1`,
      })
      .where(eq(profile.id, user.id));

    return {
      userId: user.id,
      field: "subscription_status",
      database_value: user.subscriptionStatus,
      stripe_value: activeSubscription.status,
      severity: "medium",
      action: "auto_fixed",
    };
  }

  // No drift detected
  return null;
}

/**
 * Send alert for critical drift requiring manual review
 */
function sendReconciliationAlert(result: ReconciliationResult) {
  const criticalIssues = result.issues.filter(
    (i) => i.action === "manual_review"
  );

  console.error("🚨 CRITICAL: Billing drift requires manual review", {
    total_drift: result.drift_detected,
    auto_fixed: result.auto_fixed,
    manual_review: result.manual_review,
    errors: result.errors,
    critical_issues: criticalIssues, // UUIDs logged directly (server-side, secure environment)
  });

  // TODO: Send email to admin (separate enhancement)
  // TODO: Post to Slack/Discord (separate enhancement)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
