import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../trpc";

const courseQuery = z.object({
  userId: z.string(),
});

export const roundRouter = createTRPCRouter({
  getAllUserCourses: publicProcedure
    .input(courseQuery)
    .query(async ({ ctx, input }) => {
      const { userId } = input;
      const { data: courses, error } = await ctx.supabase
        .from("Course")
        .select("*")
        .eq("userId", userId);
      if (error) {
        console.error(error);
        throw new Error("Error fetching courses");
      }
      return courses;
    }),
});
