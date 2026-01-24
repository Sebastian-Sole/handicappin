import { z } from "zod";
import { createTRPCRouter, authedProcedure } from "@/server/api/trpc";
import { round, score, profile, teeInfo, course, hole } from "@/db/schema";
import { eq, and, lt, count } from "drizzle-orm";

import { db } from "@/db";
import { Scorecard, scorecardSchema } from "@/types/scorecard";
import {
  calculateAdjustedPlayedScore,
  calculateCourseHandicap,
  calculateScoreDifferential,
  calculateAdjustedGrossScore,
  calculateExpected9HoleDifferential,
  calculate9HoleScoreDifferential,
} from "@/lib/handicap";
import { getComprehensiveUserAccess } from "@/utils/billing/access-control";
import { TRPCError } from "@trpc/server";
import { FREE_TIER_ROUND_LIMIT } from "@/utils/billing/constants";

type RoundCalculations = {
  adjustedGrossScore: number;
  adjustedPlayedScore: number;
  scoreDifferential: number;
  courseHandicap: number;
  courseRatingUsed: number;
  slopeRatingUsed: number;
  holesPlayed: number;
};

const getRoundCalculations = (
  scorecard: Scorecard,
  handicapIndex: number,
  hasEstablishedHandicap: boolean = true
): RoundCalculations => {
  const { teePlayed, scores } = scorecard;

  if (!teePlayed.holes) {
    throw new Error("Tee played has no holes");
  }

  const numberOfHolesPlayed = scores.length;

  const courseHandicap = calculateCourseHandicap(
    handicapIndex,
    teePlayed,
    numberOfHolesPlayed
  );

  const adjustedPlayedScore = calculateAdjustedPlayedScore(
    teePlayed.holes,
    scores,
    hasEstablishedHandicap
  );

  const adjustedGrossScore = calculateAdjustedGrossScore(
    adjustedPlayedScore,
    courseHandicap,
    numberOfHolesPlayed,
    teePlayed.holes,
    scores
  );

  // Calculate score differential and determine ratings based on holes played
  // Per USGA Rule 5.1b, 9-hole rounds use 9-hole ratings and combine with expected differential
  let scoreDifferential: number;
  let courseRatingUsed: number;
  let slopeRatingUsed: number;

  if (numberOfHolesPlayed === 9) {
    // Use 9-hole (front9) ratings per USGA Rule 5.1b
    courseRatingUsed = teePlayed.courseRatingFront9;
    slopeRatingUsed = teePlayed.slopeRatingFront9;

    // Calculate expected differential for unplayed 9 holes
    const expectedDifferential = calculateExpected9HoleDifferential(
      handicapIndex,
      teePlayed.courseRatingFront9,
      teePlayed.slopeRatingFront9,
      teePlayed.outPar
    );

    // Calculate 18-hole equivalent differential
    scoreDifferential = calculate9HoleScoreDifferential(
      adjustedPlayedScore,
      teePlayed.courseRatingFront9,
      teePlayed.slopeRatingFront9,
      expectedDifferential
    );

  } else {
    // 18-hole calculation uses 18-hole ratings
    courseRatingUsed = teePlayed.courseRating18;
    slopeRatingUsed = teePlayed.slopeRating18;

    scoreDifferential = calculateScoreDifferential(
      adjustedGrossScore,
      courseRatingUsed,
      slopeRatingUsed
    );

  }

  return {
    adjustedGrossScore,
    adjustedPlayedScore,
    scoreDifferential,
    courseHandicap,
    courseRatingUsed,
    slopeRatingUsed,
    holesPlayed: numberOfHolesPlayed,
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
        .order("id", { ascending: false }) // Secondary sort by id for stable ordering
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

      // 0. Check user access (plan selected)
      const access = await getComprehensiveUserAccess(userId);

      // 0a. First check: Has user selected a plan?
      if (!access.hasAccess) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            "Please select a plan to continue. Visit the onboarding page to get started.",
        });
      }

      // 0b. Second check: Free tier round limit
      if (access.plan === "free" && access.remainingRounds <= 0) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `You've reached your free tier limit of ${FREE_TIER_ROUND_LIMIT} rounds. Please upgrade to continue tracking rounds.`,
        });
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
      }


      if (!courseId) {
        throw new Error("Course ID not found");
      }


      // 3. Handle tee
      let teeId = teePlayed.id;

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
      } else if (teePlayed.approvalStatus === "pending") {

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


        if (teeId === null) {
          throw new Error("Failed to insert tee");
        }

        // Insert holes if tee is pending
        if (teePlayed.holes) {
          const holeInserts = teePlayed.holes.map((h) => ({
            teeId: teeId!,
            holeNumber: h.holeNumber,
            par: h.par,
            hcp: h.hcp,
            distance: h.distance,
          }));

          await db.insert(hole).values(holeInserts);
        }
      }

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

      // Determine if player has an established handicap (USGA requires 3+ approved rounds)
      // Count approved rounds played BEFORE this round's tee time
      const roundTeeTime = new Date(teeTime);
      const roundsBeforeThis = await db
        .select({ count: count() })
        .from(round)
        .where(
          and(
            eq(round.userId, userId),
            lt(round.teeTime, roundTeeTime),
            eq(round.approvalStatus, "approved")
          )
        );
      const hasEstablishedHandicap = (roundsBeforeThis[0]?.count ?? 0) >= 3;

      const {
        adjustedGrossScore: tempAdjustedGrossScore,
        adjustedPlayedScore: tempAdjustedPlayedScore,
        scoreDifferential: tempScoreDifferential,
        courseHandicap: tempCourseHandicap,
        courseRatingUsed: tempCourseRatingUsed,
        slopeRatingUsed: tempSlopeRatingUsed,
        holesPlayed: tempHolesPlayed,
      } = getRoundCalculations(input, Number(userProfile[0].handicapIndex), hasEstablishedHandicap);


      if (!teeId) {
        throw new Error("Course or tee ID not found");
      }

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
        // Lock tee ratings at time of play - preserved even if tee data changes later
        // For 9-hole rounds, uses front9 ratings per USGA Rule 5.1b
        courseRatingUsed: tempCourseRatingUsed,
        slopeRatingUsed: tempSlopeRatingUsed,
        holesPlayed: tempHolesPlayed,
      };
      // 5. Insert round
      const [newRound] = await db.insert(round).values(roundInsert).returning();

      if (!newRound) {
        throw new Error("Failed to insert round");
      }
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

      // Race condition protection: re-check count for free tier users
      // This prevents parallel submissions from exceeding the limit
      if (access.plan === "free") {
        const { count, error: countError } = await ctx.supabase
          .from("round")
          .select("*", { count: "exact", head: true })
          .eq("userId", userId);

        if (countError) {
          console.error("Error re-checking round count:", countError);
          // Allow the submission - count check already passed pre-flight
        } else if (count && count > FREE_TIER_ROUND_LIMIT) {
          // User exceeded limit via race condition - rollback
          console.warn(
            `⚠️ Race condition detected: User ${userId} has ${count} rounds (limit: ${FREE_TIER_ROUND_LIMIT}). Rolling back round ${newRound.id}`
          );

          await db.delete(round).where(eq(round.id, newRound.id));

          throw new TRPCError({
            code: "FORBIDDEN",
            message:
              "Round limit exceeded due to concurrent submissions. Your submission was not saved. Please try again.",
          });
        }

      }

      return newRound;
    }),
});
