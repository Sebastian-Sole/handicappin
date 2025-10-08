"use server";

import { createServerComponentClient } from "@/utils/supabase/server";

export async function createFreeTierSubscription(userId: string) {
  const supabase = await createServerComponentClient();

  // Verify user is authenticated
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.id !== userId) {
    throw new Error("Unauthorized");
  }

  // Create free tier subscription in billing.subscriptions
  // Using type assertion since billing schema types haven't been regenerated yet
  const { error } = await supabase.from("billing_subscriptions").insert({
    user_id: userId,
    stripe_subscription_id: null,
    plan: "free",
    status: "active",
    current_period_end: null,
    is_lifetime: false,
  });

  if (error) {
    console.error("Free tier creation error:", error);
    throw new Error("Failed to create free tier subscription");
  }

  return { success: true };
}
