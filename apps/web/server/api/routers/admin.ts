import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { adminProcedure, createTRPCRouter } from "../trpc";
import { createAdminClient } from "@/utils/supabase/admin";
import { logger } from "@/lib/logging";

type SupabaseAdminClient = ReturnType<typeof createAdminClient>;
type SubmissionType = "new_course" | "new_tee" | "tee_edit";

export interface PendingSubmission {
  id: number;
  submissionType: SubmissionType;
  createdAt: string;
  courseId: number | null;
  courseName: string | null;
  teeId: number | null;
  teeName: string | null;
  teeGender: string | null;
  submitterId: string | null;
  submitterEmail: string | null;
}

export const approveSubmissionInput = z.object({
  submissionId: z.number().int().positive(),
});

export const rejectSubmissionInput = z.object({
  submissionId: z.number().int().positive(),
  reason: z.string().trim().min(3).max(1000),
});

/**
 * Fetch `id -> name` (course) or `id -> {name, gender}` (teeInfo) lookup maps
 * for a set of ids, skipping the round-trip entirely when there's nothing to
 * fetch. Used to stitch the submissions queue together without relying on
 * PostgREST embedded-resource join syntax (unverified against a live
 * instance in this environment; the codebase's existing convention — see
 * `tee.ts`'s `fetchTees` — is to fetch related rows separately and join in
 * application code).
 */
async function fetchCourseNames(
  admin: SupabaseAdminClient,
  ids: number[]
): Promise<Map<number, string>> {
  if (ids.length === 0) return new Map();

  const { data, error } = await admin
    .from("course")
    .select("id, name")
    .in("id", ids);

  if (error) {
    logger.error("Failed to fetch course names for submissions queue", {
      error: error.message,
    });
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: error.message,
    });
  }

  return new Map((data ?? []).map((course) => [course.id, course.name]));
}

async function fetchTeeInfo(
  admin: SupabaseAdminClient,
  ids: number[]
): Promise<Map<number, { name: string; gender: string }>> {
  if (ids.length === 0) return new Map();

  const { data, error } = await admin
    .from("teeInfo")
    .select("id, name, gender")
    .in("id", ids);

  if (error) {
    logger.error("Failed to fetch tee info for submissions queue", {
      error: error.message,
    });
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: error.message,
    });
  }

  return new Map(
    (data ?? []).map((tee) => [tee.id, { name: tee.name, gender: tee.gender }])
  );
}

async function fetchSubmitterEmails(
  admin: SupabaseAdminClient,
  ids: string[]
): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();

  const { data, error } = await admin
    .from("profile")
    .select("id, email")
    .in("id", ids);

  if (error) {
    logger.error("Failed to fetch submitter emails for submissions queue", {
      error: error.message,
    });
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: error.message,
    });
  }

  return new Map((data ?? []).map((profile) => [profile.id, profile.email]));
}

export const adminRouter = createTRPCRouter({
  /**
   * Submissions are now a retained record — `approve_submission` /
   * `reject_submission` (supabase/migrations/20260703091818) mark a row
   * resolved (status + resolvedAt + rejectionReason) instead of deleting
   * it. The queue only cares about the still-open ones, so this filters to
   * `status = 'pending'`, oldest first.
   */
  listPendingSubmissions: adminProcedure.query(
    async (): Promise<PendingSubmission[]> => {
      // Service-role client: the queue must read every user's submissions,
      // but `submissions` RLS scopes SELECT to `submittedBy = auth.uid()`
      // (own rows only) — an admin listing can't go through a user-scoped
      // client. Access here is already gated by `adminProcedure` before this
      // client is touched, and the client never leaves this server-only
      // module.
      const supabaseAdmin = createAdminClient();

      const { data: submissions, error } = await supabaseAdmin
        .from("submissions")
        .select("id, submissionType, createdAt, courseId, teeId, submittedBy")
        .eq("status", "pending")
        .order("createdAt", { ascending: true });

      if (error) {
        logger.error("Failed to list pending submissions", {
          error: error.message,
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message,
        });
      }

      const rows = submissions ?? [];

      const courseIds = [
        ...new Set(
          rows
            .map((row) => row.courseId)
            .filter((id): id is number => id !== null)
        ),
      ];
      const teeIds = [
        ...new Set(
          rows.map((row) => row.teeId).filter((id): id is number => id !== null)
        ),
      ];
      const submitterIds = [
        ...new Set(
          rows
            .map((row) => row.submittedBy)
            .filter((id): id is string => id !== null)
        ),
      ];

      const [courseNames, teeInfoById, submitterEmails] = await Promise.all([
        fetchCourseNames(supabaseAdmin, courseIds),
        fetchTeeInfo(supabaseAdmin, teeIds),
        fetchSubmitterEmails(supabaseAdmin, submitterIds),
      ]);

      return rows.map((row) => {
        const tee = row.teeId !== null ? teeInfoById.get(row.teeId) : undefined;

        return {
          id: row.id,
          submissionType: row.submissionType as SubmissionType,
          createdAt: row.createdAt,
          courseId: row.courseId,
          courseName:
            row.courseId !== null
              ? (courseNames.get(row.courseId) ?? null)
              : null,
          teeId: row.teeId,
          teeName: tee?.name ?? null,
          teeGender: tee?.gender ?? null,
          submitterId: row.submittedBy,
          submitterEmail:
            row.submittedBy !== null
              ? (submitterEmails.get(row.submittedBy) ?? null)
              : null,
        };
      });
    }
  ),

  approveSubmission: adminProcedure
    .input(approveSubmissionInput)
    .mutation(async ({ input }) => {
      // Service-role client: approve_submission is intentionally
      // service_role-only (revoked from public/anon/authenticated — see
      // supabase/migrations/20260410165734). Access here is already gated
      // by `adminProcedure` before this client is touched.
      const supabaseAdmin = createAdminClient();

      const { error } = await supabaseAdmin.rpc("approve_submission", {
        p_submission_id: input.submissionId,
      });

      if (error) {
        logger.error("approve_submission RPC failed", {
          submissionId: input.submissionId,
          error: error.message,
        });
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: error.message,
        });
      }

      return { success: true as const };
    }),

  rejectSubmission: adminProcedure
    .input(rejectSubmissionInput)
    .mutation(async ({ input }) => {
      // Service-role client: reject_submission is intentionally
      // service_role-only (revoked from public/anon/authenticated — see
      // supabase/migrations/20260410165734). Access here is already gated
      // by `adminProcedure` before this client is touched.
      const supabaseAdmin = createAdminClient();

      const { error } = await supabaseAdmin.rpc("reject_submission", {
        p_submission_id: input.submissionId,
        p_reason: input.reason,
      });

      if (error) {
        logger.error("reject_submission RPC failed", {
          submissionId: input.submissionId,
          error: error.message,
        });
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: error.message,
        });
      }

      return { success: true as const };
    }),
});
