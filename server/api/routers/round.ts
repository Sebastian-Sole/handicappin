import { z } from "zod";
import { createTRPCRouter, authedProcedure } from "@/server/api/trpc";
import { round, score, profile, teeInfo, course, hole } from "@/db/schema";
import { eq, and } from "drizzle-orm";

import { db } from "@/db";
import { Scorecard, scorecardSchema } from "@/types/scorecard";
import {
  calculateAdjustedPlayedScore,
  calculateCourseHandicap,
  calculateScoreDifferential,
  calculateAdjustedGrossScore,
} from "@/utils/calculations/handicap";

type RoundCalculations = {
  adjustedGrossScore: number;
  adjustedPlayedScore: number;
  scoreDifferential: number;
  courseHandicap: number;
};

const getRoundCalculations = (
  scorecard: Scorecard,
  handicapIndex: number
): RoundCalculations => {
  const { teePlayed, scores } = scorecard;

  if (!teePlayed.holes) {
    throw new Error("Tee played has no holes");
  }

  const numberOfHolesPlayed = scores.length;

  console.log("Calculating course handicap");
  const courseHandicap = calculateCourseHandicap(
    handicapIndex,
    teePlayed,
    numberOfHolesPlayed
  );

  console.log("Course handicap calculated");
  console.log("Calculating adjusted played score");

  const adjustedPlayedScore = calculateAdjustedPlayedScore(
    teePlayed.holes,
    scores
  );

  console.log("Adjusted played score calculated");
  console.log("Calculating adjusted gross score");

  const adjustedGrossScore = calculateAdjustedGrossScore(
    adjustedPlayedScore,
    courseHandicap,
    numberOfHolesPlayed,
    teePlayed
  );

  console.log("Adjusted gross score calculated");
  console.log("Calculating score differential");

  const scoreDifferential = calculateScoreDifferential(
    adjustedGrossScore,
    teePlayed.courseRating18,
    teePlayed.slopeRating18
  );

  console.log("Score differential calculated: ", scoreDifferential);

  return {
    adjustedGrossScore,
    adjustedPlayedScore,
    scoreDifferential,
    courseHandicap,
  };
};

// This type matches exactly what Drizzle expects for an insert
type TeeInfoInsert = typeof teeInfo.$inferInsert;
type RoundInsert = typeof round.$inferInsert;

