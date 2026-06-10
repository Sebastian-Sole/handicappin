import Stripe from "stripe";
import { db } from "@/db";
import { stripeCustomers } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  logWebhookSuccess,
  logWebhookError,
  logWebhookWarning,
  logWebhookInfo,
} from "@/lib/webhook-logger";
import type { WebhookContext, WebhookResult } from "./types";

/**
 * Handle customer creation
 */
export async function handleCustomerCreated(
  ctx: WebhookContext
): Promise<WebhookResult> {
  const customer = ctx.event.data.object as Stripe.Customer;
  const userId = customer.metadata?.supabase_user_id;

  if (!userId) {
    // Customer created by another application (e.g., Clerk) - skip gracefully
    logWebhookInfo(
      `Skipping customer ${customer.id} - no supabase_user_id in metadata (likely from another application)`
    );
    return { success: true, message: "Skipped - no supabase_user_id" };
  }

  try {
    // Check if user already has a customer (defensive)
    const existingCustomer = await db
      .select()
      .from(stripeCustomers)
      .where(eq(stripeCustomers.userId, userId))
      .limit(1);

    if (existingCustomer.length > 0) {
      // Check if it's the same customer (race condition) or different (security issue)
      if (existingCustomer[0].stripeCustomerId === customer.id) {
        // Same customer - just a race between checkout API and webhook
        logWebhookInfo(
          `Customer ${customer.id} already stored for user ${userId} (race condition - checkout API vs webhook)`
        );
        return { success: true, message: "Customer already exists" };
      } else {
        // Different customer - this is a real security concern
        logWebhookWarning(
          "SECURITY: Attempt to create duplicate customer for user",
          {
            userId,
            existingCustomerId: existingCustomer[0].stripeCustomerId,
            newCustomerId: customer.id,
            severity: "HIGH",
          }
        );
        throw new Error(
          `Security: User already has customer ${existingCustomer[0].stripeCustomerId}, cannot create duplicate customer ${customer.id}`
        );
      }
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
    return { success: true };
  } catch (error) {
    logWebhookError("Error creating stripe customer record", error);
    throw error;
  }
}
