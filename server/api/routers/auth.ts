import { z } from "zod";
import { authedProcedure, createTRPCRouter } from "../trpc";

export const authRouter = createTRPCRouter({
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
  updateProfile: authedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string(),
        email: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      console.log("User ID: " + input.id);
      const { data: profileData, error: profileError } = await ctx.supabase
        .from("Profile")
        .update({
          name: input.name,
          email: input.email,
        })
        .eq("id", input.id)
        .select();

      console.log("---------Profile Data: ----------");
      console.log("\n");
      console.log(profileData);

      if (profileError) {
        console.log("------------Profile Error: -----------");
        console.log("\n");
        console.log(profileError);
        throw new Error(`Error updating profile: ${profileError.message}`);
      }

      return profileData;
    }),
});
