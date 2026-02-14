import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { webhookEvents } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import {
  logWebhookReceived,
  logWebhookSuccess,
  logWebhookError,
  logWebhookInfo,
} from "@/lib/webhook-logger";
import { webhookRateLimit, getIdentifier } from "@/lib/rate-limit";
import { shouldAlertAdmin, sendAdminWebhookAlert } from "@/lib/admin-alerts";
import { logger } from "@/lib/logging";
import { webhookHandlers } from "@/lib/stripe-webhook-handlers";

export async function POST(request: NextRequest) {
  let event: Stripe.Event | null = null;

  try {
    // Rate limiting check (IP-based, no user context)
    const identifier = getIdentifier(request);
    const { success, limit, remaining, reset } = await webhookRateLimit.limit(
      identifier
    );

    logger.debug(`[Webhook] Rate limit check for ${identifier}`, {
      success,
      limit,
      remaining,
      reset,
    });

    if (!success) {
      const retryAfterSeconds = Math.ceil((reset - Date.now()) / 1000);

      logger.warn(`[Rate Limit] Webhook rate limit exceeded for ${identifier}`);

      return NextResponse.json(
        {
          error: "Rate limit exceeded",
          retryAfter: retryAfterSeconds,
        },
        {
          status: 429,
          headers: {
            "Retry-After": retryAfterSeconds.toString(),
          },
        }
      );
    }

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

    // Check for duplicate event (only block successful duplicates)
    const existingEvent = await db
      .select()
      .from(webhookEvents)
      .where(eq(webhookEvents.eventId, event.id))
      .limit(1);

    if (existingEvent.length > 0 && existingEvent[0].status === "success") {
      logWebhookInfo(
        `Duplicate event ${event.id} (${event.type}) - already processed successfully at ${existingEvent[0].processedAt}`
      );
      return NextResponse.json(
        {
          received: true,
          duplicate: true,
          originalProcessedAt: existingEvent[0].processedAt,
        },
        { status: 200 }
      );
    } else if (
      existingEvent.length > 0 &&
      existingEvent[0].status === "failed"
    ) {
      logWebhookInfo(
        `Retry detected for failed event ${event.id} (retry #${
          (existingEvent[0].retryCount || 0) + 1
        })`
      );
    }

    // Handle different event types using the handler registry
    const handler = webhookHandlers[event.type];

    if (handler) {
      const result = await handler({ event, eventId: event.id });
      if (!result.success) {
        throw new Error(
          result.message ?? `Handler reported failure for ${event.type}`
        );
      }
    } else {
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

        // Get or increment retry count
        const existingEvent = await db
          .select()
          .from(webhookEvents)
          .where(eq(webhookEvents.eventId, event.id))
          .limit(1);

        const retryCount =
          existingEvent.length > 0 ? (existingEvent[0].retryCount || 0) + 1 : 1;

        await db
          .insert(webhookEvents)
          .values({
            eventId: event.id,
            eventType: event.type,
            status: "failed",
            errorMessage: errorMessage,
            retryCount: retryCount,
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

        logWebhookError(
          `Recorded failure for ${event.type} (${event.id}), retry count: ${retryCount}`
        );

        // Alert admin if retry count >= 3
        if (shouldAlertAdmin(retryCount)) {
          const eventObject = event.data.object as any;
          await sendAdminWebhookAlert({
            userId: userId || "unknown",
            eventId: event.id,
            eventType: event.type,
            sessionId: eventObject.id,
            customerId: eventObject.customer,
            subscriptionId: eventObject.subscription,
            errorMessage,
            retryCount,
            timestamp: new Date(),
          });
        }
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
 * Extract user ID from event metadata
 * Handles different event structures (customer, session, subscription)
 */
function extractUserId(event: Stripe.Event): string | null {
  const object = event.data.object as any;
  return object.metadata?.supabase_user_id || null;
}
