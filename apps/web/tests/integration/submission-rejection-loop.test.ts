/**
 * Rejection-loop integration tests (plans/003-rejection-loop).
 *
 * Exercises `approve_submission` / `reject_submission`'s retained-record
 * lifecycle (supabase/migrations/20260703091818_submission_lifecycle_and_reason.sql)
 * against the REAL local Supabase stack, plus the `submissions` RLS policy
 * that scopes SELECT to the submitter.
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
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const databaseUrl = process.env.DATABASE_URL;
const isLocalStack =
  !!databaseUrl?.includes("127.0.0.1") || !!databaseUrl?.includes("localhost");

// Same dummy-credential guard as the other real-stack suites: CI supplies
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

const TEST_EMAIL_A = "rejection-loop-user-a@handicappin.local";
const TEST_EMAIL_B = "rejection-loop-user-b@handicappin.local";
const TEST_PASSWORD = "correct-horse-battery-staple-1!";

let userAId: string;
let userBId: string;
const courseIds: number[] = [];
const teeIds: number[] = [];
const submissionIds: number[] = [];

/** A minimal but schema-valid teeInfo row (all NOT NULL numeric fields set). */
function teeRow(
  courseId: number,
  submittedBy: string,
  overrides: Partial<typeof teeInfo.$inferInsert> = {}
) {
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
    submittedBy,
    ...overrides,
  };
}

/** Seeds a pending new_course submission (course + tee + submission row). */
async function seedSubmission(submittedBy: string, courseName: string) {
  const [createdCourse] = await db
    .insert(course)
    .values({ name: courseName, approvalStatus: "pending", submittedBy })
    .returning();
  const courseId = createdCourse!.id;
  courseIds.push(courseId);

  const [createdTee] = await db
    .insert(teeInfo)
    .values(teeRow(courseId, submittedBy))
    .returning();
  const teeId = createdTee!.id;
  teeIds.push(teeId);

  const [createdSubmission] = await db
    .insert(submissions)
    .values({ submittedBy, courseId, teeId, submissionType: "new_course" })
    .returning();
  const submissionId = createdSubmission!.id;
  submissionIds.push(submissionId);

  return { courseId, teeId, submissionId };
}

