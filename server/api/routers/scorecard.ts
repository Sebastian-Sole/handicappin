import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, publicProcedure, authedProcedure } from "../trpc";
import { eq, inArray, asc, lt, count, and } from "drizzle-orm";
import { db } from "@/db";
import { course, round, teeInfo, hole, score } from "@/db/schema";
import { scorecardSchema, ScorecardWithRound } from "@/types/scorecard-input";
import { getBillingFromJWT } from "@/utils/supabase/jwt";
import { hasUnlimitedAccess } from "@/utils/billing/access";

export const scorecardRouter = createTRPCRouter({
  getScorecardByRoundId: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const { id } = input;

      // Convert id to number since round.id is a number in the schema
      const numericId = Number(id);
      if (isNaN(numericId)) {
        return null;
      }

      // 1. Fetch the round
      const roundResult = await db
        .select()
        .from(round)
        .where(eq(round.id, numericId));
      const roundData = roundResult[0];
      if (!roundData) return null;

      // 2. Fetch the course
      const courseResult = await db
        .select()
        .from(course)
        .where(eq(course.id, roundData.courseId));
      const courseData = courseResult[0];
      if (!courseData) return null;

      // 4. Fetch the tee played
      const teePlayedResult = await db
        .select()
        .from(teeInfo)
        .where(eq(teeInfo.id, roundData.teeId));
      const teePlayed = teePlayedResult[0];
      if (!teePlayed) return null;

      // 5. Fetch holes for the tee played
      const holes = await db
        .select()
        .from(hole)
        .where(eq(hole.teeId, teePlayed.id));

      // 6. Fetch scores for the round
      const scores = await db
        .select()
        .from(score)
        .where(eq(score.roundId, roundData.id));

      // 7. Count approved rounds played before this round's tee time (for determining established handicap)
      // Must match Edge Function logic which uses position in array of approved rounds only
      const roundsBeforeResult = await db
        .select({ count: count() })
        .from(round)
        .where(
          and(
            eq(round.userId, roundData.userId),
            lt(round.teeTime, roundData.teeTime),
            eq(round.approvalStatus, "approved")
          )
        );
      const roundsBeforeTeeTime = roundsBeforeResult[0]?.count ?? 0;

      // 8. Assemble the Scorecard object
      const scorecard: ScorecardWithRound = {
        userId: roundData.userId,
        course: {
          id: courseData.id,
          name: courseData.name,
          approvalStatus:
            courseData.approvalStatus === "approved" ? "approved" : "pending",
          tees: undefined,
          country: courseData.country,
          city: courseData.city,
        },
        teePlayed: {
          ...teePlayed,
          courseRating18: Number(teePlayed.courseRating18),
          courseRatingFront9: Number(teePlayed.courseRatingFront9),
          courseRatingBack9: Number(teePlayed.courseRatingBack9),
          approvalStatus:
            teePlayed.approvalStatus === "approved" ? "approved" : "pending",
          distanceMeasurement:
            teePlayed.distanceMeasurement === "meters" ? "meters" : "yards",
          gender: teePlayed.gender === "mens" ? "mens" : "ladies",
          holes: holes,
        },
        scores: scores,
        teeTime: roundData.teeTime.toISOString(),
        approvalStatus:
          roundData.approvalStatus === "approved" ? "approved" : "pending",
        notes: roundData.notes || undefined,
        round: {
          ...roundData,
          teeTime: roundData.teeTime.toISOString(),
          createdAt: roundData.createdAt.toISOString(),
        },
        roundsBeforeTeeTime,
      };

      // Validate with zod
      scorecardSchema.parse(scorecard);
      return scorecard;
    }),
  getAllScorecardsByUserId: authedProcedure
    .input(z.object({ userId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { userId } = input;

      // Verify the authenticated user can only access their own scorecards
      if (ctx.user.id !== userId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only access your own scorecards",
        });
      }

      // Defense-in-depth: Verify user has unlimited/lifetime plan
      // This endpoint powers /statistics and /dashboard which require unlimited access
      // Middleware handles page-level protection, but API calls could bypass it
      const { data: sessionData } = await ctx.supabase.auth.getSession();
      const billing = getBillingFromJWT(sessionData.session);
      if (!hasUnlimitedAccess(billing)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            "This feature requires an Unlimited or Lifetime plan. Please upgrade to access your full scorecard history.",
        });
      }

      // 1. Fetch all rounds for the user
      const rounds = await db
        .select()
        .from(round)
        .where(eq(round.userId, userId))
        .orderBy(asc(round.teeTime), asc(round.id)); // Order by teeTime, then id for stable ordering
      if (!rounds.length) return [];

      // 2. Fetch all courseIds, teeIds, roundIds
      const courseIds = Array.from(new Set(rounds.map((r) => r.courseId)));
      const teeIds = Array.from(new Set(rounds.map((r) => r.teeId)));
      const roundIds = rounds.map((r) => r.id);

      // 3. Fetch all related data in batches
      const [courses, tees, allHoles, allScores] = await Promise.all([
        db.select().from(course).where(inArray(course.id, courseIds)),
        db.select().from(teeInfo).where(inArray(teeInfo.id, teeIds)),
        db.select().from(hole).where(inArray(hole.teeId, teeIds)),
        db.select().from(score).where(inArray(score.roundId, roundIds)),
      ]);

      // 4. Assemble Scorecard objects
      const scorecards: ScorecardWithRound[] = rounds
        .map((roundData) => {
          const courseData = courses.find((c) => c.id === roundData.courseId);
          const teePlayed = tees.find((t) => t.id === roundData.teeId);
          if (!courseData || !teePlayed) return undefined;
          const holes = allHoles.filter((h) => h.teeId === teePlayed.id);
          const scores = allScores.filter((s) => s.roundId === roundData.id);
          return {
            userId: roundData.userId,
            course: {
              id: courseData.id,
              name: courseData.name,
              approvalStatus:
                courseData.approvalStatus === "approved"
                  ? "approved"
                  : "pending",
              tees: undefined,
              country: courseData.country,
              city: courseData.city,
            },
            teePlayed: {
              ...teePlayed,
              courseRating18: Number(teePlayed.courseRating18),
              courseRatingFront9: Number(teePlayed.courseRatingFront9),
              courseRatingBack9: Number(teePlayed.courseRatingBack9),
              approvalStatus:
                teePlayed.approvalStatus === "approved"
                  ? "approved"
                  : "pending",
              distanceMeasurement:
                teePlayed.distanceMeasurement === "meters" ? "meters" : "yards",
              gender: teePlayed.gender === "mens" ? "mens" : "ladies",
              holes: holes,
            },
            scores: scores,
            teeTime: roundData.teeTime.toISOString(),
            approvalStatus:
              roundData.approvalStatus === "approved" ? "approved" : "pending",
            notes: roundData.notes || undefined,
            round: {
              ...roundData,
              teeTime: roundData.teeTime.toISOString(),
              createdAt: roundData.createdAt.toISOString(),
              scoreDifferential:
                roundData.scoreDifferential == null
                  ? null
                  : Number(roundData.scoreDifferential),
              existingHandicapIndex:
                roundData.existingHandicapIndex == null
                  ? null
                  : Number(roundData.existingHandicapIndex),
              updatedHandicapIndex:
                roundData.updatedHandicapIndex == null
                  ? null
                  : Number(roundData.updatedHandicapIndex),
              exceptionalScoreAdjustment:
                roundData.exceptionalScoreAdjustment == null
                  ? null
                  : Number(roundData.exceptionalScoreAdjustment),
              courseRatingUsed:
                roundData.courseRatingUsed == null
                  ? null
                  : Number(roundData.courseRatingUsed),
            },
          };
        })
        .filter(Boolean) as ScorecardWithRound[];

      // Validate all with zod
      scorecards.forEach((scorecard) => scorecardSchema.parse(scorecard));
      return scorecards;
    }),
});
