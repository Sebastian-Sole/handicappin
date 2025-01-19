import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../trpc";
import { db } from "@/db";
import { teeInfo } from "@/db/schema";
import { and, eq } from "drizzle-orm";

export const teeRouter = createTRPCRouter({
  fetchTees: publicProcedure
    .input(z.object({ courseId: z.number() }))
    .query(async ({ ctx, input }) => {
      const tees = await db
        .select()
        .from(teeInfo)
        .where(
          and(
            eq(teeInfo.courseId, input.courseId),
            eq(teeInfo.approvalStatus, "approved")
          )
        );
      return tees.map((tee) => ({
        ...tee,
        approvalStatus: "approved" as const,
        distanceMeasurement: tee.distanceMeasurement as "meters" | "yards",
        gender: tee.gender as "mens" | "ladies",
      }));
    }),
});
