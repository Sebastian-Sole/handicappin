import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../trpc";
import { db } from "@/db";
import { hole } from "@/db/schema";
import { eq } from "drizzle-orm";

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
  fetchHoles: publicProcedure
    .input(z.object({ teeId: z.number() }))
    .query(async ({ ctx, input }) => {
      return await db.select().from(hole).where(eq(hole.teeId, input.teeId));
    }),
});
