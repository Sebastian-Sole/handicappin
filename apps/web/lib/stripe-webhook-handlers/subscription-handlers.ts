import Stripe from "stripe";
import { db } from "@/db";
import { profile } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { mapPriceToPlan } from "@/lib/stripe";
import { planRank, type PlanType } from "@handicappin/billing-core";
import {
  logWebhookSuccess,
  logWebhookError,
  logWebhookDebug,
  logWebhookInfo,
  logWebhookWarning,
} from "@/lib/webhook-logger";
import { verifyCustomerOwnership } from "@/lib/stripe-security";
import { verifyPaymentAmount, formatAmount } from "@/utils/billing/pricing";
import { logger } from "@/lib/logging";
import {
  sendSubscriptionUpgradedEmail,
  sendSubscriptionDowngradedEmail,
  sendSubscriptionCancelledEmail,
} from "@/lib/email-service";
import type { BillingFact } from "@/utils/billing/apply-billing-event";
import {
  guardedStripeProfileWrite,
  readBillingProjection,
} from "./profile-billing-write";
import type { WebhookContext, WebhookResult } from "./types";
import { getPostHogClient } from "@/lib/posthog";
import { ANALYTICS_EVENTS } from "@handicappin/analytics";

/**
 * Classification of a subscription webhook event into (at most) one
 * lifecycle email. Pure — no I/O — so it's unit-testable without mocking
 * the database or Stripe. Reuses `planRank` (the same plan-ranking helper
 * `updateSubscription`'s changeType relies on in apps/web/lib/stripe.ts) so
 * there is exactly one plan hierarchy in the codebase.
 */
export type SubscriptionEmailClassification =
  | { kind: "upgrade"; oldPlan: PlanType; newPlan: PlanType }
  | { kind: "downgrade"; oldPlan: PlanType; newPlan: PlanType }
  | { kind: "cancelled"; plan: PlanType }
  | { kind: "none" };

export function classifySubscriptionChangeEmail(params: {
  priorPlan: PlanType | null;
  priorCancelAtPeriodEnd: boolean;
  newPlan: PlanType;
  newCancelAtPeriodEnd: boolean;
}): SubscriptionEmailClassification {
  const { priorPlan, priorCancelAtPeriodEnd, newPlan, newCancelAtPeriodEnd } =
    params;

  if (priorPlan && priorPlan !== newPlan) {
    const rankDelta = planRank(newPlan) - planRank(priorPlan);
    if (rankDelta > 0) {
      return { kind: "upgrade", oldPlan: priorPlan, newPlan };
    }
    if (rankDelta < 0) {
      return { kind: "downgrade", oldPlan: priorPlan, newPlan };
    }
  }

  if (!priorCancelAtPeriodEnd && newCancelAtPeriodEnd) {
    return { kind: "cancelled", plan: newPlan };
  }

  return { kind: "none" };
}

/**
 * Handle subscription changes - update plan_selected
 */
