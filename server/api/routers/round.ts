import {
  authedProcedure,
  createTRPCRouter,
  publicProcedure,
} from "@/server/api/trpc";
import { RoundWithCourse } from "@/types/database";
import { roundMutationSchema } from "@/types/round";
import { calculateHandicapIndex } from "@/utils/calculations/handicap";
import { calculateAdjustment } from "@/utils/round/addUtils";
import { flattenRoundWithCourse } from "@/utils/trpc/round";
import { z } from "zod";

export const roundRouter = createTRPCRouter({
  create: authedProcedure
    .input(roundMutationSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) {
        throw new Error("Unauthorized");
      }

      const {
        courseInfo,
        teeTime: date,
        holes,
        adjustedGrossScore,
        userId,
        existingHandicapIndex,
        totalStrokes,
        nineHolePar,
        eighteenHolePar,
      } = input;

      let { scoreDifferential, exceptionalScoreAdjustment } = input;

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

      let courseId = existingCourse?.id || null;

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

      const difference = existingHandicapIndex - scoreDifferential;
      const isExceptionalRound = difference >= 7;

      if (isExceptionalRound) {
        const adjustmentAmount = calculateAdjustment(difference);
        exceptionalScoreAdjustment =
          exceptionalScoreAdjustment - adjustmentAmount;
        scoreDifferential = scoreDifferential - adjustmentAmount;

        const { data: prevRoundsData, error: prevRoundsError } =
          await ctx.supabase
            .from("Round")
            .select("*")
            .eq("userId", userId)
            .range(0, 18);

        if (prevRoundsError) {
          throw new Error(
            `Error getting previous rounds: ${prevRoundsError.message}`
          );
        }

        // Update score differentials and adjustment for previous rounds
        prevRoundsData.forEach(async (round) => {
          const { error: updateRoundError } = await ctx.supabase
            .from("Round")
            .update({
              scoreDifferential: round.scoreDifferential - adjustmentAmount,
              adjustment: round.exceptionalScoreAdjustment - adjustmentAmount,
            })
            .eq("id", round.id);

          if (updateRoundError) {
            throw new Error(
              `Error updating previous rounds: ${updateRoundError.message}`
            );
          }
        });
      }

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

      const { data: roundsData, error: roundsError } = await ctx.supabase
        .from("Round")
        .select("*")
        .eq("userId", userId)
        .range(0, 19);

      if (roundsError) {
        throw new Error(`Error getting rounds: ${roundsError.message}`);
      }

      const scoreDifferentials = roundsData
        .sort(
          (a, b) =>
            new Date(b.teeTime).getTime() - new Date(a.teeTime).getTime()
        )
        .map((round) => round.scoreDifferential);

      const cappedDifferentials = scoreDifferentials.map((diff) =>
        diff > 54 ? 54 : diff
      );

      const handicapIndex = calculateHandicapIndex(cappedDifferentials);

      if (handicapIndex !== existingHandicapIndex) {
        const { error: updateError } = await ctx.supabase
          .from("Profile")
          .update({
            handicapIndex: handicapIndex,
          })
          .eq("id", userId);

        if (updateError) {
          throw new Error(
            `Error updating handicap index: ${updateError.message}`
          );
        }

        // Add new handicap index to the added round
        const { error: updateRoundError } = await ctx.supabase
          .from("Round")
          .update({
            updatedHandicapIndex: handicapIndex,
          })
          .eq("id", roundId);

        if (updateRoundError) {
          throw new Error(
            `Error updating round with new handicap index: ${updateRoundError.message}`
          );
        }
      }

      return {
        message: "Round and holes inserted successfully",
        roundId: roundId,
      };
    }),
  getAllByUserId: publicProcedure
    .input(
      z.object({
        userId: z.string().uuid(),
        startIndex: z.number().int().optional().default(0),
        amount: z.number().int().optional().default(Number.MAX_SAFE_INTEGER),
      })
    )
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
        .eq("userId", input.userId)
        .range(input.startIndex, input.startIndex + input.amount - 1);

      if (error) {
        console.log(error);
        throw new Error(`Error getting rounds: ${error.message}`);
      }

      const roundsWithCourse = rounds
        .map((round) => {
          return flattenRoundWithCourse(round, round.Course);
        })
        .filter((round): round is RoundWithCourse => round !== null);

      return roundsWithCourse;
    }),
  getRound: publicProcedure
    .input(z.object({ roundId: z.string() }))
    .query(async ({ ctx, input }) => {
      const { data: round, error } = await ctx.supabase
        .from("Round")
        .select(`*, Course (*)`)
        .eq("id", input.roundId)
        .single();

      if (error) {
        console.log(error);
        throw new Error(`Error getting round: ${error.message}`);
      }

      const roundWithCourse = flattenRoundWithCourse(round, round.Course);

      return roundWithCourse;
    }),
});
