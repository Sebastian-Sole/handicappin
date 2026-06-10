import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../trpc";
import { db } from "@/db";
import { course } from "@/db/schema";
import { ilike, and, eq } from "drizzle-orm";

const courseQuery = z.object({
  userId: z.string(),
});

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
  getAllUserCourses: publicProcedure
    .input(courseQuery)
    .query(async ({ ctx, input }) => {
      const { userId } = input;
      const { data: courses, error } = await ctx.supabase
        .from("course")
        .select("*")
        .eq("userId", userId);
      if (error) {
        console.error(error);
        throw new Error("Error fetching courses");
      }
      return courses;
    }),
  searchCourses: publicProcedure
    .input(z.object({ query: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const searchQuery = `%${input.query}%`;
      const results = await db
        .select({
          id: course.id,
          name: course.name,
          approvalStatus: course.approvalStatus,
          country: course.country,
          city: course.city,
          website: course.website,
        })
        .from(course)
        .where(
          and(
            ilike(course.name, searchQuery),
            eq(course.approvalStatus, "approved")
          )
        )
        .limit(10);
      return results.map((course) => ({
        ...course,
        website: course.website ?? undefined,
        city: course.city,
        approvalStatus: "approved" as const,
      }));
    }),
});