export async function handleSubscriptionChange(
  ctx: WebhookContext,
): Promise<WebhookResult> {
  const subscription = ctx.event.data.object as Stripe.Subscription;
  const userId = subscription.metadata?.supabase_user_id;
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer?.id;

  if (!userId) {
    // Subscription from another application (e.g., Clerk) - skip gracefully
    logWebhookInfo(
      `Skipping subscription ${subscription.id} - no supabase_user_id in metadata (likely from another application)`,
    );
    return { success: true, message: "Skipped - no supabase_user_id" };
  }

  if (!customerId) {
    throw new Error(`Missing customer ID in subscription ${subscription.id}`);
  }

  // Verify customer belongs to this user
  const ownership = await verifyCustomerOwnership(customerId, userId);

  if (!ownership.valid) {
    logWebhookError(
      "Customer-User correlation check failed - NOT updating plan",
      {
        handler: "handleSubscriptionChange",
        claimedUserId: userId,
        actualUserId: ownership.actualUserId,
        stripeCustomerId: customerId,
        subscriptionId: subscription.id,
        severity: "HIGH",
      },
    );
    throw new Error(
      `Customer-User mismatch for subscription ${subscription.id}`,
    );
  }

  logWebhookDebug("Customer-User correlation verified", {
    userId,
    customerId,
  });

  const priceId = subscription.items.data[0]?.price.id;
  if (!priceId) {
    throw new Error(
      `No price ID in subscription ${subscription.id} for user ${userId}`,
    );
  }

  const plan = mapPriceToPlan(priceId);
  if (!plan) {
    throw new Error(
      `Unknown price ID ${priceId} in subscription ${subscription.id} for user ${userId}`,
    );
  }

  // Verify subscription amount
  const price = subscription.items.data[0]?.price;
  if (!price) {
    throw new Error(
      `No price object in subscription ${subscription.id} for user ${userId}`,
    );
  }

  const amount = price.unit_amount || 0;
  const currency = price.currency || "usd";

  const verification = verifyPaymentAmount(
    plan,
    currency,
    amount,
    true, // subscription is recurring
  );

  if (!verification.valid) {
    logWebhookError(
      "CRITICAL: Subscription amount verification failed - NOT updating plan",
      {
        handler: "handleSubscriptionChange",
        plan,
        expected: formatAmount(verification.expected),
        actual: formatAmount(verification.actual),
        variance: verification.variance,
        currency: verification.currency,
        subscriptionId: subscription.id,
        userId,
        priceId,
        severity: "HIGH",
        action: "Check environment variables and Stripe price configuration",
      },
    );
    throw new Error(
      `Amount verification failed for subscription ${subscription.id}`,
    );
  }

  logWebhookSuccess("Subscription amount verification passed", {
    plan,
    amount: formatAmount(verification.actual),
    currency: verification.currency,
  });

  // Log subscription details BEFORE condition check
  logger.debug("[Webhook] Subscription change details", {
    subscriptionId: subscription.id,
    userId,
    status: subscription.status,
    cancel_at_period_end: subscription.cancel_at_period_end,
    cancel_at: subscription.cancel_at,
    isCancelling: subscription.cancel_at_period_end || !!subscription.cancel_at,
    currentPeriodEnd: subscription.items.data[0]?.current_period_end,
    plan,
  });

  // Only update if subscription is active
  if (subscription.status === "active" || subscription.status === "trialing") {
    try {
      logWebhookDebug("Subscription update details", {
        userId,
        plan,
        status: subscription.status,
        currentPeriodEnd: subscription.items.data[0]?.current_period_end,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      });

      logger.debug("Processing subscription update", {
        subscriptionId: subscription.id,
        userId,
        status: subscription.status,
        priceId: subscription.items.data[0]?.price.id,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        cancelAt: subscription.cancel_at,
      });

      // Check if subscription is set to cancel
      const isCancelling =
        subscription.cancel_at_period_end || !!subscription.cancel_at;

      const updateData = {
        planSelected: plan,
        planSelectedAt: new Date(),
        subscriptionStatus: subscription.status,
        currentPeriodEnd: subscription.items.data[0]?.current_period_end,
        cancelAtPeriodEnd: isCancelling,
        billingProvider: "stripe" as const,
        billingVersion: sql`billing_version + 1`,
      };

      logger.debug("[Webhook] About to update profile with", {
        userId,
        cancelAtPeriodEnd_DB_Value: isCancelling,
        stripe_cancel_at_period_end: subscription.cancel_at_period_end,
        stripe_cancel_at: subscription.cancel_at,
        updateData: {
          ...updateData,
          billingVersion: "incremented",
        },
      });

      // Pre-write projection — the classification input for the lifecycle
      // email below (mirrors invoice-handlers.ts's own explicit prior read;
      // guardedStripeProfileWrite reads it again internally for the guard).
      const priorProjection = await readBillingProjection(userId);

      // Precedence guards (D-precedence): never overwrite lifetime, never
      // clobber an apple-active contract. Stripe stays unordered (no cursor).
      const fact: BillingFact = {
        provider: "stripe",
        plan,
        status: subscription.status === "trialing" ? "trialing" : "active",
        currentPeriodEnd:
          subscription.items.data[0]?.current_period_end ?? null,
        cancelAtPeriodEnd: isCancelling,
        eventTimeMs: ctx.event.created * 1000,
        eventId: ctx.eventId,
      };

      const { written } = await guardedStripeProfileWrite({
        userId,
        handler: "handleSubscriptionChange",
        fact,
        write: async () => {
          const result = await db
            .update(profile)
            .set(updateData)
            .where(eq(profile.id, userId));
          logger.debug("[Webhook] Database update result", { result });
        },
      });

      if (!written) {
        logWebhookInfo(
          `Subscription change for user ${userId} not written (precedence guard)`,
        );
        return { success: true, message: "Blocked by precedence guard" };
      }

      // Verify the update actually happened
      const verifyProfile = await db
        .select({
          cancelAtPeriodEnd: profile.cancelAtPeriodEnd,
          subscriptionStatus: profile.subscriptionStatus,
          currentPeriodEnd: profile.currentPeriodEnd,
        })
        .from(profile)
        .where(eq(profile.id, userId))
        .limit(1);

      logger.debug("[Webhook] Verified database state after update", {
        userId,
        dbState: verifyProfile[0],
      });

      logWebhookSuccess(
        `Updated plan_selected to '${plan}' for user: ${userId} (status: ${subscription.status}, cancel_at_period_end: ${subscription.cancel_at_period_end}, cancel_at: ${subscription.cancel_at}, isCancelling: ${isCancelling})`,
      );

      // Lifecycle email — webhook is the single source of truth for
      // upgrade/downgrade/cancel notifications (portal changes and Stripe-
      // side changes land here too, not just the in-app mutation). Guarded
      // against no-op events (renewal, metadata) by the classifier itself.
      const classification = classifySubscriptionChangeEmail({
        priorPlan: priorProjection?.plan ?? null,
        priorCancelAtPeriodEnd: priorProjection?.cancelAtPeriodEnd ?? false,
        newPlan: plan,
        newCancelAtPeriodEnd: isCancelling,
      });

      const periodEndSeconds = subscription.items.data[0]?.current_period_end;
      const dateForEmail = periodEndSeconds
        ? new Date(periodEndSeconds * 1000)
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      await sendSubscriptionChangeEmailSafely({
        userId,
        classification,
        dateForEmail,
      });

      if (classification.kind === "cancelled") {
        const posthog = getPostHogClient();
        posthog.capture({
          distinctId: userId,
          event: ANALYTICS_EVENTS.SUBSCRIPTION_CANCELLED,
          properties: {
            plan: classification.plan,
            billing_provider: "stripe",
            cancel_at_period_end: isCancelling,
          },
        });
        await posthog.flush();
      }
    } catch (error) {
      logWebhookError("Error updating plan", error);
      throw error;
    }
  } else {
    logger.warn(
      "[Webhook] Skipping database update - subscription status not active/trialing",
      {
        subscriptionId: subscription.id,
        userId,
        status: subscription.status,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      },
    );
  }

  return { success: true };
}

