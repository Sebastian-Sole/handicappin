import { z } from "zod";
import { authedProcedure, createTRPCRouter, publicProcedure } from "../trpc";

export const authRouter = createTRPCRouter({
  getProfileFromUserId: publicProcedure
    .input(z.string())
    .query(async ({ ctx, input }) => {
      console.log("input", input);
      const { data: profileData, error: profileError } = await ctx.supabase
        .from("profile")
        .select("*")
        // .eq('id', input)

      // console.log(profileError)
      console.log(profileData);

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
});
