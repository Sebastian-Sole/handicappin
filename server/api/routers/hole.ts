import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../trpc";
import { db } from "@/db";
import { course, hole, round, teeInfo } from "@/db/schema";
import { eq } from "drizzle-orm";

export const holeRouter = createTRPCRouter({
  getHolesByRoundId: publicProcedure
    .input(z.string())
    .query(async ({ ctx, input }) => {
      const numericId = Number(input);
      if (isNaN(numericId)) {
        throw new Error("Invalid round id");
      }

      const roundResult = await db.select().from(round).where(eq(round.id, numericId));
      const roundData = roundResult[0];
      if (!roundData) throw new Error("Round not found");
  
      // 2. Fetch the course
      const courseResult = await db.select().from(course).where(eq(course.id, roundData.courseId));
      const courseData = courseResult[0];
      if (!courseData) throw new Error("Course not found");
  
      // 4. Fetch the tee played
      const teePlayedResult = await db.select().from(teeInfo).where(eq(teeInfo.id, roundData.teeId));
      const teePlayed = teePlayedResult[0];
      if (!teePlayed) throw new Error("Tee played not found");
  
      // 5. Fetch holes for the tee played
      const holes = await db.select().from(hole).where(eq(hole.teeId, teePlayed.id));

      return holes;
    }),
  getHolesByTeeId: publicProcedure
    .input(z.object({ teeId: z.number() }))
    .query(async ({ ctx, input }) => {
      return await db.select().from(hole).where(eq(hole.teeId, input.teeId));
    }),
});
