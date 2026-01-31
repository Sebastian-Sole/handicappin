import { stripe } from "./stripe";
import { logger, redactEmail } from "./logging";

/**
 * Get or create a Stripe customer for a user
 * IMPORTANT: Checks database FIRST (source of truth), then falls back to Stripe email search
 *
 * @param email - User's email address
 * @param userId - Supabase user ID to store in metadata
 * @returns Stripe customer ID, or undefined if creation fails
 */
export async function getOrCreateStripeCustomer({
  email,
  userId,
}: {
  email: string;
  userId: string;
}): Promise<string | undefined> {
  try {
    // 1. Check database FIRST - this is the source of truth
    const { db } = await import("@/db");
    const { stripeCustomers } = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");

    const existingRecord = await db
      .select()
      .from(stripeCustomers)
      .where(eq(stripeCustomers.userId, userId))
      .limit(1);

    if (existingRecord && existingRecord.length > 0) {
      const customerId = existingRecord[0].stripeCustomerId;
      return customerId;
    }

    // 2. Fallback: Search Stripe by email (for migration/legacy cases)
    const existingCustomers = await stripe.customers.list({
      email: email,
      limit: 1,
    });

    if (existingCustomers.data.length > 0) {
      const customerId = existingCustomers.data[0].id;

      // Store in database for future lookups
      try {
        await db
          .insert(stripeCustomers)
          .values({
            userId,
            stripeCustomerId: customerId,
          })
          .onConflictDoNothing(); // In case webhook already created it
      } catch (dbError) {
        logger.error("Error storing existing customer in database", {
          error: dbError instanceof Error ? dbError.message : String(dbError),
        });
        // Continue - we have the customer ID
      }

      return customerId;
    }

    // 3. Create new customer with metadata
    const customer = await stripe.customers.create({
      email: email,
      metadata: {
        supabase_user_id: userId,
      },
    });

    // Store in database immediately
    try {
      await db
        .insert(stripeCustomers)
        .values({
          userId,
          stripeCustomerId: customer.id,
        })
        .onConflictDoNothing(); // Webhook might create it concurrently
    } catch (dbError) {
      logger.error("Error storing new customer in database", {
        error: dbError instanceof Error ? dbError.message : String(dbError),
      });
      // Continue - customer was created in Stripe
    }

    return customer.id;
  } catch (error) {
    logger.error("Error managing Stripe customer", {
      userId,
      email: redactEmail(email),
      error: error instanceof Error ? error.message : String(error),
    });
    // Return undefined - caller will use customer_email fallback
    return undefined;
  }
}
