import { z } from "zod";
import { createTRPCRouter, authedProcedure } from "@/server/api/trpc";
import { round, score, profile, teeInfo, course, hole } from "@/db/schema";
import { eq, and, lt, count } from "drizzle-orm";
import * as Sentry from "@sentry/nextjs";

import { db } from "@/db";
import { Scorecard, scorecardSchema } from "@/types/scorecard-input";
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

// Exported input schemas for testing and reuse
export const getAllByUserIdInputSchema = z.object({
  userId: z.string().uuid(),
  startIndex: z.number().int().optional().default(0),
  amount: z.number().int().optional().default(Number.MAX_SAFE_INTEGER),
});

export const getCountByUserIdInputSchema = z.object({
  userId: z.string().uuid(),
});

export const getRoundByIdInputSchema = z.object({
  roundId: z.number(),
});

export const getBestRoundInputSchema = z.object({
  userId: z.string().uuid(),
});

export const roundRouter = createTRPCRouter({
  getAllByUserId: authedProcedure
    .input(getAllByUserIdInputSchema)
    .query(async ({ ctx, input }) => {
      const { data: rounds, error } = await ctx.supabase
        .from("round")
        .select(`*`)
        .eq("userId", input.userId)
        .order("teeTime", { ascending: false }) // Order by teeTime in descending order
        .order("id", { ascending: false }) // Secondary sort by id for stable ordering
        .range(input.startIndex, input.startIndex + input.amount - 1);

      if (error) {
        Sentry.captureException(error, {
          tags: { procedure: "getRounds" },
          extra: { userId: input.userId },
        });
        throw new Error(`Error getting rounds: ${error.message}`);
      }

      return rounds;
    }),
  getCountByUserId: authedProcedure
    .input(getCountByUserIdInputSchema)
    .query(async ({ ctx, input }) => {
      const { count, error } = await ctx.supabase
        .from("round")
        .select("*", { count: "exact", head: true })
        .eq("userId", input.userId);

      if (error) {
        Sentry.captureException(error, {
          tags: { procedure: "getCountByUserId" },
          extra: { userId: input.userId },
        });
        throw new Error(`Error getting round count: ${error.message}`);
      }

      return count ?? 0;
    }),
  getRoundById: authedProcedure
    .input(getRoundByIdInputSchema)
    .query(async ({ ctx, input }) => {
      const { data: round, error } = await ctx.supabase
        .from("round")
        .select(`*`)
        .eq("id", input.roundId)
        .single();

      if (error) {
        Sentry.captureException(error, {
          tags: { procedure: "getRoundById" },
          extra: { roundId: input.roundId },
        });
        throw new Error(`Error getting round: ${error.message}`);
      }

      return round;
    }),
  getBestRound: authedProcedure
    .input(getBestRoundInputSchema)
    .query(async ({ ctx, input }) => {
      const { data: round, error } = await ctx.supabase
        .from("round")
        .select("*")
        .eq("userId", input.userId)
        .order("scoreDifferential", { ascending: true })
        .limit(1)
        .single();

      if (error) {
        Sentry.captureException(error, {
          tags: { procedure: "getBestRound" },
          extra: { userId: input.userId },
        });
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



      // Wrap all database mutations in a transaction so partial failures roll back
      const newRound = await db.transaction(async (tx) => {
        // 1. Get user profile for handicap calculations
        const userProfile = await tx
          .select()
          .from(profile)
          .where(eq(profile.id, userId))
          .limit(1);

        if (!userProfile[0]) {
          throw new Error("User profile not found");
        }

        // 2. Handle course
        let courseId = coursePlayed.id;

        const existingCourse = await tx
          .select()
          .from(course)
          .where(eq(course.name, coursePlayed.name))
          .limit(1);

        if (existingCourse[0]) {
          courseId = existingCourse[0].id;
        } else if (coursePlayed.approvalStatus === "pending") {
          const [newCourse] = await tx
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

        const existingTee = await tx
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
          teeId = existingTee[0].id;
        } else if (teePlayed.id && teePlayed.approvalStatus === "approved") {
          const teeById = await tx
            .select()
            .from(teeInfo)
            .where(eq(teeInfo.id, teePlayed.id))
            .limit(1);

          if (teeById[0]) {
            teeId = teeById[0].id;
          } else {
            throw new Error(`Approved tee with ID ${teePlayed.id} not found in database`);
          }
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
          };

          const [newTee] = await tx.insert(teeInfo).values(teeInsert).returning();
          teeId = newTee.id;

          if (teeId === null) {
            throw new Error("Failed to insert tee");
          }

          if (teePlayed.holes) {
            const holeInserts = teePlayed.holes.map((h) => ({
              teeId: teeId!,
              holeNumber: h.holeNumber,
              par: h.par,
              hcp: h.hcp,
              distance: h.distance,
            }));

            await tx.insert(hole).values(holeInserts);
          }
        }

        // 4. Persist additional tees from the course (not the played tee)
        if (coursePlayed.tees && coursePlayed.tees.length > 1) {
          for (const additionalTee of coursePlayed.tees) {
            if (
              additionalTee.name === teePlayed.name &&
              additionalTee.gender === teePlayed.gender
            ) {
              continue;
            }

            const existingAdditionalTee = await tx
              .select()
              .from(teeInfo)
              .where(
                and(
                  eq(teeInfo.courseId, courseId!),
                  eq(teeInfo.name, additionalTee.name),
                  eq(teeInfo.gender, additionalTee.gender),
                ),
              )
              .limit(1);

            if (existingAdditionalTee[0]) {
              continue;
            }

            const [newAdditionalTee] = await tx
              .insert(teeInfo)
              .values({
                courseId: courseId!,
                name: additionalTee.name,
                gender: additionalTee.gender,
                courseRating18: additionalTee.courseRating18,
                slopeRating18: additionalTee.slopeRating18,
                courseRatingFront9: additionalTee.courseRatingFront9,
                slopeRatingFront9: additionalTee.slopeRatingFront9,
                courseRatingBack9: additionalTee.courseRatingBack9,
                slopeRatingBack9: additionalTee.slopeRatingBack9,
                outPar: additionalTee.outPar,
                inPar: additionalTee.inPar,
                totalPar: additionalTee.totalPar,
                outDistance: additionalTee.outDistance,
                inDistance: additionalTee.inDistance,
                totalDistance: additionalTee.totalDistance,
                distanceMeasurement: additionalTee.distanceMeasurement,
                approvalStatus: "pending",
              })
              .returning();

            if (additionalTee.holes && newAdditionalTee) {
              const additionalHoleInserts = additionalTee.holes.map((h) => ({
                teeId: newAdditionalTee.id,
                holeNumber: h.holeNumber,
                par: h.par,
                hcp: h.hcp,
                distance: h.distance,
              }));

              await tx.insert(hole).values(additionalHoleInserts);
            }
          }
        }

        // Match scores with holes to calculate the par played
        let parPlayed = 0;
        if (teePlayed.holes && Array.isArray(scores)) {
          const holeParMap = new Map<number, number>();
          teePlayed.holes.forEach((h) => {
            holeParMap.set(h.holeNumber, h.par);
          });

          parPlayed = scores.reduce((sum, score, idx) => {
            const holeNumber = idx + 1;
            const par = holeParMap.get(holeNumber) ?? 0;
            return sum + par;
          }, 0);
        }

        // Determine if player has an established handicap (USGA requires 3+ approved rounds)
        const roundTeeTime = new Date(teeTime);
        const roundsBeforeThis = await tx
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
          courseRatingUsed: tempCourseRatingUsed,
          slopeRatingUsed: tempSlopeRatingUsed,
          holesPlayed: tempHolesPlayed,
        };

        // 5. Insert round
        const [insertedRound] = await tx.insert(round).values(roundInsert).returning();

        if (!insertedRound) {
          throw new Error("Failed to insert round");
        }

        // Get the actual hole IDs from the database
        const dbHoles = await tx
          .select()
          .from(hole)
          .where(eq(hole.teeId, teeId))
          .orderBy(hole.holeNumber);

        if (dbHoles.length < scores.length) {
          throw new Error(
            `Expected at least ${scores.length} holes but found ${dbHoles.length} in database`
          );
        }

        const holesToUse = dbHoles.slice(0, scores.length);

        const scoreInserts = scores.map((score, index) => ({
          userId,
          roundId: insertedRound.id,
          holeId: holesToUse[index].id,
          strokes: score.strokes,
          hcpStrokes: score.hcpStrokes,
        }));

        await tx.insert(score).values(scoreInserts);

        return insertedRound;
      });

      // Race condition protection: re-check count for free tier users
      // This runs outside the transaction since it uses the Supabase REST API
      if (access.plan === "free") {
        const { count, error: countError } = await ctx.supabase
          .from("round")
          .select("*", { count: "exact", head: true })
          .eq("userId", userId);

        if (countError) {
          console.error("Error re-checking round count:", countError);
        } else if (count && count > FREE_TIER_ROUND_LIMIT) {
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
