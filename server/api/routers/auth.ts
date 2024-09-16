import { z } from "zod";
import { authedProcedure, createTRPCRouter, publicProcedure } from "../trpc";
import { signupSchema } from "@/types/auth";

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

      return authData;
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
