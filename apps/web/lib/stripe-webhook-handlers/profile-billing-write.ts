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
import { unlockQuarantinedRoundsOnUpgrade } from "@/utils/billing/unlock-quarantined-rounds";

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
    // A BLOCKED write still runs the unlock. The projection is untouched,
    // but the ROUND state may not have converged with it yet: if an earlier
    // delivery committed the profile and then died before finishing the
    // unlock, every redelivery lands HERE (lifetime is absorbing, so it is
    // decided `lifetime-locked` → ignore, never `apply`) and this is the only
    // remaining place that can finish the job. The helper tests the RESULTING
    // projection, so a blocked decision on a still-free account unlocks
    // nothing, and one on an already-unlocked account matches zero rows.
    await unlockQuarantinedRoundsOnUpgrade({
      userId: params.userId,
      decision: verdict.decision,
      handler: params.handler,
    });
    return { written: false, verdict };
  }

  await params.write();

  // Contract 005 §5: an upgrade unlocks the account's quarantined rounds
  // automatically. The helper self-guards on the resulting projection being
  // paid, so this site does not repeat the paid-plan test; the resulting
  // round UPDATE is what enqueues the handicap recomputation (via
  // trigger_handicap_recalculation) rather than computing it in the webhook.
  await unlockQuarantinedRoundsOnUpgrade({
    userId: params.userId,
    decision: verdict.decision,
    handler: params.handler,
  });

  return { written: true, verdict };
}
