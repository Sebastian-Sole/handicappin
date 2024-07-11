import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { roundSchema } from "@/types/round";

export const roundRouter = createTRPCRouter({
  create: publicProcedure
    .input(roundSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) {
        throw new Error("Unauthorized");
      }

      console.log("Starting round creation");

      const { courseInfo, date, holes, location, score, userId } = input;

      // Create course

      // Check if course exists by name
      const { data: existingCourse, error: existingCourseError } =
        await ctx.supabase
          .from("Course")
          .select("id")
          .eq("name", location)
          .maybeSingle();

      if (existingCourseError) {
        console.log(existingCourseError);
        throw new Error(
          `Error checking if course exists: ${existingCourseError.message}`
        );
      }

      console.log("Course exists: ", existingCourse);

      // If course exists, use existing course id
      let courseId = existingCourse?.id || null;

      // If course does not exist, create new course
      if (!courseId) {
        const { data: course, error: courseError } = await ctx.supabase
          .from("Course")
          .insert([
            {
              par: courseInfo.par,
              courseRating: courseInfo.courseRating,
              slopeRating: courseInfo.slope,
              name: location,
            },
          ])
          .select("id")
          .single();

        if (courseError) {
          throw new Error(`Error inserting course: ${courseError.message}`);
        }

        courseId = course.id;
      }

      // Add data to database for holes and round with corresponding ids
      // Step 1: Insert round data and get the round ID
      const { data: round, error: roundError } = await ctx.supabase
        .from("Round")
        .insert([
          {
            courseId: courseId,
            score: score,
            userId: userId,
            teeTime: date.toDateString(),
          },
        ])
        .select("id")
        .single();

      if (roundError) {
        throw new Error(`Error inserting round: ${roundError.message}`);
      }

      const roundId = round.id;

      // Step 2: Insert holes data with the retrieved round ID
      const holesData = holes.map((hole) => ({
        par: hole.par,
        holeNumber: hole.holeNumber,
        hcp: hole.hcp,
        strokes: hole.strokes,
        roundId: roundId,
      }));

      const { error: holesError } = await ctx.supabase
        .from("Hole")
        .insert(holesData);

      if (holesError) {
        throw new Error(`Error inserting holes: ${holesError.message}`);
      }

      return {
        message: "Round and holes inserted successfully",
        roundId: roundId,
      };
    }),
});