export const roundRouter = createTRPCRouter({
  getAllByUserId: authedProcedure
    .input(
      z.object({
        userId: z.string().uuid(),
        startIndex: z.number().int().optional().default(0),
        amount: z.number().int().optional().default(Number.MAX_SAFE_INTEGER),
      })
    )
    .query(async ({ ctx, input }) => {
      const { data: rounds, error } = await ctx.supabase
        .from("round")
        .select(`*`)
        .eq("userId", input.userId)
        .order("teeTime", { ascending: false }) // Order by teeTime in descending order
        .range(input.startIndex, input.startIndex + input.amount - 1);

      if (error) {
        console.log(error);
        throw new Error(`Error getting rounds: ${error.message}`);
      }

      return rounds;

      // const roundsWithCourse = rounds
      //   .map((round) => {
      //     return flattenRoundWithCourse(round, round.course);
      //   })
      //   .filter((round): round is RoundWithCourseAndTee => round !== null);

      // return roundsWithCourse;
    }),
  getRoundById: authedProcedure
    .input(z.object({ roundId: z.number() }))
    .query(async ({ ctx, input }) => {
      const { data: round, error } = await ctx.supabase
        .from("round")
        .select(`*`)
        .eq("id", input.roundId)
        .single();

      if (error) {
        console.log(error);
        throw new Error(`Error getting round: ${error.message}`);
      }

      return round;
    }),
  getBestRound: authedProcedure
    .input(
      z.object({
        userId: z.string().uuid(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { data: round, error } = await ctx.supabase
        .from("round")
        .select("*")
        .eq("userId", input.userId)
        .order("scoreDifferential", { ascending: true })
        .limit(1)
        .single();

      if (error) {
        console.log(error);
        return null;
      }
      return round;
    }),
  submitScorecard: authedProcedure
    .input(scorecardSchema)
    .mutation(async ({ ctx, input }) => {
      const {
        teePlayed,
        scores,
        notes,
        approvalStatus,
        course: coursePlayed,
        teeTime,
        userId,
      } = input;

      if (!teePlayed.holes) {
        throw new Error("Tee played has no holes");
      }

      // 1. Get user profile for handicap calculations
      const userProfile = await db
        .select()
        .from(profile)
        .where(eq(profile.id, userId))
        .limit(1);

      if (!userProfile[0]) {
        throw new Error("User profile not found");
      }

      console.log("User profile found");

      // 2. Handle course
      let courseId = coursePlayed.id;

      // First, try to find existing course by name
      const existingCourse = await db
        .select()
        .from(course)
        .where(eq(course.name, coursePlayed.name))
        .limit(1);

      if (existingCourse[0]) {
        // Course already exists, use its ID
        courseId = existingCourse[0].id;
        console.log("Using existing course", courseId);
      } else if (coursePlayed.approvalStatus === "pending") {
        // Course doesn't exist and is pending, insert new one
        const [newCourse] = await db
          .insert(course)
          .values({
            name: coursePlayed.name,
            approvalStatus: "pending",
            country: coursePlayed.country,
            city: coursePlayed.city,
            website: coursePlayed.website,
          })
          .returning();
        courseId = newCourse.id;
        console.log("Inserted new course", courseId);
      }

      console.log("Course ID found", courseId);

      if (!courseId) {
        throw new Error("Course ID not found");
      }

      console.log("Course ID found", courseId);

      // 3. Handle tee
      let teeId = teePlayed.id;
      console.log("Tee ID", teeId);

      // First, try to find existing tee by name and course
      const existingTee = await db
        .select()
        .from(teeInfo)
        .where(
          and(
            eq(teeInfo.courseId, courseId),
            eq(teeInfo.name, teePlayed.name),
            eq(teeInfo.gender, teePlayed.gender)
          )
        )
        .limit(1);

      if (existingTee[0]) {
        // Tee already exists, use its ID
        teeId = existingTee[0].id;
        console.log("Using existing tee", teeId);
      } else if (teePlayed.approvalStatus === "pending") {
        console.log("Inserting tee");
        // Tee doesn't exist and is pending, insert new one
        console.log(teePlayed);

        const teeInsert: TeeInfoInsert = {
          courseId: courseId!,
          name: teePlayed.name,
          gender: teePlayed.gender,
          courseRating18: teePlayed.courseRating18,
          slopeRating18: teePlayed.slopeRating18,
          courseRatingFront9: teePlayed.courseRatingFront9,
          slopeRatingFront9: teePlayed.slopeRatingFront9,
          courseRatingBack9: teePlayed.courseRatingBack9,
          slopeRatingBack9: teePlayed.slopeRatingBack9,
          outPar: teePlayed.outPar,
          inPar: teePlayed.inPar,
          totalPar: teePlayed.totalPar,
          outDistance: teePlayed.outDistance,
          inDistance: teePlayed.inDistance,
          totalDistance: teePlayed.totalDistance,
          distanceMeasurement: teePlayed.distanceMeasurement,
          approvalStatus: "pending",
          // isArchived and version are optional (defaulted in schema)
        };

        const [newTee] = await db.insert(teeInfo).values(teeInsert).returning();
        teeId = newTee.id;

        console.log("Tee inserted", teeId);

        if (teeId === null) {
          throw new Error("Failed to insert tee");
        }

        // Insert holes if tee is pending
        if (teePlayed.holes) {
          console.log("Inserting holes");
          const holeInserts = teePlayed.holes.map((h) => ({
            teeId: teeId!,
            holeNumber: h.holeNumber,
            par: h.par,
            hcp: h.hcp,
            distance: h.distance,
          }));

          await db.insert(hole).values(holeInserts);
          console.log("Holes inserted");
        }
      }

      console.log("Calculating round calculations");

      // Match scores with holes to calculate the par played
      let parPlayed = 0;
      if (teePlayed.holes && Array.isArray(scores)) {
        // Create a map of holeNumber to par for quick lookup
        const holeParMap = new Map<number, number>();
        teePlayed.holes.forEach((h) => {
          holeParMap.set(h.holeNumber, h.par);
        });

        // For each score, find the corresponding hole's par and sum
        parPlayed = scores.reduce((sum, score, idx) => {
          // Assume scores are in order of holeNumber (1-based)
          const holeNumber = idx + 1;
          const par = holeParMap.get(holeNumber) ?? 0;
          return sum + par;
        }, 0);
      }

      const {
        adjustedGrossScore: tempAdjustedGrossScore,
        adjustedPlayedScore: tempAdjustedPlayedScore,
        scoreDifferential: tempScoreDifferential,
        courseHandicap: tempCourseHandicap,
      } = getRoundCalculations(input, Number(userProfile[0].handicapIndex));

      console.log("Round calculations calculated");

      if (!teeId) {
        throw new Error("Course or tee ID not found");
      }

      console.log("Inserting round");

      const roundInsert: RoundInsert = {
        userId: userId,
        courseId: courseId,
        teeId: teeId,
        teeTime: new Date(teeTime),
        existingHandicapIndex: userProfile[0].handicapIndex,
        updatedHandicapIndex: userProfile[0].handicapIndex,
        scoreDifferential: tempScoreDifferential,
        totalStrokes: scores.reduce((sum, score) => sum + score.strokes, 0),
        adjustedGrossScore: tempAdjustedGrossScore,
        adjustedPlayedScore: tempAdjustedPlayedScore,
        parPlayed: parPlayed,
        notes,
        exceptionalScoreAdjustment: 0,
        courseHandicap: tempCourseHandicap,
        approvalStatus,
      };

      console.log("Round insert", roundInsert);

      // 5. Insert round
      const [newRound] = await db.insert(round).values(roundInsert).returning();

      console.log("Round inserted", newRound);

      if (!newRound) {
        throw new Error("Failed to insert round");
      }

      console.log("Inserting scores");

      // Get the actual hole IDs from the database
      const dbHoles = await db
        .select()
        .from(hole)
        .where(eq(hole.teeId, teeId))
        .orderBy(hole.holeNumber);

      // Validate that we have enough holes in the database
      if (dbHoles.length < scores.length) {
        throw new Error(
          `Expected at least ${scores.length} holes but found ${dbHoles.length} in database`
        );
      }

      // For 9-hole rounds, only use the first 9 holes from the database
      // For 18-hole rounds, use all 18 holes
      const holesToUse = dbHoles.slice(0, scores.length);

      // Create score inserts with the correct holeIds from database
      const scoreInserts = scores.map((score, index) => ({
        userId,
        roundId: newRound.id,
        holeId: holesToUse[index].id,
        strokes: score.strokes,
        hcpStrokes: score.hcpStrokes, // Will be updated by the trigger
      }));

      await db.insert(score).values(scoreInserts);

      console.log("Scores inserted");

      return newRound;
    }),
});
