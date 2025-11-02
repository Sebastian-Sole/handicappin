import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { profile, stripeCustomers, webhookEvents, pendingLifetimePurchases } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { stripe, mapPriceToPlan } from "@/lib/stripe";
import {
  logWebhookReceived,
  logWebhookSuccess,
  logWebhookError,
  logWebhookWarning,
  logWebhookDebug,
  logWebhookInfo,
  logPaymentEvent,
  logSubscriptionEvent,
} from "@/lib/webhook-logger";
import { verifyCustomerOwnership } from "@/lib/stripe-security";
import { verifyPaymentAmount, formatAmount } from '@/utils/billing/pricing';

export async function POST(request: NextRequest) {
  let event: any = null; // Declare in outer scope for failure recording

  try {
    const body = await request.text();
    const signature = request.headers.get("stripe-signature");

    if (!signature) {
      return NextResponse.json(
        { error: "No signature provided" },
        { status: 400 }
      );
    }

    // Verify webhook signature
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );

    logWebhookReceived(event.type);

    // Check for duplicate event
    const existingEvent = await db
      .select()
      .from(webhookEvents)
      .where(eq(webhookEvents.eventId, event.id))
      .limit(1);

    if (existingEvent.length > 0) {
      logWebhookInfo(
        `Duplicate event ${event.id} (${event.type}) - already processed at ${existingEvent[0].processedAt}`
      );
      return NextResponse.json(
        {
          received: true,
          duplicate: true,
          originalProcessedAt: existingEvent[0].processedAt,
        },
        { status: 200 }
      );
    }

    // Handle different event types
    switch (event.type) {
      case "customer.created":
        await handleCustomerCreated(event.data.object);
        break;

      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object);
        break;

      case "payment_intent.succeeded":
        await handlePaymentIntentSucceeded(event.data.object);
        break;

      case "payment_intent.payment_failed":
        await handlePaymentIntentFailed(event.data.object);
        break;

      case "customer.subscription.created":
      case "customer.subscription.updated":
        await handleSubscriptionChange(event.data.object);
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object);
        break;

      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(event.data.object);
        break;

      case "charge.refunded":
        await handleChargeRefunded(event.data.object);
        break;

      case "charge.dispute.created":
        await handleDisputeCreated(event.data.object);
        break;

      default:
        logWebhookInfo(`Unhandled event type: ${event.type}`);
    }

    // Record successful processing
    const userId = extractUserId(event);

    try {
      await db.insert(webhookEvents).values({
        eventId: event.id,
        eventType: event.type,
        status: "success",
        userId: userId,
      });

      logWebhookSuccess(
        `Recorded successful processing of ${event.type} (${event.id})`
      );
    } catch (recordError) {
      // Log but don't fail webhook - event was processed successfully
      logWebhookError(
        "Failed to record webhook event (event was processed successfully)",
        recordError
      );
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    // Signature verification failures are client errors (400)
    if (error instanceof Error && error.message.includes("signature")) {
      logWebhookError("Invalid webhook signature", error);
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    // Record processing failure (only if event was validated)
    if (event?.id) {
      try {
        const userId = extractUserId(event);
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";

        await db
          .insert(webhookEvents)
          .values({
            eventId: event.id,
            eventType: event.type,
            status: "failed",
            errorMessage: errorMessage,
            retryCount: 1,
            userId: userId,
          })
          .onConflictDoUpdate({
            target: webhookEvents.eventId,
            set: {
              retryCount: sql`${webhookEvents.retryCount} + 1`,
              errorMessage: errorMessage,
              processedAt: sql`CURRENT_TIMESTAMP`,
            },
          });

        logWebhookError(`Recorded failure for ${event.type} (${event.id})`);
      } catch (recordError) {
        logWebhookError("Failed to record webhook failure", recordError);
      }
    }

    // All other errors are server errors (500)
    logWebhookError("Webhook handler failed", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Handle customer creation
 */
async function handleCustomerCreated(customer: any) {
  const userId = customer.metadata?.supabase_user_id;

  if (!userId) {
    logWebhookError("No supabase_user_id in customer metadata");
    return;
  }

  try {
    // ✅ NEW: Check if user already has a customer (defensive)
    const existingCustomer = await db
      .select()
      .from(stripeCustomers)
      .where(eq(stripeCustomers.userId, userId))
      .limit(1);

    if (existingCustomer.length > 0) {
      // User already has a customer - this is suspicious
      logWebhookWarning('🚨 SECURITY: Attempt to create duplicate customer for user', {
        userId,
        existingCustomerId: existingCustomer[0].stripeCustomerId,
        newCustomerId: customer.id,
        severity: 'MEDIUM',
      });

      // Don't insert - primary key constraint would fail anyway
      // But log for security monitoring
      return;
    }

    // Proceed with customer creation
    await db
      .insert(stripeCustomers)
      .values({
        userId,
        stripeCustomerId: customer.id,
      })
      .onConflictDoNothing(); // Still keep this as safety net

    logWebhookSuccess(`Stripe customer created for user: ${userId}`);
  } catch (error) {
    logWebhookError("Error creating stripe customer record", error);
  }
}

/**
 * Handle checkout completion - update plan_selected
 */
async function handleCheckoutCompleted(session: any) {
  const userId = session.metadata?.supabase_user_id;
  const customerId = session.customer;

  logWebhookDebug("Checkout session details", {
    sessionId: session.id,
    mode: session.mode,
    customerId,
    metadata: session.metadata,
    paymentStatus: session.payment_status,
  });

  if (!userId) {
    logWebhookError("No supabase_user_id in checkout session metadata", {
      metadata: session.metadata,
    });
    return;
  }

  logWebhookSuccess(`Checkout completed for user: ${userId}`);

  // Store Stripe customer ID if we have one
  if (customerId) {
    try {
      await db
        .insert(stripeCustomers)
        .values({
          userId,
          stripeCustomerId: customerId,
        })
        .onConflictDoNothing();

      logWebhookSuccess(`Stripe customer ID stored for user: ${userId}`);
    } catch (error) {
      logWebhookError("Error storing stripe customer ID", error);
    }
  } else {
    logWebhookWarning("No customer ID in checkout session");
  }

  // For subscription mode, wait for subscription.created event to update plan
  if (session.mode === "subscription") {
    logSubscriptionEvent(
      "Subscription checkout - will update plan on subscription.created"
    );
    return;
  }

  // For payment mode (lifetime), check payment status first
  if (session.mode === "payment") {
    logPaymentEvent("Payment mode detected - checking payment status");

    try {
      const lineItems = await stripe.checkout.sessions.listLineItems(
        session.id
      );
      const priceId = lineItems.data[0]?.price?.id;

      logWebhookDebug("Line items", {
        count: lineItems.data.length,
        priceId,
      });

      if (!priceId) {
        logWebhookError("No price ID found in line items");
        return;
      }

      const plan = mapPriceToPlan(priceId);
      logWebhookDebug("Mapped price to plan", { priceId, plan });

      if (!plan) {
        logWebhookError(`Unknown price ID: ${priceId}`);
        return;
      }

      // ✅ NEW: Verify customer ownership if customer ID exists
      if (customerId) {
        const ownership = await verifyCustomerOwnership(customerId, userId);

        if (!ownership.valid) {
          logWebhookError('Customer-User correlation check failed for lifetime purchase', {
            handler: 'handleCheckoutCompleted',
            mode: 'payment',
            claimedUserId: userId,
            actualUserId: ownership.actualUserId,
            stripeCustomerId: customerId,
            sessionId: session.id,
            severity: 'HIGH',
          });
          return; // ❌ DO NOT GRANT LIFETIME ACCESS
        }

        logWebhookDebug('Customer-User correlation verified for lifetime purchase', {
          userId,
          customerId,
        });
      }

      // Continue with existing payment status logic (no changes below)...
      // ✅ NEW: Check payment status before granting access
      const paymentStatus = session.payment_status;
      logWebhookDebug("Payment status", { paymentStatus, sessionId: session.id });

      // ✅ NEW: Verify line item price (NOT session total, to support 100% coupons)
      const lineItemPrice = lineItems.data[0]?.price;
      if (!lineItemPrice) {
        logWebhookError("No price found in line items", { sessionId: session.id });
        return;
      }

      const verification = verifyPaymentAmount(
        plan,
        lineItemPrice.currency || 'usd',
        lineItemPrice.unit_amount || 0,
        false // lifetime is one-time payment
      );

      if (!verification.valid) {
        logWebhookError('🚨 CRITICAL: Amount verification failed - NOT granting access', {
          handler: 'handleCheckoutCompleted',
          mode: 'payment',
          plan,
          expected: formatAmount(verification.expected),
          actual: formatAmount(verification.actual),
          variance: verification.variance,
          currency: verification.currency,
          sessionId: session.id,
          userId,
          priceId,
          severity: 'HIGH',
          action: 'Check environment variables and Stripe price configuration',
        });

        // ❌ DO NOT GRANT ACCESS - Return early
        return;
      }

      logWebhookSuccess('✅ Amount verification passed', {
        plan,
        amount: formatAmount(verification.actual),
        currency: verification.currency,
      });

      if (paymentStatus === "paid") {
        // Payment confirmed - grant access immediately
        logPaymentEvent(`Payment confirmed - granting ${plan} access to user ${userId}`);

        try {
          await db
            .update(profile)
            .set({
              planSelected: plan,
              planSelectedAt: new Date(),
              subscriptionStatus: "active",
              currentPeriodEnd: null,
              cancelAtPeriodEnd: false,
              billingVersion: sql`billing_version + 1`,
            })
            .where(eq(profile.id, userId));

          logWebhookSuccess(`Granted ${plan} access to user ${userId}`);
        } catch (dbError) {
          logWebhookError(`Error updating plan for user ${userId}`, dbError);
          throw dbError;
        }

      } else if (paymentStatus === "unpaid") {
        // Payment pending - store for later processing
        logPaymentEvent(`Payment pending for user ${userId} - waiting for payment_intent.succeeded`);

        try {
          await db.insert(pendingLifetimePurchases).values({
            userId,
            checkoutSessionId: session.id,
            paymentIntentId: session.payment_intent as string,
            priceId,
            plan: plan as "lifetime",
            status: "pending",
          }).onConflictDoUpdate({
            target: pendingLifetimePurchases.checkoutSessionId,
            set: {
              updatedAt: new Date(),
              paymentIntentId: session.payment_intent as string, // Update if webhook retries
            },
          });

          logWebhookInfo(`Stored pending lifetime purchase for user ${userId}`);
        } catch (dbError) {
          logWebhookError(`Error storing pending purchase for user ${userId}`, dbError);
          throw dbError;
        }

      } else if (paymentStatus === "no_payment_required") {
        // Free checkout (100% coupon) - grant access
        logPaymentEvent(`No payment required - granting ${plan} access to user ${userId}`);

        try {
          await db
            .update(profile)
            .set({
              planSelected: plan,
              planSelectedAt: new Date(),
              subscriptionStatus: "active",
              currentPeriodEnd: null,
              cancelAtPeriodEnd: false,
              billingVersion: sql`billing_version + 1`,
            })
            .where(eq(profile.id, userId));

          logWebhookSuccess(`Granted ${plan} access to user ${userId} (no payment required)`);
        } catch (dbError) {
          logWebhookError(`Error updating plan for user ${userId}`, dbError);
          throw dbError;
        }

      } else {
        // Unknown payment status
        logWebhookWarning(`Unknown payment status: ${paymentStatus} for session ${session.id}`);
      }

    } catch (error) {
      logWebhookError("Error processing payment mode checkout", error);
      throw error;
    }
  }
}

/**
 * Handle payment intent succeeded - grant access for pending lifetime purchases
 */
async function handlePaymentIntentSucceeded(paymentIntent: any) {
  const paymentIntentId = paymentIntent.id;

  logPaymentEvent(`Payment intent succeeded: ${paymentIntentId}`);

  try {
    // Find pending lifetime purchase
    const pendingResults = await db
      .select()
      .from(pendingLifetimePurchases)
      .where(eq(pendingLifetimePurchases.paymentIntentId, paymentIntentId))
      .limit(1);

    if (pendingResults.length === 0) {
      // Not a lifetime purchase or already processed
      logWebhookInfo(`No pending lifetime purchase found for payment intent ${paymentIntentId}`);
      return;
    }

    const purchase = pendingResults[0];

    // Grant lifetime access
    logPaymentEvent(`Granting ${purchase.plan} access to user ${purchase.userId} after payment confirmation`);

    try {
      await db.update(profile).set({
        planSelected: purchase.plan,
        planSelectedAt: new Date(),
        subscriptionStatus: "active",
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        billingVersion: sql`billing_version + 1`,
      }).where(eq(profile.id, purchase.userId));

      logWebhookSuccess(`Granted ${purchase.plan} access to user ${purchase.userId}`);
    } catch (dbError) {
      logWebhookError(`Error updating plan for user ${purchase.userId}`, dbError);
      throw dbError;
    }

    // Mark purchase as paid
    try {
      await db.update(pendingLifetimePurchases).set({
        status: "paid",
        updatedAt: new Date(),
      }).where(eq(pendingLifetimePurchases.id, purchase.id));

      logWebhookSuccess(`Marked pending purchase ${purchase.id} as paid`);
    } catch (dbError) {
      logWebhookError(`Error updating pending purchase status`, dbError);
      // Don't throw - access was granted successfully
    }

  } catch (error) {
    logWebhookError("Error processing payment intent succeeded", error);
    throw error;
  }
}

/**
 * Handle payment intent failed - mark pending lifetime purchase as failed
 */
async function handlePaymentIntentFailed(paymentIntent: any) {
  const paymentIntentId = paymentIntent.id;

  logPaymentEvent(`Payment intent failed: ${paymentIntentId}`);

  try {
    // Find pending lifetime purchase
    const pendingResults = await db
      .select()
      .from(pendingLifetimePurchases)
      .where(eq(pendingLifetimePurchases.paymentIntentId, paymentIntentId))
      .limit(1);

    if (pendingResults.length === 0) {
      // Not a lifetime purchase or already processed
      logWebhookInfo(`No pending lifetime purchase found for failed payment intent ${paymentIntentId}`);
      return;
    }

    const purchase = pendingResults[0];

    // Mark purchase as failed
    try {
      await db.update(pendingLifetimePurchases).set({
        status: "failed",
        updatedAt: new Date(),
      }).where(eq(pendingLifetimePurchases.id, purchase.id));

      logWebhookWarning(`Payment failed for user ${purchase.userId} - marked pending purchase ${purchase.id} as failed`);
    } catch (dbError) {
      logWebhookError(`Error marking pending purchase as failed`, dbError);
      throw dbError;
    }

    // TODO: Send email notification to user (separate ticket)
    // TODO: Consider cleanup job for old failed purchases (separate ticket)

  } catch (error) {
    logWebhookError("Error processing payment intent failed", error);
    throw error;
  }
}

/**
 * Handle failed invoice payment (subscription payment declined)
 * Updates subscription status to reflect payment failure
 */
async function handleInvoicePaymentFailed(invoice: any) {
  const subscriptionId = invoice.subscription;
  const customerId = invoice.customer;
  const attemptCount = invoice.attempt_count;

  logPaymentEvent(
    `Invoice payment failed for subscription ${subscriptionId} (attempt ${attemptCount})`
  );

  if (!subscriptionId) {
    logWebhookWarning("Invoice has no subscription ID");
    return;
  }

  try {
    // Get subscription to find user ID from metadata
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const userId = subscription.metadata?.supabase_user_id;

    if (!userId) {
      logWebhookError("No user ID in subscription metadata", {
        subscriptionId,
        customerId,
      });
      return;
    }

    // Verify customer ownership (security check)
    const ownership = await verifyCustomerOwnership(customerId, userId);

    if (!ownership.valid) {
      logWebhookError('Customer-User correlation check failed for invoice payment failure', {
        handler: 'handleInvoicePaymentFailed',
        claimedUserId: userId,
        actualUserId: ownership.actualUserId,
        stripeCustomerId: customerId,
        subscriptionId,
        invoiceId: invoice.id,
        severity: 'HIGH',
      });
      return; // ❌ DO NOT UPDATE STATUS
    }

    logWebhookDebug('Customer-User correlation verified for invoice failure', {
      userId,
      customerId,
      subscriptionId,
    });

    // Update subscription status to past_due
    await db
      .update(profile)
      .set({
        subscriptionStatus: "past_due",
        billingVersion: sql`billing_version + 1`,
      })
      .where(eq(profile.id, userId));

    logWebhookSuccess(
      `Updated subscription status to past_due for user ${userId}`
    );

    // Log warning if this is the final attempt
    if (attemptCount >= 3) {
      logWebhookWarning(
        `Final payment attempt failed for user ${userId} - subscription will be canceled by Stripe`,
        {
          attemptCount,
          subscriptionId,
          userId,
        }
      );
    }

    // TODO: Send email notification (separate ticket)
    // await sendPaymentFailureEmail({
    //   userId,
    //   attemptCount,
    //   nextAttemptDate: nextPaymentAttempt ? new Date(nextPaymentAttempt * 1000) : null,
    // });

  } catch (error) {
    logWebhookError("Error processing invoice payment failure", error);
    throw error; // Trigger Stripe retry
  }
}

/**
 * Handle charge refunds (full or partial)
 * Revokes access for full refunds of lifetime purchases
 */
async function handleChargeRefunded(charge: any) {
  const chargeId = charge.id;
  const customerId = charge.customer;
  const amountRefunded = charge.amount_refunded; // In cents
  const amountCharged = charge.amount; // In cents
  const currency = charge.currency;
  const isFullRefund = amountRefunded === amountCharged;

  logPaymentEvent(
    `Charge refunded: ${chargeId} (${formatAmount(amountRefunded, currency)} refunded)`
  );

  if (!customerId) {
    logWebhookWarning("Charge has no customer ID", { chargeId });
    return;
  }

  try {
    // Find user by customer ID
    const customerRecord = await db
      .select()
      .from(stripeCustomers)
      .where(eq(stripeCustomers.stripeCustomerId, customerId))
      .limit(1);

    if (customerRecord.length === 0) {
      logWebhookWarning(`No user found for customer ${customerId}`, {
        chargeId,
        customerId,
      });
      return;
    }

    const userId = customerRecord[0].userId;

    // Get user's current plan
    const userProfile = await db
      .select()
      .from(profile)
      .where(eq(profile.id, userId))
      .limit(1);

    if (userProfile.length === 0) {
      logWebhookError(`No profile found for user ${userId}`, {
        userId,
        chargeId,
      });
      return;
    }

    const currentPlan = userProfile[0].planSelected;

    // Log refund details
    logWebhookDebug('Refund details', {
      userId,
      currentPlan,
      isFullRefund,
      amountRefunded: formatAmount(amountRefunded, currency),
      amountCharged: formatAmount(amountCharged, currency),
    });

    // For lifetime plans, full refund = revoke access
    if (currentPlan === "lifetime" && isFullRefund) {
      logPaymentEvent(
        `Full refund detected - revoking lifetime access for user ${userId}`
      );

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
        .where(eq(profile.id, userId));

      logWebhookSuccess(
        `Revoked lifetime access for user ${userId} due to full refund`
      );

      // TODO: Send email notification (separate ticket)
      // await sendRefundNotificationEmail({ userId, amount: amountRefunded });

    } else if (isFullRefund) {
      // Full refund for subscription - let subscription.deleted handle it
      logWebhookInfo(
        `Full refund for non-lifetime plan (user ${userId}, plan ${currentPlan}) - subscription cancellation will be handled by subscription.deleted event`
      );
    } else {
      // Partial refund - no action needed
      logWebhookInfo(
        `Partial refund (${formatAmount(amountRefunded, currency)}) for user ${userId} - no access changes`
      );
    }

  } catch (error) {
    logWebhookError("Error processing charge refund", error);
    throw error; // Trigger Stripe retry
  }
}

/**
 * Handle charge disputes (chargebacks)
 * Logs security alert for manual review - does NOT automatically revoke access
 */
async function handleDisputeCreated(dispute: any) {
  const disputeId = dispute.id;
  const chargeId = dispute.charge;
  const amount = dispute.amount;
  const reason = dispute.reason;
  const status = dispute.status;
  const currency = dispute.currency || 'usd';

  logPaymentEvent(
    `Dispute created: ${disputeId} for charge ${chargeId} (${formatAmount(amount, currency)})`
  );

  try {
    // Get charge details to find customer
    const charge = await stripe.charges.retrieve(chargeId);
    const customerId = charge.customer;

    if (!customerId) {
      logWebhookWarning("Disputed charge has no customer ID", {
        disputeId,
        chargeId,
      });
      return;
    }

    // Find user by customer ID
    const customerRecord = await db
      .select()
      .from(stripeCustomers)
      .where(eq(stripeCustomers.stripeCustomerId, customerId as string))
      .limit(1);

    if (customerRecord.length === 0) {
      logWebhookWarning(
        `No user found for disputed customer ${customerId}`,
        {
          disputeId,
          chargeId,
          customerId,
        }
      );
      return;
    }

    const userId = customerRecord[0].userId;

    // Get user details for logging
    const userProfile = await db
      .select()
      .from(profile)
      .where(eq(profile.id, userId))
      .limit(1);

    const currentPlan = userProfile[0]?.planSelected || 'unknown';

    // Log security alert for manual review
    console.error('🚨 SECURITY ALERT: Charge dispute filed', {
      disputeId,
      chargeId,
      userId,
      currentPlan,
      amount: formatAmount(amount, currency),
      currency,
      reason,
      status,
      timestamp: new Date().toISOString(),
      action: 'MANUAL_REVIEW_REQUIRED',
      severity: 'HIGH',
    });

    logWebhookWarning(
      `Dispute filed for user ${userId} - requires manual review`,
      {
        disputeId,
        amount: formatAmount(amount, currency),
        reason,
        currentPlan,
      }
    );

    // TODO: Send alert to admin (separate ticket)
    // await sendDisputeAlert({
    //   userId,
    //   disputeId,
    //   amount,
    //   reason,
    // });

    // TODO: Flag user account for review (separate ticket)
    // await flagUserAccountForReview(userId, 'dispute_filed');

    // IMPORTANT: Do NOT automatically revoke access
    // Wait for dispute resolution (charge.dispute.closed)
    logWebhookInfo(
      'No automatic action taken - waiting for dispute resolution'
    );

  } catch (error) {
    logWebhookError("Error processing dispute notification", error);
    throw error; // Trigger Stripe retry
  }
}

/**
 * Handle subscription changes - update plan_selected
 */
async function handleSubscriptionChange(subscription: any) {
  const userId = subscription.metadata?.supabase_user_id;
  const customerId = subscription.customer; // Stripe customer ID

  if (!userId) {
    logWebhookError("No supabase_user_id in subscription metadata");
    return;
  }

  // ✅ NEW: Verify customer belongs to this user
  const ownership = await verifyCustomerOwnership(customerId, userId);

  if (!ownership.valid) {
    logWebhookError('Customer-User correlation check failed - NOT updating plan', {
      handler: 'handleSubscriptionChange',
      claimedUserId: userId,
      actualUserId: ownership.actualUserId,
      stripeCustomerId: customerId,
      subscriptionId: subscription.id,
      severity: 'HIGH',
    });
    return; // ❌ DO NOT UPDATE PROFILE
  }

  logWebhookDebug('Customer-User correlation verified', {
    userId,
    customerId,
  });

  // Continue with existing logic (no changes below)...
  const priceId = subscription.items.data[0]?.price.id;
  if (!priceId) {
    logWebhookError("No price ID in subscription");
    return;
  }

  const plan = mapPriceToPlan(priceId);
  if (!plan) {
    logWebhookError(`Unknown price ID: ${priceId}`);
    return;
  }

  // ✅ NEW: Verify subscription amount
  const price = subscription.items.data[0]?.price;
  if (!price) {
    logWebhookError("No price object in subscription items");
    return;
  }

  const amount = price.unit_amount || 0;
  const currency = price.currency || 'usd';

  const verification = verifyPaymentAmount(
    plan,
    currency,
    amount,
    true // subscription is recurring
  );

  if (!verification.valid) {
    logWebhookError('🚨 CRITICAL: Subscription amount verification failed - NOT updating plan', {
      handler: 'handleSubscriptionChange',
      plan,
      expected: formatAmount(verification.expected),
      actual: formatAmount(verification.actual),
      variance: verification.variance,
      currency: verification.currency,
      subscriptionId: subscription.id,
      userId,
      priceId,
      severity: 'HIGH',
      action: 'Check environment variables and Stripe price configuration',
    });

    // ❌ DO NOT GRANT ACCESS - Return early
    return;
  }

  logWebhookSuccess('✅ Subscription amount verification passed', {
    plan,
    amount: formatAmount(verification.actual),
    currency: verification.currency,
  });

  // Only update if subscription is active
  if (subscription.status === "active" || subscription.status === "trialing") {
    try {
      await db
        .update(profile)
        .set({
          planSelected: plan,
          planSelectedAt: new Date(),
          subscriptionStatus: subscription.status, // NEW: active, trialing, etc.
          currentPeriodEnd: subscription.current_period_end, // NEW: unix timestamp
          cancelAtPeriodEnd: subscription.cancel_at_period_end || false, // NEW: Critical for graceful cancellation
          billingVersion: sql`billing_version + 1`, // NEW: Increment version
        })
        .where(eq(profile.id, userId));

      logWebhookSuccess(
        `Updated plan_selected to '${plan}' for user: ${userId}`
      );
    } catch (error) {
      logWebhookError(`Error updating plan for user ${userId}`, error);
      // Throw error to trigger webhook retry by Stripe
      throw error;
    }
  }
}

/**
 * Handle subscription deletion - revert to free tier
 */
async function handleSubscriptionDeleted(subscription: any) {
  const userId = subscription.metadata?.supabase_user_id;
  const customerId = subscription.customer;

  if (!userId) {
    logWebhookError("No supabase_user_id in subscription metadata");
    return;
  }

  // ✅ NEW: Verify customer belongs to this user
  const ownership = await verifyCustomerOwnership(customerId, userId);

  if (!ownership.valid) {
    logWebhookError('Customer-User correlation check failed - NOT reverting plan', {
      handler: 'handleSubscriptionDeleted',
      claimedUserId: userId,
      actualUserId: ownership.actualUserId,
      stripeCustomerId: customerId,
      severity: 'HIGH',
    });
    return; // ❌ DO NOT REVERT PLAN
  }

  // Continue with existing logic (no changes below)...
  // Revert to free tier
  try {
    await db
      .update(profile)
      .set({
        planSelected: "free",
        planSelectedAt: new Date(),
        subscriptionStatus: "canceled", // NEW
        currentPeriodEnd: null, // NEW
        cancelAtPeriodEnd: false, // NEW: No longer relevant after deletion
        billingVersion: sql`billing_version + 1`, // NEW: Increment version
      })
      .where(eq(profile.id, userId));

    logWebhookSuccess(`Reverted to free tier for user: ${userId}`);
  } catch (error) {
    logWebhookError(`Error reverting user ${userId} to free tier`, error);
    // Throw error to trigger webhook retry by Stripe
    throw error;
  }
}

/**
 * Extract user ID from event metadata
 * Handles different event structures (customer, session, subscription)
 */
function extractUserId(event: any): string | null {
  // Try subscription metadata
  if (event.data.object.metadata?.supabase_user_id) {
    return event.data.object.metadata.supabase_user_id;
  }

  // Try session/checkout metadata
  if (event.data.object.metadata?.supabase_user_id) {
    return event.data.object.metadata.supabase_user_id;
  }

  return null;
}
