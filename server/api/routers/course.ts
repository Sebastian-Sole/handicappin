import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../trpc";
import { db } from "@/db";
import { course } from "@/db/schema";
import { like, and, eq } from "drizzle-orm";

const courseQuery = z.object({
  userId: z.string(),
});

export const courseRouter = createTRPCRouter({
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
        })
        .from(course)
        .where(
          and(
            like(course.name, searchQuery),
            eq(course.approvalStatus, "approved")
          )
        )
        .limit(10);
      console.log(results);
      return results.map((course) => ({
        ...course,
        approvalStatus: "approved" as const,
      }));
    }),
});
