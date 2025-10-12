"use server";

import { createServerComponentClient } from "@/utils/supabase/server";
import { db } from "@/db";
import { profile } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function createFreeTierSubscription(userId: string) {
  const supabase = await createServerComponentClient();

  // Verify user is authenticated
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.id !== userId) {
    throw new Error("Unauthorized");
  }

  // Set plan_selected to 'free' in profile
  try {
    await db
      .update(profile)
      .set({
        planSelected: "free",
        planSelectedAt: new Date(),
      })
      .where(eq(profile.id, userId));

    console.log("✅ Free tier plan selected for user:", userId);
    return { success: true };
  } catch (error) {
    console.error("❌ Error setting free tier:", error);
    throw new Error("Failed to set free tier plan");
  }
}
