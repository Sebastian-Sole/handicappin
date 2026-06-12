/**
 * Guarded profile billing writes for the STRIPE webhook handlers
 * (handoff DoD #4): every final write is arbitrated by the same
 * applyBillingEvent chokepoint the RevenueCat webhook uses, so Stripe can
 * never overwrite a lifetime entitlement and never clobber an apple-active
 * contract. Handlers keep their existing (sometimes partial) update
 * payloads — the chokepoint decides WHETHER the write may happen, the
 * handler still decides WHAT it writes, plus the billing_provider stamp.
 *
 * Stripe ordering semantics are deliberately unchanged: `lastApplied` is
 * passed as null (no out-of-order enforcement), exactly as before this
 * module existed.
 */
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { profile } from "@/db/schema";
import { sendDoubleContractAlert } from "@/lib/admin-alerts";
import { logWebhookInfo, logWebhookWarning } from "@/lib/webhook-logger";
import {
  applyBillingEvent,
  type ApplyDecision,
  type BillingFact,
  type BillingProjection,
} from "@/utils/billing/apply-billing-event";

export type StripeWriteVerdict =
  | { allowed: true; decision: ApplyDecision }
  | { allowed: false; decision: ApplyDecision; blockedBy: string };

/**
 * Pure arbitration: may this stripe fact write over the current projection?
 * (Separated from I/O so the guard matrix is unit-testable.)
 */
export function decideStripeProfileWrite(
  projection: BillingProjection,
  fact: BillingFact,
): StripeWriteVerdict {
  const decision = applyBillingEvent(
    { projection, lastApplied: null },
    fact,
  );
  if (decision.action === "apply") {
    return { allowed: true, decision };
  }
  return { allowed: false, decision, blockedBy: decision.reason };
}

export async function readBillingProjection(
  userId: string,
): Promise<BillingProjection | null> {
  const rows = await db
    .select({
      planSelected: profile.planSelected,
      subscriptionStatus: profile.subscriptionStatus,
      currentPeriodEnd: profile.currentPeriodEnd,
      cancelAtPeriodEnd: profile.cancelAtPeriodEnd,
      billingProvider: profile.billingProvider,
    })
    .from(profile)
    .where(eq(profile.id, userId))
    .limit(1);
  if (rows.length === 0) return null;
  return {
    provider: rows[0].billingProvider,
    plan: rows[0].planSelected,
    status: rows[0].subscriptionStatus,
    currentPeriodEnd: rows[0].currentPeriodEnd,
    cancelAtPeriodEnd: rows[0].cancelAtPeriodEnd,
  };
}

/**
 * Run the handler's profile update iff the precedence guards allow the
 * stripe fact. Returns whether the write happened. On a blocked
 * double-contract the admin alert fires here (kept provider = current).
 */
export async function guardedStripeProfileWrite(params: {
  userId: string;
  handler: string;
  fact: BillingFact;
  /** The handler's existing update payload (already includes the provider stamp). */
  write: () => Promise<void>;
}): Promise<{ written: boolean; verdict: StripeWriteVerdict | null }> {
  const projection = await readBillingProjection(params.userId);
  if (projection === null) {
    logWebhookWarning(
      `[${params.handler}] No profile for user ${params.userId} - skipping billing write`,
    );
    return { written: false, verdict: null };
  }

  const verdict = decideStripeProfileWrite(projection, params.fact);

  if (verdict.decision.alert) {
    await sendDoubleContractAlert(params.userId, verdict.decision.alert);
  }

  if (!verdict.allowed) {
    logWebhookInfo(
      `[${params.handler}] Stripe write BLOCKED by precedence guard (${verdict.blockedBy}) for user ${params.userId}: ` +
        `current=${projection.provider}/${projection.plan}/${projection.status} incoming=${params.fact.plan}/${params.fact.status}`,
    );
    return { written: false, verdict };
  }

  await params.write();
  return { written: true, verdict };
}