function serviceRoleClient() {
  return createClient(supabaseUrl!, serviceRoleKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

describeIfLocal("Submission rejection loop (real local Supabase)", () => {
  beforeAll(async () => {
    const admin = serviceRoleClient();

    for (const email of [TEST_EMAIL_A, TEST_EMAIL_B]) {
      const { data: usersPage } = await admin.auth.admin.listUsers();
      const existing = usersPage?.users.find((u) => u.email === email);
      if (existing) {
        await db.delete(profile).where(eq(profile.id, existing.id));
        await admin.auth.admin.deleteUser(existing.id);
      }
    }

    const { data: createdA, error: errorA } = await admin.auth.admin.createUser(
      { email: TEST_EMAIL_A, email_confirm: true, password: TEST_PASSWORD }
    );
    if (errorA || !createdA.user) {
      throw new Error(`Failed to create test user A: ${errorA?.message}`);
    }
    userAId = createdA.user.id;
    await db.insert(profile).values({
      id: userAId,
      email: TEST_EMAIL_A,
      name: "Rejection Loop User A",
      verified: true,
    });

    const { data: createdB, error: errorB } = await admin.auth.admin.createUser(
      { email: TEST_EMAIL_B, email_confirm: true, password: TEST_PASSWORD }
    );
    if (errorB || !createdB.user) {
      throw new Error(`Failed to create test user B: ${errorB?.message}`);
    }
    userBId = createdB.user.id;
    await db.insert(profile).values({
      id: userBId,
      email: TEST_EMAIL_B,
      name: "Rejection Loop User B",
      verified: true,
    });
  }, 30_000);

  afterAll(async () => {
    const admin = serviceRoleClient();

    for (const submissionId of submissionIds) {
      await db.delete(submissions).where(eq(submissions.id, submissionId));
    }
    for (const teeId of teeIds) {
      await db.delete(teeInfo).where(eq(teeInfo.id, teeId));
    }
    for (const courseId of courseIds) {
      await db.delete(course).where(eq(course.id, courseId));
    }
    if (userAId) {
      await db.delete(profile).where(eq(profile.id, userAId));
      await admin.auth.admin.deleteUser(userAId);
    }
    if (userBId) {
      await db.delete(profile).where(eq(profile.id, userBId));
      await admin.auth.admin.deleteUser(userBId);
    }
  }, 30_000);

  test("reject with a reason retains the row as rejected and flips course/tee to rejected", async () => {
    const { courseId, teeId, submissionId } = await seedSubmission(
      userAId,
      `Rejection Loop Course ${randomUUID()}`
    );
    const admin = serviceRoleClient();

    const { error } = await admin.rpc("reject_submission", {
      p_submission_id: submissionId,
      p_reason: "Tee ratings do not match the official scorecard.",
    });
    expect(error).toBeNull();

    const [row] = await db
      .select()
      .from(submissions)
      .where(eq(submissions.id, submissionId));
    expect(row?.status).toBe("rejected");
    expect(row?.resolvedAt).not.toBeNull();
    expect(row?.rejectionReason).toBe(
      "Tee ratings do not match the official scorecard."
    );

    const [rejectedCourse] = await db
      .select()
      .from(course)
      .where(eq(course.id, courseId));
    expect(rejectedCourse?.approvalStatus).toBe("rejected");

    const [rejectedTee] = await db
      .select()
      .from(teeInfo)
      .where(eq(teeInfo.id, teeId));
    expect(rejectedTee?.approvalStatus).toBe("rejected");
  });

  test("rejecting an already-resolved submission raises", async () => {
    const { submissionId } = await seedSubmission(
      userAId,
      `Rejection Loop Course ${randomUUID()}`
    );
    const admin = serviceRoleClient();

    const first = await admin.rpc("reject_submission", {
      p_submission_id: submissionId,
      p_reason: "first reason",
    });
    expect(first.error).toBeNull();

    const second = await admin.rpc("reject_submission", {
      p_submission_id: submissionId,
      p_reason: "second reason",
    });
    expect(second.error).not.toBeNull();
    expect(second.error?.message).toContain("already resolved");
  });

  test("rejecting with an empty reason raises", async () => {
    const { submissionId } = await seedSubmission(
      userAId,
      `Rejection Loop Course ${randomUUID()}`
    );
    const admin = serviceRoleClient();

    const { error } = await admin.rpc("reject_submission", {
      p_submission_id: submissionId,
      p_reason: "",
    });
    expect(error).not.toBeNull();
    expect(error?.message).toContain("A rejection reason is required");
  });

  test("approving retains the row as approved", async () => {
    const { submissionId } = await seedSubmission(
      userAId,
      `Rejection Loop Course ${randomUUID()}`
    );
    const admin = serviceRoleClient();

    const { error } = await admin.rpc("approve_submission", {
      p_submission_id: submissionId,
    });
    expect(error).toBeNull();

    const [row] = await db
      .select()
      .from(submissions)
      .where(eq(submissions.id, submissionId));
    expect(row?.status).toBe("approved");
    expect(row?.resolvedAt).not.toBeNull();
    expect(row?.rejectionReason).toBeNull();
  });

  test("RLS: a user cannot select another user's submissions via a user-scoped client", async () => {
    if (!anonKey) {
      throw new Error(
        "NEXT_PUBLIC_SUPABASE_ANON_KEY is required for this test"
      );
    }

    const { submissionId: submissionAId } = await seedSubmission(
      userAId,
      `Rejection Loop Course ${randomUUID()}`
    );

    const signInClientA = createClient(supabaseUrl!, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: sessionA, error: signInErrorA } =
      await signInClientA.auth.signInWithPassword({
        email: TEST_EMAIL_A,
        password: TEST_PASSWORD,
      });
    if (signInErrorA || !sessionA.session) {
      throw new Error(`Failed to sign in user A: ${signInErrorA?.message}`);
    }

    const signInClientB = createClient(supabaseUrl!, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: sessionB, error: signInErrorB } =
      await signInClientB.auth.signInWithPassword({
        email: TEST_EMAIL_B,
        password: TEST_PASSWORD,
      });
    if (signInErrorB || !sessionB.session) {
      throw new Error(`Failed to sign in user B: ${signInErrorB?.message}`);
    }

    // Bearer-scoped clients — same pattern as trpc.ts's
    // createBearerTokenSupabaseClient — so `auth.uid()` in the RLS policy
    // resolves to each user, not the service role.
    const userAClient = createClient(supabaseUrl!, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: {
        headers: { Authorization: `Bearer ${sessionA.session.access_token}` },
      },
    });
    const userBClient = createClient(supabaseUrl!, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: {
        headers: { Authorization: `Bearer ${sessionB.session.access_token}` },
      },
    });

    const { data: ownRows, error: ownError } = await userAClient
      .from("submissions")
      .select("id")
      .eq("id", submissionAId);
    expect(ownError).toBeNull();
    expect(ownRows).toHaveLength(1);

    const { data: otherRows, error: otherError } = await userBClient
      .from("submissions")
      .select("id")
      .eq("id", submissionAId);
    expect(otherError).toBeNull();
    expect(otherRows).toHaveLength(0);
  });
});
