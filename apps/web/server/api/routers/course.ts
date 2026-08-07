import { z } from "zod";
import { authedProcedure, createTRPCRouter, publicProcedure } from "../trpc";
import { db } from "@/db";
import { course, round } from "@/db/schema";
import { eq, desc, max, count } from "drizzle-orm";
import { searchCatalogCourses } from "@/server/services/catalog";

export const courseRouter = createTRPCRouter({
  getCourseById: publicProcedure
    .input(z.object({ courseId: z.number() }))
    .query(async ({ ctx, input }) => {
      const { courseId } = input;
      const { data: course, error } = await ctx.supabase
        .from("course")
        .select("*")
        .eq("id", courseId)
        .single();
      if (error) {
        console.error(error);
        return null;
      }
      return course;
    }),
  /**
   * Courses the signed-in user has logged rounds on, most recently played
   * first (round count breaks ties). Powers the course picker's pre-search
   * "Recent courses" list. Not filtered by approvalStatus: a pending course
   * the user played is still one they'll want to pick again.
   */
  getRecentCourses: authedProcedure.query(async ({ ctx }) => {
    const results = await db
      .select({
        id: course.id,
        name: course.name,
        approvalStatus: course.approvalStatus,
        country: course.country,
        city: course.city,
        website: course.website,
      })
      .from(round)
      .innerJoin(course, eq(course.id, round.courseId))
      .where(eq(round.userId, ctx.user.id))
      .groupBy(course.id)
      .orderBy(desc(max(round.teeTime)), desc(count(round.id)))
      .limit(5);
    return results.map((c) => ({
      ...c,
      website: c.website ?? undefined,
      approvalStatus:
        c.approvalStatus === "approved"
          ? ("approved" as const)
          : ("pending" as const),
    }));
  }),
  /**
   * Course name search over the catalog — approved courses only.
   *
   * The query itself lives in `@/server/services/catalog`, shared with
   * `GET /v1/courses` so the two surfaces cannot resolve the same course
   * name differently. This procedure only re-projects into the shape its
   * existing clients read: `website` as `undefined` rather than `null`, and
   * the literal `approvalStatus` the catalog drops because it is constant.
   */
  searchCourses: publicProcedure
    .input(z.object({ query: z.string().min(1) }))
    .query(async ({ input }) => {
      const results = await searchCatalogCourses({ query: input.query });
      return results.map((course) => ({
        ...course,
        website: course.website ?? undefined,
        approvalStatus: "approved" as const,
      }));
    }),
});
