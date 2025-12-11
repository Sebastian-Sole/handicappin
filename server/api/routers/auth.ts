import { z } from "zod";
import { authedProcedure, createTRPCRouter, publicProcedure } from "../trpc";
import { redactEmail } from "@/lib/logging";

export const authRouter = createTRPCRouter({
  getProfileFromUserId: publicProcedure
    .input(z.string())
    .query(async ({ ctx, input }) => {
      console.log("input", input); // UUID logged directly (pseudonymous)
      const { data: profileData, error: profileError } = await ctx.supabase
        .from("profile")
        .select("*")
        .eq('id', input).single()

      // console.log(profileError)
      if (profileData) {
        console.log({
          ...profileData,
          email: redactEmail(profileData.email), // Only email needs redaction
        });
      }

      if (profileError) {
        throw new Error(`Error getting profile: ${profileError.message}`);
      }

      return profileData;
    }),
  updateProfile: authedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string(),
        email: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { data: profileData, error: profileError } = await ctx.supabase
        .from("profile")
        .update({
          name: input.name,
          email: input.email,
        })
        .eq("id", input.id)
        .select();

      if (profileError) {
        console.log(profileError);
        throw new Error(`Error updating profile: ${profileError.message}`);
      }

      return profileData;
    }),

  // Get email preferences for authenticated user
  getEmailPreferences: authedProcedure
    .input(z.object({ userId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { data, error } = await ctx.supabase
        .from("email_preferences")
        .select("*")
        .eq("user_id", input.userId)
        .single();

      if (error) {
        // If no preferences exist yet, return defaults
        if (error.code === "PGRST116") {
          return {
            id: null,
            user_id: input.userId,
            feature_updates: true,
            created_at: null,
            updated_at: null,
          };
        }

        console.error("Error fetching email preferences:", error);
        throw new Error(`Error fetching email preferences: ${error.message}`);
      }

      return data;
    }),

  // Update or insert email preferences
  updateEmailPreferences: authedProcedure
    .input(
      z.object({
        userId: z.string().uuid(),
        featureUpdates: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Use upsert to handle both insert and update cases
      const { data, error } = await ctx.supabase
        .from("email_preferences")
        .upsert(
          {
            user_id: input.userId,
            feature_updates: input.featureUpdates,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "user_id",
          }
        )
        .select()
        .single();

      if (error) {
        console.error("Error updating email preferences:", error);
        throw new Error(`Error updating email preferences: ${error.message}`);
      }

      return data;
    }),
});
