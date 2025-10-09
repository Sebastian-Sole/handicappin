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

  // With Stripe-first approach, free tier users don't need a subscription record
  // Access control will query Stripe directly and default to free tier if no subscription exists
  console.log("✅ Free tier access granted (no subscription record needed)");
  return { success: true };
}
