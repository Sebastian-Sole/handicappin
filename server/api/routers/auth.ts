import { z } from "zod";
import { authedProcedure, createTRPCRouter, publicProcedure } from "../trpc";
import { signupSchema } from "@/types/auth";

export const authRouter = createTRPCRouter({
  signup: publicProcedure
    .input(signupSchema)
    .mutation(async ({ ctx, input }) => {
      const { data: signupData, error: signupError } =
        await ctx.supabase.auth.signUp({
          email: input.email,
          password: input.password,
        });

      if (signupError) {
        throw new Error(`Error signing up: ${signupError.message}`);
      }

      if (!signupData?.user?.id) {
        throw new Error("User ID is undefined after signup.");
      }

      const { data: profileData, error: profileError } = await ctx.supabase
        .from("Profile")
        .insert([
          {
            email: input.email,
            name: input.name,
            handicapIndex: 54,
            id: signupData.user.id,
          },
        ])
        .select("id")
        .single();

      if (profileError) {
        throw new Error(`Error creating profile: ${profileError.message}`);
      }

      const { data: loginData, error: loginError } =
        await ctx.supabase.auth.signInWithPassword({
          email: input.email,
          password: input.password,
        });

      if (loginError) {
        throw new Error(`Error logging in after signup: ${loginError.message}`);
      }

      return loginData.session; // Return the session data for the client
    }),
  getProfileFromUserId: authedProcedure
    .input(z.string())
    .query(async ({ ctx, input }) => {
      const { data: profileData, error: profileError } = await ctx.supabase
        .from("Profile")
        .select("*")
        .eq("id", input)
        .single();

      if (profileError) {
        throw new Error(`Error getting profile: ${profileError.message}`);
      }

      return profileData;
    }),
});
