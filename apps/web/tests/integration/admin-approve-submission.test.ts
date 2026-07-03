/**
 * `approve_submission` RPC integration test (plans/002-admin-moderation-console).
 *
 * Exercises the real, already-hardened RPC (supabase/migrations/
 * 20260410165734_fix_submission_fk_and_procedure_safety.sql) against the
 * REAL local Supabase stack: seeds a pending new_course submission, calls
 * `approve_submission` via the service-role client (the same call the admin
 * router makes), and asserts the course/tee flip to approved and the
 * submission row is deleted.
 *
 * Mirrors the `describeIfLocal` harness established in
 * stripe-billing-guards.test.ts — this suite only runs against a real
 * `supabase start`; it skips (not fails) when no local stack is available.
 */
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { eq } from "drizzle-orm";

const { db } = await import("@/db");
const { profile, course, teeInfo, submissions } = await import("@/db/schema");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const databaseUrl = process.env.DATABASE_URL;
const isLocalStack =
  !!databaseUrl?.includes("127.0.0.1") || !!databaseUrl?.includes("localhost");

// Same dummy-credential guard as stripe-billing-guards.test.ts: CI supplies
// DUMMY Supabase credentials (no real stack provisioned), which must count
// as "no local stack" so this suite skips in CI and runs only against a
// real `supabase start`.
const hasRealSupabase =
  !!supabaseUrl &&
  !supabaseUrl.includes("dummy") &&
  !!serviceRoleKey &&
  !serviceRoleKey.includes("dummy");

const describeIfLocal =
  hasRealSupabase && isLocalStack ? describe : describe.skip;

const TEST_EMAIL = "admin-approve-submission-test@handicappin.local";

let userId: string;
let courseId: number;
let teeId: number;
let submissionId: number;

/** A minimal but schema-valid teeInfo row (all NOT NULL numeric fields set). */
function teeRow(overrides: Partial<typeof teeInfo.$inferInsert> = {}) {
  return {
    courseId,
    name: "Blue",
    gender: "mens",
    courseRating18: 72.0,
    slopeRating18: 130,
    courseRatingFront9: 36.0,
    slopeRatingFront9: 130,
    courseRatingBack9: 36.0,
    slopeRatingBack9: 130,
    outPar: 36,
    inPar: 36,
    totalPar: 72,
    outDistance: 3300,
    inDistance: 3300,
    totalDistance: 6600,
    distanceMeasurement: "yards",
    approvalStatus: "pending",
    submittedBy: userId,
    ...overrides,
  };
}

describeIfLocal(
  "approve_submission RPC (real local Supabase)",
  () => {
    beforeAll(async () => {
      const admin = createClient(supabaseUrl!, serviceRoleKey!, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { data: usersPage } = await admin.auth.admin.listUsers();
      const existing = usersPage?.users.find((u) => u.email === TEST_EMAIL);
      if (existing) {
        await db.delete(profile).where(eq(profile.id, existing.id));
        await admin.auth.admin.deleteUser(existing.id);
      }
      const { data: created, error } = await admin.auth.admin.createUser({
        email: TEST_EMAIL,
        email_confirm: true,
        password: randomUUID(),
      });
      if (error || !created.user) {
        throw new Error(`Failed to create test user: ${error?.message}`);
      }
      userId = created.user.id;
      await db.insert(profile).values({
        id: userId,
        email: TEST_EMAIL,
        name: "Admin Approve Submission Test",
        verified: true,
      });
    }, 30_000);

    afterAll(async () => {
      if (!userId) return;
      const admin = createClient(supabaseUrl!, serviceRoleKey!, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      // Submission row is deleted by the RPC on success; clean up defensively
      // in case a test failed before reaching that point.
      if (submissionId) {
        await db.delete(submissions).where(eq(submissions.id, submissionId));
      }
      if (teeId) {
        await db.delete(teeInfo).where(eq(teeInfo.id, teeId));
      }
      if (courseId) {
        await db.delete(course).where(eq(course.id, courseId));
      }
      await db.delete(profile).where(eq(profile.id, userId));
      await admin.auth.admin.deleteUser(userId);
    }, 30_000);

    test("approving a pending new_course submission approves the course + tee and deletes the submission row", async () => {
      const [createdCourse] = await db
        .insert(course)
        .values({
          name: `Admin Approve Test Course ${randomUUID()}`,
          approvalStatus: "pending",
          submittedBy: userId,
        })
        .returning();
      courseId = createdCourse!.id;

      const [createdTee] = await db
        .insert(teeInfo)
        .values(teeRow())
        .returning();
      teeId = createdTee!.id;

      const [createdSubmission] = await db
        .insert(submissions)
        .values({
          submittedBy: userId,
          courseId,
          teeId,
          submissionType: "new_course",
        })
        .returning();
      submissionId = createdSubmission!.id;

      const admin = createClient(supabaseUrl!, serviceRoleKey!, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      const { error } = await admin.rpc("approve_submission", {
        p_submission_id: submissionId,
      });
      expect(error).toBeNull();

      const [approvedCourse] = await db
        .select()
        .from(course)
        .where(eq(course.id, courseId));
      expect(approvedCourse?.approvalStatus).toBe("approved");

      const [approvedTee] = await db
        .select()
        .from(teeInfo)
        .where(eq(teeInfo.id, teeId));
      expect(approvedTee?.approvalStatus).toBe("approved");

      const remainingSubmissions = await db
        .select()
        .from(submissions)
        .where(eq(submissions.id, submissionId));
      expect(remainingSubmissions).toHaveLength(0);
    });
  },
);
