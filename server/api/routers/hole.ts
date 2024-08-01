import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../trpc";

export const holeRouter = createTRPCRouter({
  getHolesForRound: publicProcedure
    .input(z.string())
    .query(async ({ ctx, input }) => {
      const { data: holes, error: holesError } = await ctx.supabase
        .from("Hole")
        .select("*")
        .eq("roundId", input);

      if (holesError) {
        throw new Error(`Error getting holes: ${holesError.message}`);
      }

      return holes;
    }),
});
