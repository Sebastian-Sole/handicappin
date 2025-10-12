import { stripe } from "./stripe";

/**
 * Get or create a Stripe customer for a user
 * Searches for existing customer by email, creates if not found
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
    // Search for existing customer by email
    const existingCustomers = await stripe.customers.list({
      email: email,
      limit: 1,
    });

    if (existingCustomers.data.length > 0) {
      const customerId = existingCustomers.data[0].id;
      console.log("Found existing Stripe customer:", customerId);
      return customerId;
    }

    // Create new customer with metadata
    const customer = await stripe.customers.create({
      email: email,
      metadata: {
        supabase_user_id: userId,
      },
    });

    console.log("Created new Stripe customer:", customer.id);
    return customer.id;
  } catch (error) {
    console.error(`Error managing Stripe customer for user ${userId}:`, error);
    console.error(`Email: ${email}`);
    // Return undefined - caller will use customer_email fallback
    return undefined;
  }
}
