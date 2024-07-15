import {
  authedProcedure,
  createTRPCRouter,
  publicProcedure,
} from "@/server/api/trpc";
import { RoundWithCourse } from "@/types/database";
import { addRoundFormSchema, roundMutationSchema } from "@/types/round";
import { Tables } from "@/types/supabase";
import { z } from "zod";

export const roundRouter = createTRPCRouter({
  create: authedProcedure
    .input(roundMutationSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) {
        throw new Error("Unauthorized");
      }
      console.log("Starting round creation");

      const {
        courseInfo,
        teeTime: date,
        holes,
        adjustedGrossScore,
        userId,
        existingHandicapIndex,
        scoreDifferential,
        totalStrokes,
        adjustedPlayedScore,
        courseRating,
        slopeRating,
        nineHolePar,
        eighteenHolePar,
      } = input;

      const { data: existingCourse, error: existingCourseError } =
        await ctx.supabase
          .from("Course")
          .select("id")
          .eq("name", courseInfo.location)
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
              courseRating: courseInfo.courseRating,
              slopeRating: courseInfo.slope,
              name: courseInfo.location,
              eighteenHolePar,
              nineHolePar,
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
            userId: userId,
            courseId: courseId,
            adjustedGrossScore: adjustedGrossScore,
            scoreDifferential: scoreDifferential,
            totalStrokes: totalStrokes,
            existingHandicapIndex: existingHandicapIndex,
            teeTime: date.toISOString(),
            parPlayed: courseInfo.par,
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
        userId: userId,
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
  getAllByUserId: publicProcedure
    .input(z.string().uuid())
    .query(async ({ ctx, input }) => {
      const { data: rounds, error } = await ctx.supabase
        .from("Round")
        .select(
          `
    *,
    Course (
      *
    )
  `
        )
        .eq("userId", input);

      if (error) {
        throw new Error(`Error getting rounds: ${error.message}`);
      }

      const flattenRoundWithCourse = (
        round: Tables<"Round">,
        course: Tables<"Course"> | null
      ): RoundWithCourse | null => {
        if (course) {
          return {
            ...round,
            courseName: course.name,
            courseRating: course.courseRating,
            courseSlope: course.slopeRating,
            courseEighteenHolePar: course.eighteenHolePar,
            courseNineHolePar: course.nineHolePar,
          };
        }
        return null;
      };

      const roundsWithCourse = rounds
        .map((round) => {
          return flattenRoundWithCourse(round, round.Course);
        })
        .filter((round): round is RoundWithCourse => round !== null);

      return roundsWithCourse;
    }),
});
