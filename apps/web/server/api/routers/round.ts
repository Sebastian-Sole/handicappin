import { z } from "zod";
import { createTRPCRouter, authedProcedure } from "@/server/api/trpc";
import * as Sentry from "@sentry/nextjs";

import { db } from "@/db";
import { scorecardSchema } from "@/types/scorecard-input";
import { getComprehensiveUserAccess } from "@/utils/billing/access-control";
import { TRPCError } from "@trpc/server";
import { logger } from "@/lib/logging";
import { sendAdminSubmissionNotification } from "@/lib/email-service";
import { getPostHogClient } from "@/lib/posthog";
import {
  submitScorecard,
  DuplicateRoundError,
  PlanNotSelectedError,
  RoundLimitRaceError,
  RoundLimitReachedError,
  SelfSubmissionError,
} from "@/server/services/scorecard";

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

export interface MySubmission {
  id: number;
  submissionType: "new_course" | "new_tee" | "tee_edit";
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  resolvedAt: string | null;
  rejectionReason: string | null;
  courseId: number | null;
  courseName: string | null;
  teeId: number | null;
  teeName: string | null;
}

export const roundRouter = createTRPCRouter({
  getAllByUserId: authedProcedure
    .input(getAllByUserIdInputSchema)
    .query(async ({ ctx, input }) => {
      if (input.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Cannot access another user's data",
        });
      }
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
      if (input.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Cannot access another user's data",
        });
      }
      // Billing-facing count: native consumes this as its quota gate and the
      // homepage as totalRounds. Quarantined rounds (accept-and-quarantine,
      // subplan 003) never consume quota, so exclude them here exactly like
      // the free-tier count in `utils/billing/access-control.ts`.
      const { count, error } = await ctx.supabase
        .from("round")
        .select("*", { count: "exact", head: true })
        .eq("userId", input.userId)
        .eq("quarantined", false);

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

      if (round.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Cannot access another user's round",
        });
      }

      return round;
    }),
  getBestRound: authedProcedure
    .input(getBestRoundInputSchema)
    .query(async ({ ctx, input }) => {
      if (input.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Cannot access another user's data",
        });
      }
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
  /**
   * Thin adapter over the framework-free scorecard service
   * (`server/services/scorecard/`, subplan 002 Part A). All business logic
   * lives in the service; this procedure only injects side-effects and maps
   * typed domain errors back to the exact `TRPCError`s the inline mutation
   * used to throw, so external behavior is unchanged.
   */
  submitScorecard: authedProcedure
    .input(scorecardSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await submitScorecard(
          {
            db,
            supabase: ctx.supabase,
            authUserId: ctx.user.id,
            getUserAccess: (userId) =>
              getComprehensiveUserAccess(userId, ctx.supabase),
            notifyAdmins: sendAdminSubmissionNotification,
            logger,
            analytics: getPostHogClient(),
            // Part B seam: web/native keeps reject-at-limit; the /v1 REST
            // adapter (subplan 005) passes "quarantine" once subplan 003's
            // `quarantined` column lands.
            overLimitPolicy: "reject",
          },
          input
        );
      } catch (error) {
        if (
          error instanceof SelfSubmissionError ||
          error instanceof PlanNotSelectedError ||
          error instanceof RoundLimitReachedError ||
          error instanceof RoundLimitRaceError
        ) {
          throw new TRPCError({ code: "FORBIDDEN", message: error.message });
        }
        // Duplicate submission (double-click, watch sync replay, native
        // offline retry) — surface as CONFLICT with user-facing copy, never
        // the raw Postgres constraint message.
        if (error instanceof DuplicateRoundError) {
          throw new TRPCError({ code: "CONFLICT", message: error.message });
        }
        throw error;
      }
    }),

  /**
   * A user's own submission history — status, resolution, and (for
   * rejections) the reason. Uses the request-scoped, user-authenticated
   * Supabase client (`ctx.supabase`), not the drizzle `db` connection or a
   * service-role client: `submissions` RLS already restricts SELECT to
   * `submittedBy = auth.uid()` (db/schema.ts), so this can only ever return
   * the caller's own rows.
   */
  listMySubmissions: authedProcedure.query(
    async ({ ctx }): Promise<MySubmission[]> => {
      const { data: rows, error } = await ctx.supabase
        .from("submissions")
        .select(
          "id, submissionType, status, createdAt, resolvedAt, rejectionReason, courseId, teeId"
        )
        .order("createdAt", { ascending: false });

      if (error) {
        logger.error("Failed to list user's submissions", {
          userId: ctx.user.id,
          error: error.message,
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message,
        });
      }

      const submissionRows = rows ?? [];
      if (submissionRows.length === 0) return [];

      const courseIds = [
        ...new Set(
          submissionRows
            .map((row) => row.courseId)
            .filter((id): id is number => id !== null)
        ),
      ];
      const teeIds = [
        ...new Set(
          submissionRows
            .map((row) => row.teeId)
            .filter((id): id is number => id !== null)
        ),
      ];

      const [{ data: courseRows }, { data: teeRows }] = await Promise.all([
        courseIds.length > 0
          ? ctx.supabase.from("course").select("id, name").in("id", courseIds)
          : Promise.resolve({ data: [] as { id: number; name: string }[] }),
        teeIds.length > 0
          ? ctx.supabase.from("teeInfo").select("id, name").in("id", teeIds)
          : Promise.resolve({ data: [] as { id: number; name: string }[] }),
      ]);

      const courseNameById = new Map(
        (courseRows ?? []).map((c) => [c.id, c.name])
      );
      const teeNameById = new Map((teeRows ?? []).map((t) => [t.id, t.name]));

      return submissionRows.map((row) => ({
        id: row.id,
        submissionType: row.submissionType as MySubmission["submissionType"],
        status: row.status as MySubmission["status"],
        createdAt: row.createdAt,
        resolvedAt: row.resolvedAt,
        rejectionReason: row.rejectionReason,
        courseId: row.courseId,
        courseName:
          row.courseId !== null
            ? (courseNameById.get(row.courseId) ?? null)
            : null,
        teeId: row.teeId,
        teeName:
          row.teeId !== null ? (teeNameById.get(row.teeId) ?? null) : null,
      }));
    }
  ),
});