/**
 * Handle subscription deletion - revert to free tier
 */
export async function handleSubscriptionDeleted(
  ctx: WebhookContext,
): Promise<WebhookResult> {
  const subscription = ctx.event.data.object as Stripe.Subscription;
  const userId = subscription.metadata?.supabase_user_id;
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer?.id;

  if (!userId) {
    // Subscription from another application (e.g., Clerk) - skip gracefully
    logWebhookInfo(
      `Skipping deleted subscription ${subscription.id} - no supabase_user_id in metadata (likely from another application)`,
    );
    return { success: true, message: "Skipped - no supabase_user_id" };
  }

  if (!customerId) {
    throw new Error(
      `Missing customer ID in deleted subscription ${subscription.id}`,
    );
  }

  // Verify customer belongs to this user
  const ownership = await verifyCustomerOwnership(customerId, userId);

  if (!ownership.valid) {
    logWebhookError(
      "Customer-User correlation check failed - NOT reverting plan",
      {
        handler: "handleSubscriptionDeleted",
        claimedUserId: userId,
        actualUserId: ownership.actualUserId,
        stripeCustomerId: customerId,
        severity: "HIGH",
      },
    );
    throw new Error(
      `Customer-User mismatch in subscription deletion ${subscription.id}`,
    );
  }

  // Revert to free tier — guarded: a dying stripe subscription must never
  // strip a lifetime entitlement or an apple-billed contract.
  try {
    // Pre-write projection — tells us whether the user actually had a paid
    // plan to lose (a plan-less/free profile getting this fact is a no-op,
    // not a "cancellation" worth emailing about).
    const priorProjection = await readBillingProjection(userId);

    const fact: BillingFact = {
      provider: "stripe",
      plan: "free",
      status: "canceled",
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      eventTimeMs: ctx.event.created * 1000,
      eventId: ctx.eventId,
    };

    const { written } = await guardedStripeProfileWrite({
      userId,
      handler: "handleSubscriptionDeleted",
      fact,
      write: async () => {
        await db
          .update(profile)
          .set({
            planSelected: "free",
            planSelectedAt: new Date(),
            subscriptionStatus: "canceled",
            currentPeriodEnd: null,
            cancelAtPeriodEnd: false,
            billingProvider: null,
            billingVersion: sql`billing_version + 1`,
          })
          .where(eq(profile.id, userId));
      },
    });

    if (written) {
      logWebhookSuccess(`Reverted to free tier for user: ${userId}`);
      logger.debug(
        `[Webhook] Billing version incremented for user ${userId} - BillingSync should detect within seconds`,
      );

      // Only email when the prior contract was an ACTIVE paid plan that was
      // NOT already scheduled to cancel:
      // - an already-free/plan-less profile has nothing to notify about;
      // - a past_due contract dying after failed dunning was already told
      //   by the final-attempt payment-failed email;
      // - a cancel-at-period-end contract was already notified at cancel
      //   time (the classifier's false->true transition) — its deletion at
      //   term end is the expected conclusion, not news.
      // What remains is a genuinely immediate deletion (e.g. a Stripe-
      // dashboard hard-cancel of an active subscription).
      const priorPlan = priorProjection?.plan ?? null;
      const priorWasActive =
        priorProjection?.status === "active" ||
        priorProjection?.status === "trialing";
      const priorWasAlreadyCancelling =
        priorProjection?.cancelAtPeriodEnd === true;
      if (
        priorPlan &&
        planRank(priorPlan) > 0 &&
        priorWasActive &&
        !priorWasAlreadyCancelling
      ) {
        await sendSubscriptionChangeEmailSafely({
          userId,
          classification: { kind: "cancelled", plan: priorPlan },
          dateForEmail: new Date(), // immediate — the subscription is gone now
        });
      }

      const posthog = getPostHogClient();
      posthog.capture({
        distinctId: userId,
        event: ANALYTICS_EVENTS.SUBSCRIPTION_CANCELLED,
        properties: {
          plan: priorProjection?.plan ?? "unknown",
          billing_provider: "stripe",
          cancel_at_period_end: false,
        },
      });
      await posthog.flush();
    } else {
      logWebhookInfo(
        `Subscription deletion for user ${userId} did not revert plan (precedence guard)`,
      );
    }
  } catch (error) {
    logWebhookError("Error reverting user to free tier", error);
    throw error;
  }

  return { success: true };
}

