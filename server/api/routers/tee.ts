import { z } from "zod";
import { createTRPCRouter, publicProcedure, authedProcedure } from "../trpc";
import { db } from "@/db";
import { teeInfo, hole } from "@/db/schema";
import { and, eq, inArray, or } from "drizzle-orm";

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
  fetchTees: authedProcedure
    .input(z.object({ courseId: z.number() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.user.id;

      // Fetch approved non-archived tees + current user's own pending tees
      const tees = await db
        .select()
        .from(teeInfo)
        .where(
          and(
            eq(teeInfo.courseId, input.courseId),
            or(
              // All approved non-archived tees (everyone sees these)
              and(
                eq(teeInfo.approvalStatus, "approved"),
                eq(teeInfo.isArchived, false)
              ),
              // User's own pending tees (only the submitter sees these)
              and(
                eq(teeInfo.approvalStatus, "pending"),
                eq(teeInfo.submittedBy, userId)
              )
            )
          )
        );

      // Deduplicate by (courseId, name, gender):
      // - If a pending edit exists for an approved tee, show only the pending version
      // - If multiple pending edits exist for the same combo, show only the latest one
      const teesByCombo = new Map<string, typeof tees[number]>();
      // Sort so approved come first, then pending by id ascending — last write wins
      const sorted = [...tees].sort((a, b) => {
        if (a.approvalStatus === "approved" && b.approvalStatus !== "approved") return -1;
        if (a.approvalStatus !== "approved" && b.approvalStatus === "approved") return 1;
        return a.id - b.id;
      });
      for (const tee of sorted) {
        const combo = `${tee.courseId}_${tee.name}_${tee.gender}`;
        teesByCombo.set(combo, tee);
      }
      const deduplicatedTees = Array.from(teesByCombo.values());

      // Fetch all holes for the deduplicated tees in a single query
      const teeIds = deduplicatedTees.map((tee) => tee.id);
      const allHoles = teeIds.length > 0
        ? await db
            .select()
            .from(hole)
            .where(inArray(hole.teeId, teeIds))
        : [];

      // Group holes by teeId
      const holesByTeeId = new Map<number, typeof allHoles>();
      for (const h of allHoles) {
        const existing = holesByTeeId.get(h.teeId) ?? [];
        existing.push(h);
        holesByTeeId.set(h.teeId, existing);
      }

      const teesWithHoles = deduplicatedTees.map((tee) => {
        const teeHoles = holesByTeeId.get(tee.id) ?? [];
        return {
          ...tee,
          courseRating18: Number(tee.courseRating18),
          courseRatingFront9: Number(tee.courseRatingFront9),
          courseRatingBack9: Number(tee.courseRatingBack9),
          approvalStatus: tee.approvalStatus as "approved" | "pending",
          distanceMeasurement: tee.distanceMeasurement as "meters" | "yards",
          gender: tee.gender as "mens" | "ladies",
          holes: teeHoles.sort((a, b) => a.holeNumber - b.holeNumber),
        };
      });

      return teesWithHoles;
    }),
});
