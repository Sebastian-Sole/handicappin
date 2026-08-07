import { z } from "zod";
import { createTRPCRouter, publicProcedure, authedProcedure } from "../trpc";
import { logger } from "@/lib/logging";
import { listCourseTees } from "@/server/services/catalog";

export const teeRouter = createTRPCRouter({
  getTeeById: publicProcedure
    .input(z.object({ teeId: z.number() }))
    .query(async ({ ctx, input }) => {
      const { teeId } = input;
      const { data: tee, error } = await ctx.supabase.from("teeInfo").select("*").eq("id", teeId).single();
      if (error) {
        logger.error("Failed to fetch tee by ID", {
          teeId,
          error: error.message,
          code: error.code,
        });
        return null;
      }
      return tee;
    }),
  /**
   * Tees playable on a course: the approved, non-archived catalog PLUS the
   * signed-in user's own pending tees, deduplicated by (course, name, gender)
   * with the pending edit winning.
   *
   * The query lives in `@/server/services/catalog`, shared with
   * `GET /v1/tees` so a tee cannot resolve differently on the two surfaces.
   * The `includePendingSubmittedBy` argument is the entire difference between
   * the callers: passing the user widens visibility to their own submissions,
   * which is why `/v1` — serving a connected app, not the submitter's own
   * session — passes nothing.
   */
  fetchTees: authedProcedure
    .input(z.object({ courseId: z.number() }))
    .query(async ({ ctx, input }) =>
      listCourseTees({
        courseId: input.courseId,
        includePendingSubmittedBy: ctx.user.id,
      })
    ),
});