async function resolveUserEmail(userId: string): Promise<string | null> {
  const rows = await db
    .select({ email: profile.email })
    .from(profile)
    .where(eq(profile.id, userId))
    .limit(1);
  return rows[0]?.email ?? null;
}

function getBillingUrl(): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://handicappin.com";
  return `${appUrl.replace(/\/$/, "")}/billing`;
}

/**
 * Send the classified lifecycle email without letting a send failure fail
 * the webhook — same try/catch shape as checkout-handlers.ts's
 * sendWelcomeEmailSafely. No-op classifications short-circuit before any
 * I/O so frequent no-op subscription.updated events (renewal, metadata)
 * never touch the database or Resend.
 */
async function sendSubscriptionChangeEmailSafely(params: {
  userId: string;
  classification: SubscriptionEmailClassification;
  dateForEmail: Date;
}): Promise<void> {
  const { userId, classification, dateForEmail } = params;
  if (classification.kind === "none") return;

  try {
    const userEmail = await resolveUserEmail(userId);
    if (!userEmail) {
      logWebhookWarning(
        `No email found for user ${userId} - skipping subscription ${classification.kind} email`,
      );
      return;
    }

    const billingUrl = getBillingUrl();
    let emailResult: { success: boolean; error?: string };

    if (classification.kind === "upgrade") {
      emailResult = await sendSubscriptionUpgradedEmail({
        to: userEmail,
        oldPlan: classification.oldPlan,
        newPlan: classification.newPlan,
        // Webhook context carries no invoice/proration amount; the template
        // hides the prorated-charge box entirely when this is 0.
        proratedCharge: 0,
        currency: "usd",
        billingUrl,
      });
    } else if (classification.kind === "downgrade") {
      emailResult = await sendSubscriptionDowngradedEmail({
        to: userEmail,
        oldPlan: classification.oldPlan,
        newPlan: classification.newPlan,
        effectiveDate: dateForEmail,
        billingUrl,
      });
    } else {
      emailResult = await sendSubscriptionCancelledEmail({
        to: userEmail,
        plan: classification.plan,
        endDate: dateForEmail,
        billingUrl,
      });
    }

    if (!emailResult.success) {
      logWebhookWarning(
        `Subscription ${classification.kind} email failed for user ${userId}, but processing continues`,
        { error: emailResult.error },
      );
    }
  } catch (emailError) {
    // Log but don't throw - email failure shouldn't break webhook
    logWebhookError(
      `Error sending subscription ${classification.kind} email for user ${userId} (webhook processing continues)`,
      emailError,
    );
  }
}
