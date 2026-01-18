import { stripe } from "./stripe";
import { db } from "@/db";
import { stripeCustomers } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * Cancel all active Stripe subscriptions for a user
 * Returns true if successful or if no subscriptions exist
 */
export async function cancelAllUserSubscriptions(userId: string): Promise<{
  success: boolean;
  cancelledCount: number;
  error?: string;
}> {
  try {
    // Get user's Stripe customer ID
    const customer = await db
      .select()
      .from(stripeCustomers)
      .where(eq(stripeCustomers.userId, userId))
      .limit(1);

    if (!customer || customer.length === 0) {
      // No Stripe customer - nothing to cancel
      return { success: true, cancelledCount: 0 };
    }

    const customerId = customer[0].stripeCustomerId;

    // Get all active/trialing subscriptions
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "all",
    });

    const activeSubscriptions = subscriptions.data.filter(
      (sub) => sub.status === "active" || sub.status === "trialing"
    );

    // Cancel each subscription immediately (not at period end)
    let cancelledCount = 0;
    for (const subscription of activeSubscriptions) {
      await stripe.subscriptions.cancel(subscription.id, {
        prorate: false,
      });
      cancelledCount++;
    }

    return { success: true, cancelledCount };
  } catch (error) {
    console.error("Failed to cancel subscriptions:", error);
    return {
      success: false,
      cancelledCount: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Delete Stripe customer record (optional - can keep for audit)
 * Note: We don't actually delete from Stripe, just remove our mapping
 */
export async function cleanupStripeCustomer(userId: string): Promise<boolean> {
  try {
    await db
      .delete(stripeCustomers)
      .where(eq(stripeCustomers.userId, userId));
    return true;
  } catch (error) {
    console.error("Failed to cleanup Stripe customer:", error);
    return false;
  }
}
