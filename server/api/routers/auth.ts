import { z } from "zod";
import { authedProcedure, createTRPCRouter, publicProcedure } from "../trpc";
import { loginSchema, signupSchema } from "@/types/auth";

export const authRouter = createTRPCRouter({
  signup: publicProcedure
    .input(signupSchema)
    .mutation(async ({ ctx, input }) => {
      const { data: authData, error: authError } =
        await ctx.supabase.auth.signUp({
          email: input.email,
          password: input.password,
        });

      if (authError) {
        throw new Error(`Error signing up: ${authError.message}`);
      }

      if (!authData) {
        throw new Error("No auth data returned");
      }

      if (authData.user === null) {
        throw new Error("No user returned");
      }

      const { data: profileData, error: profileError } = await ctx.supabase
        .from("Profile")
        .insert([
          {
            email: input.email,
            name: input.name,
            handicapIndex: 54,
            id: authData?.user?.id,
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
        throw new Error(`Error logging in: ${loginError.message}`);
      }

      console.log("Profile created:", profileData);
      return profileData;
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
