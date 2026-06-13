import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and, asc, inArray } from "drizzle-orm";
import { createTRPCRouter, authedProcedure } from "../trpc";
import { db } from "@/db";
import { course, round, teeInfo, hole, score } from "@/db/schema";
import { getComprehensiveUserAccess } from "@/utils/billing/access-control";

type ScoringBucket = "eagleOrBetter" | "birdie" | "par" | "bogey" | "doubleOrWorse";

const bucketFor = (strokes: number, par: number): ScoringBucket => {
  const diff = strokes - par;
  if (diff <= -2) return "eagleOrBetter";
  if (diff === -1) return "birdie";
  if (diff === 0) return "par";
  if (diff === 1) return "bogey";
  return "doubleOrWorse";
};

const emptyDistribution = () => ({
  eagleOrBetter: 0,
  birdie: 0,
  par: 0,
  bogey: 0,
  doubleOrWorse: 0,
});

export const statsRouter = createTRPCRouter({
  getCourseDetail: authedProcedure
    .input(z.object({ courseId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const { courseId } = input;
      const userId = ctx.user.id;

      // Gate on plan — mirrors scorecard.getAllScorecardsByUserId.
      const access = await getComprehensiveUserAccess(userId, ctx.supabase);
      if (
        !access.hasAccess ||
        (access.plan !== "unlimited" && access.plan !== "lifetime")
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            "This feature requires an Unlimited or Lifetime plan. Please upgrade to access course statistics.",
        });
      }

      const [courseRow] = await db
        .select()
        .from(course)
        .where(eq(course.id, courseId));
      if (!courseRow) return null;

      const rounds = await db
        .select()
        .from(round)
        .where(and(eq(round.userId, userId), eq(round.courseId, courseId)))
        .orderBy(asc(round.teeTime));

      if (rounds.length === 0) {
        return {
          course: {
            id: courseRow.id,
            name: courseRow.name,
            city: courseRow.city,
            country: courseRow.country,
          },
          summary: {
            roundCount: 0,
            avgScore: null,
            avgDifferential: null,
            bestDifferential: null,
            worstDifferential: null,
          },
          rounds: [] as Array<{
            id: number;
            teeTime: string;
            totalStrokes: number;
            parPlayed: number;
            scoreDifferential: number;
            holesPlayed: number;
            nineHoleSection: "front" | "back" | null;
            teeName: string;
          }>,
          holes: [] as Array<{
            holeNumber: number;
            par: number;
            playCount: number;
            avgStrokes: number;
            avgVsPar: number;
            best: number;
            worst: number;
            distribution: ReturnType<typeof emptyDistribution>;
          }>,
        };
      }

      const roundIds = rounds.map((r) => r.id);
      const teeIds = Array.from(new Set(rounds.map((r) => r.teeId)));

      const [scores, holes, tees] = await Promise.all([
        db.select().from(score).where(inArray(score.roundId, roundIds)),
        db.select().from(hole).where(inArray(hole.teeId, teeIds)),
        db.select().from(teeInfo).where(inArray(teeInfo.id, teeIds)),
      ]);

      const holeById = new Map(holes.map((h) => [h.id, h]));
      const teeById = new Map(tees.map((t) => [t.id, t]));

      // Aggregate by holeNumber (across tees, since the same hole on a course
      // has the same identity even when played from different tees).
      type Agg = {
        holeNumber: number;
        strokes: number[];
        vsPar: number[];
        parCounts: Map<number, number>;
        distribution: ReturnType<typeof emptyDistribution>;
      };
      const aggByHoleNumber = new Map<number, Agg>();

      for (const s of scores) {
        const h = holeById.get(s.holeId);
        if (!h) continue;
        const existing = aggByHoleNumber.get(h.holeNumber) ?? {
          holeNumber: h.holeNumber,
          strokes: [],
          vsPar: [],
          parCounts: new Map<number, number>(),
          distribution: emptyDistribution(),
        };
        existing.strokes.push(s.strokes);
        existing.vsPar.push(s.strokes - h.par);
        existing.parCounts.set(h.par, (existing.parCounts.get(h.par) ?? 0) + 1);
        existing.distribution[bucketFor(s.strokes, h.par)] += 1;
        aggByHoleNumber.set(h.holeNumber, existing);
      }

      const holeStats = Array.from(aggByHoleNumber.values())
        .map((agg) => {
          // Use the most common par at this hole across the user's plays.
          let mostCommonPar = 0;
          let bestCount = -1;
          for (const [par, n] of agg.parCounts) {
            if (n > bestCount) {
              bestCount = n;
              mostCommonPar = par;
            }
          }
          const sum = agg.strokes.reduce((a, b) => a + b, 0);
          const vsParSum = agg.vsPar.reduce((a, b) => a + b, 0);
          return {
            holeNumber: agg.holeNumber,
            par: mostCommonPar,
            playCount: agg.strokes.length,
            avgStrokes: sum / agg.strokes.length,
            avgVsPar: vsParSum / agg.vsPar.length,
            best: Math.min(...agg.strokes),
            worst: Math.max(...agg.strokes),
            distribution: agg.distribution,
          };
        })
        .sort((a, b) => a.holeNumber - b.holeNumber);

      const diffs = rounds.map((r) => Number(r.scoreDifferential));
      const totals = rounds.map((r) => r.totalStrokes);

      return {
        course: {
          id: courseRow.id,
          name: courseRow.name,
          city: courseRow.city,
          country: courseRow.country,
        },
        summary: {
          roundCount: rounds.length,
          avgScore: totals.reduce((a, b) => a + b, 0) / totals.length,
          avgDifferential: diffs.reduce((a, b) => a + b, 0) / diffs.length,
          bestDifferential: Math.min(...diffs),
          worstDifferential: Math.max(...diffs),
        },
        rounds: rounds.map((r) => ({
          id: r.id,
          teeTime: r.teeTime.toISOString(),
          totalStrokes: r.totalStrokes,
          parPlayed: r.parPlayed,
          scoreDifferential: Number(r.scoreDifferential),
          holesPlayed: r.holesPlayed,
          nineHoleSection: r.nineHoleSection,
          teeName: teeById.get(r.teeId)?.name ?? "—",
        })),
        holes: holeStats,
      };
    }),
});
