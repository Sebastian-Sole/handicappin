import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../trpc";
import { db } from "@/db";
import { teeInfo, hole } from "@/db/schema";
import { and, eq } from "drizzle-orm";

export const teeRouter = createTRPCRouter({
  getTeeById: publicProcedure
    .input(z.object({ teeId: z.number() }))
    .query(async ({ ctx, input }) => {
      const { teeId } = input;
      const { data: tee, error } = await ctx.supabase.from("teeInfo").select("*").eq("id", teeId).single();
      if (error) {
        console.error(error);
        return null;
      }
      return tee;
    }),
  fetchTees: publicProcedure
    .input(z.object({ courseId: z.number() }))
    .query(async ({ ctx, input }) => {
      // First fetch all approved tees for the course
      const tees = await db
        .select()
        .from(teeInfo)
        .where(
          and(
            eq(teeInfo.courseId, input.courseId),
            eq(teeInfo.approvalStatus, "approved")
          )
        );

      // For each tee, fetch its holes
      const teesWithHoles = await Promise.all(
        tees.map(async (tee) => {
          const holes = await db
            .select()
            .from(hole)
            .where(eq(hole.teeId, tee.id));

          return {
            ...tee,
            // Convert decimal strings to numbers
            courseRating18: Number(tee.courseRating18),
            courseRatingFront9: Number(tee.courseRatingFront9),
            courseRatingBack9: Number(tee.courseRatingBack9),
            approvalStatus: "approved" as const,
            distanceMeasurement: tee.distanceMeasurement as "meters" | "yards",
            gender: tee.gender as "mens" | "ladies",
            holes: holes.sort((a, b) => a.holeNumber - b.holeNumber), // Ensure holes are in order
          };
        })
      );

      return teesWithHoles;
    }),
});
