/**
 * `POST /v1/rounds` (T13.4) against the REAL local Supabase stack, through the
 * REAL route handler — the write path a paying customer's data flows through.
 *
 * Real: tokens (password sign-in AND the full OAuth 2.1 authorization-code +
 * PKCE flow), RLS, `get_connected_entitlement()`, both unique constraints,
 * the 002 service, and the handler.
 *
 * Mocked: the rate limiter (RATE_LIMIT_ENABLED is unset locally, so the real
 * fail-closed limiter would 503 every request), PostHog, and the admin email.
 * Nothing about idempotency, quarantine or the constraints is faked — the
 * whole point of this suite is that §2's procedure is decided by Postgres.
 *
 * Contract §6: "integration tests must cover both principal classes per
 * route", so the shape assertions run twice.
 */
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";
import { randomUUID } from "crypto";
import { and, eq, sql } from "drizzle-orm";
import postgres from "postgres";

import {
  hasLocalStack,
  adminClient,
  deleteAuthUserByEmail,
  mintFirstPartyPrincipal,
  mintOAuthPrincipal,
  sweepStaleOAuthTestClients,
  v1Request,
  type TestPrincipal,
} from "./helpers/v1-principals";

const limiter = vi.hoisted(() => ({
  calls: [] as { principal: unknown; family: unknown }[],
  outcomes: [] as unknown[],
}));

const ALLOW = {
  success: true,
  failedClosed: false,
  limit: 60,
  remaining: 59,
  reset: 0,
};

vi.mock("@/lib/rate-limit", () => ({
  enforcePublicApiRateLimit: async (
    _request: Request,
    principal: unknown,
    family: unknown
  ) => {
    limiter.calls.push({ principal, family });
    return limiter.outcomes.shift() ?? ALLOW;
  },
}));

vi.mock("@/lib/posthog", () => ({
  getPostHogClient: () => ({ capture: () => {}, flush: async () => {} }),
}));

vi.mock("@/lib/email-service", () => ({
  sendAdminSubmissionNotification: async () => undefined,
}));

const { POST, GET } = await import("@/app/api/v1/rounds/route");
const { serializeV1Round } = await import(
  "@/app/api/v1/_lib/serializers/round"
);
const { V1_SUBMITTED_VIA } = await import(
  "@/app/api/v1/rounds/create-round"
);
const { db } = await import("@/db");
const { profile, course, teeInfo, hole, round, score } = await import(
  "@/db/schema"
);

const describeIfLocal = hasLocalStack ? describe : describe.skip;

const FREE_TIER_ROUND_LIMIT = 25;

const EMAILS = {
  owner: "v1-rounds-write-owner@handicappin.local",
  over: "v1-rounds-write-over@handicappin.local",
  race: "v1-rounds-write-race@handicappin.local",
  parallel: "v1-rounds-write-parallel@handicappin.local",
  planless: "v1-rounds-write-planless@handicappin.local",
  stranger: "v1-rounds-write-stranger@handicappin.local",
} as const;
const COURSE_NAME = "V1 Rounds Write Course";
const TEE_NAME = "Blue";

let firstParty: TestPrincipal;
let oauth: TestPrincipal;
let over: TestPrincipal;
let race: TestPrincipal;
let parallel: TestPrincipal;
let planless: TestPrincipal;
let stranger: TestPrincipal;
let courseId: number;
let teeId: number;

const TEE_RATINGS = {
  courseRating18: 71.0,
  slopeRating18: 130,
  courseRatingFront9: 36.0,
  slopeRatingFront9: 130,
  courseRatingBack9: 35.0,
  slopeRatingBack9: 120,
  outPar: 36,
  inPar: 35,
  totalPar: 71,
  outDistance: 3150,
  inDistance: 3150,
  totalDistance: 6300,
  distanceMeasurement: "yards" as const,
};

/** Non-sequential stroke indices, so a positional bug cannot pass by luck. */
const HCP_ORDER = [7, 1, 13, 5, 17, 3, 11, 15, 9, 8, 2, 14, 6, 18, 4, 12, 16, 10];

function holeSpec(index: number) {
  return {
    holeNumber: index + 1,
    par: index === 17 ? 3 : 4,
    hcp: HCP_ORDER[index]!,
    distance: 350,
  };
}

interface SubmissionOptions {
  userId: string;
  teeTime?: string;
  externalId?: string;
  notes?: string;
  strokes?: number[];
  putts?: (number | null)[];
  nineHoleSection?: "front" | "back";
  holes?: number;
}

function submission(options: SubmissionOptions): Record<string, unknown> {
  const holes = options.holes ?? 18;
  const scores = Array.from({ length: holes }, (_, index) => {
    const entry: Record<string, unknown> = {
      strokes: options.strokes?.[index] ?? 5,
      // Deliberately a LIE: the server must overwrite this (§2's build
      // dependency). 0 caps every hole at par + 2 — the manipulation vector.
      hcpStrokes: 0,
    };
    if (options.putts !== undefined) {
      const value = options.putts[index];
      if (value !== null && value !== undefined) entry.putts = value;
    }
    return entry;
  });

  const payload: Record<string, unknown> = {
    userId: options.userId,
    course: {
      id: courseId,
      name: COURSE_NAME,
      approvalStatus: "approved",
      country: "Norway",
      city: "Oslo",
    },
    teePlayed: {
      id: teeId,
      name: TEE_NAME,
      gender: "mens",
      approvalStatus: "approved",
      ...TEE_RATINGS,
      holes: Array.from({ length: 18 }, (_, index) => holeSpec(index)),
    },
    scores,
    teeTime: options.teeTime ?? "2026-07-29T14:32:00.000Z",
    approvalStatus: "approved",
  };
  if (options.externalId !== undefined) payload.externalId = options.externalId;
  if (options.notes !== undefined) payload.notes = options.notes;
  if (options.nineHoleSection !== undefined) {
    payload.nineHoleSection = options.nineHoleSection;
  }
  return payload;
}

function postRequest(
  principal: TestPrincipal,
  payload: unknown,
  init: RequestInit = {}
): Request {
  return v1Request(principal, "/rounds", {
    method: "POST",
    headers: { "content-type": "application/json", ...(init.headers ?? {}) },
    body: JSON.stringify(payload),
    ...init,
  });
}

async function post(
  principal: TestPrincipal,
  payload: unknown
): Promise<{ response: Response; body: Record<string, unknown> }> {
  const response = await POST(postRequest(principal, payload));
  return {
    response,
    body: (await response.clone().json()) as Record<string, unknown>,
  };
}

async function seedProfile(
  userId: string,
  email: string,
  plan: "free" | "unlimited" | null
) {
  await db.insert(profile).values({
    id: userId,
    email,
    name: email,
    verified: true,
    handicapIndex: 18.0,
    ...(plan
      ? { planSelected: plan, subscriptionStatus: "active" as const }
      : {}),
  });
}

async function cleanUser(userId: string | undefined) {
  if (!userId) return;
  await db.delete(score).where(eq(score.userId, userId));
  await db.delete(round).where(eq(round.userId, userId));
  await db.delete(profile).where(eq(profile.id, userId));
}

describeIfLocal("POST /v1/rounds (real local Supabase)", () => {
  beforeAll(async () => {
    await sweepStaleOAuthTestClients();

    const admin = adminClient();
    const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
    for (const email of Object.values(EMAILS)) {
      const existing = data?.users.find((user) => user.email === email);
      if (existing) await cleanUser(existing.id);
      await deleteAuthUserByEmail(email);
    }

    for (const stale of await db
      .select({ id: course.id })
      .from(course)
      .where(eq(course.name, COURSE_NAME))) {
      const tees = await db
        .select({ id: teeInfo.id })
        .from(teeInfo)
        .where(eq(teeInfo.courseId, stale.id));
      for (const staleTee of tees) {
        await db.delete(hole).where(eq(hole.teeId, staleTee.id));
      }
      await db.delete(teeInfo).where(eq(teeInfo.courseId, stale.id));
      await db.delete(course).where(eq(course.id, stale.id));
    }

    const owner = await mintFirstPartyPrincipal(EMAILS.owner);
    firstParty = owner;
    oauth = await mintOAuthPrincipal({
      userClient: owner.userClient,
      userId: owner.userId,
    });
    over = await mintFirstPartyPrincipal(EMAILS.over);
    race = await mintFirstPartyPrincipal(EMAILS.race);
    parallel = await mintFirstPartyPrincipal(EMAILS.parallel);
    planless = await mintFirstPartyPrincipal(EMAILS.planless);
    stranger = await mintFirstPartyPrincipal(EMAILS.stranger);

    await seedProfile(owner.userId, EMAILS.owner, "unlimited");
    await seedProfile(over.userId, EMAILS.over, "free");
    await seedProfile(race.userId, EMAILS.race, "free");
    await seedProfile(parallel.userId, EMAILS.parallel, "free");
    await seedProfile(planless.userId, EMAILS.planless, null);
    await seedProfile(stranger.userId, EMAILS.stranger, "unlimited");

    const [createdCourse] = await db
      .insert(course)
      .values({
        name: COURSE_NAME,
        country: "Norway",
        city: "Oslo",
        approvalStatus: "approved",
      })
      .returning();
    courseId = createdCourse!.id;

    const [createdTee] = await db
      .insert(teeInfo)
      .values({
        courseId,
        name: TEE_NAME,
        gender: "mens",
        ...TEE_RATINGS,
        approvalStatus: "approved",
        submittedBy: owner.userId,
      })
      .returning();
    teeId = createdTee!.id;

    await db
      .insert(hole)
      .values(
        Array.from({ length: 18 }, (_, index) => ({
          teeId,
          ...holeSpec(index),
        }))
      );
  }, 180_000);

  afterAll(async () => {
    for (const principal of [
      firstParty,
      over,
      race,
      parallel,
      planless,
      stranger,
    ]) {
      await cleanUser(principal?.userId);
    }
    if (teeId) {
      await db.delete(hole).where(eq(hole.teeId, teeId));
      await db.delete(teeInfo).where(eq(teeInfo.id, teeId));
    }
    if (courseId) await db.delete(course).where(eq(course.id, courseId));
    await oauth?.cleanup();
    for (const principal of [
      firstParty,
      over,
      race,
      parallel,
      planless,
      stranger,
    ]) {
      await principal?.cleanup();
    }
  }, 180_000);

  beforeEach(() => {
    limiter.calls.length = 0;
    limiter.outcomes.length = 0;
  });

  // ── Both principal classes (§6) ─────────────────────────────────────────
  for (const className of ["first-party", "oauth"] as const) {
    const principalFor = () => (className === "oauth" ? oauth : firstParty);

    describe(`principal class: ${className}`, () => {
      test("201 Created SYNCHRONOUSLY, with the frozen resource shape", async () => {
        const key = `${className}-201-${randomUUID()}`;
        const { response, body } = await post(
          principalFor(),
          submission({
            userId: firstParty.userId,
            externalId: key,
            teeTime: `2026-0${className === "oauth" ? 3 : 2}-01T10:00:00.000Z`,
          })
        );

        // §5: never 202, never 200 on first write.
        expect(response.status).toBe(201);
        expect(response.headers.get("X-API-Stability")).toBe("internal");
        expect(response.headers.get("Content-Type")).toContain(
          "application/json"
        );
        expect(body.externalId).toBe(key);
        expect(body.status).toBe("active");
        expect(body.handicapRevision).toBe("pending");
        expect(typeof body.handicapIndex).toBe("number");
        expect(body.teeId).toBe(teeId);
        expect(body.courseId).toBe(courseId);
        // §5 rejects a raw boolean; the DB column name stays out of the wire.
        expect(body).not.toHaveProperty("quarantined");
        expect(body).not.toHaveProperty("userId");
      }, 90_000);

      test("submitted_via records WHICH client wrote the round, not just the surface", async () => {
        const { response, body } = await post(
          principalFor(),
          submission({
            userId: firstParty.userId,
            externalId: `${className}-provenance-${randomUUID()}`,
            teeTime: `2026-0${className === "oauth" ? 3 : 2}-01T11:00:00.000Z`,
          })
        );
        expect(response.status).toBe(201);

        const [row] = await db
          .select({ submittedVia: round.submittedVia })
          .from(round)
          .where(eq(round.id, body.id as number));

        // `20260730120000` calls this column PROVENANCE that "a handicap
        // product with an official-handicap workstream cannot accept" being
        // forgeable. A value that says only "some /v1 token" cannot answer
        // WHICH connected app wrote a round — an answer nothing else on the
        // row records, and which is unrecoverable once the token is gone.
        //
        // Safe to shape freely: the column is server-set (the migration's
        // INSERT grant excludes it) and `serializeV1Round` omits it, so it has
        // no wire contract and §4 does not freeze it. The assertion below is
        // the one that must hold — the surface prefix, then the client id.
        expect(row!.submittedVia).toBe(
          className === "oauth"
            ? `${V1_SUBMITTED_VIA}:${principalFor().clientId}`
            : V1_SUBMITTED_VIA
        );
        expect(body).not.toHaveProperty("submittedVia");
      }, 90_000);

      test("the limiter gets the principal PARTS and the 'rounds-write' family — after an IP-keyed pre-auth call in the 'preauth' family", async () => {
        await post(
          principalFor(),
          submission({
            userId: firstParty.userId,
            externalId: `${className}-limiter-${randomUUID()}`,
            teeTime: `2026-0${className === "oauth" ? 3 : 2}-02T10:00:00.000Z`,
          })
        );

        expect(limiter.calls).toHaveLength(2);
        // §3: pre-auth traffic is IP-keyed, and it is checked BEFORE the
        // GoTrue round trip token validation costs. Family `preauth` (D15) —
        // the shared pre-auth budget, not the route's write family.
        expect(limiter.calls[0]!.principal).toBeUndefined();
        expect(limiter.calls[0]!.family).toBe("preauth");

        const perPrincipal = limiter.calls[1]!;
        expect(perPrincipal.family).toBe("rounds-write");
        const parts = perPrincipal.principal as {
          userId: string;
          clientId?: string;
        };
        expect(parts.userId).toBe(firstParty.userId);
        if (className === "oauth") {
          expect(parts.clientId).toBe(oauth.clientId);
        } else {
          expect(parts.clientId).toBeUndefined();
        }
      }, 90_000);
    });
  }

  // ── §2 merge-blocking case 1: replay ────────────────────────────────────
  test("MB1 same externalId, same contents → 200 replay with an IDENTICAL body", async () => {
    const key = `mb1-${randomUUID()}`;
    const payload = submission({
      userId: firstParty.userId,
      externalId: key,
      teeTime: "2026-04-01T10:00:00.000Z",
      notes: "first",
    });

    const first = await post(oauth, payload);
    expect(first.response.status).toBe(201);

    const replay = await post(oauth, payload);
    expect(replay.response.status).toBe(200);
    // Byte-identical shape AND value: same serializer, same row.
    expect(replay.body).toEqual(first.body);

    const rows = await db
      .select({ id: round.id })
      .from(round)
      .where(
        and(
          eq(round.userId, firstParty.userId),
          eq(round.externalId, key)
        )
      );
    expect(rows).toHaveLength(1);
  }, 90_000);

  // ── §2 merge-blocking case 2: conflict ──────────────────────────────────
  test("MB2 same externalId, different contents → 409 idempotency_conflict, nothing written", async () => {
    const key = `mb2-${randomUUID()}`;
    const first = await post(
      firstParty,
      submission({
        userId: firstParty.userId,
        externalId: key,
        teeTime: "2026-04-02T10:00:00.000Z",
      })
    );
    expect(first.response.status).toBe(201);

    const conflict = await post(
      firstParty,
      submission({
        userId: firstParty.userId,
        externalId: key,
        teeTime: "2026-04-02T10:00:00.000Z",
        strokes: Array.from({ length: 18 }, (_, i) => (i === 3 ? 9 : 5)),
      })
    );

    expect(conflict.response.status).toBe(409);
    expect(conflict.response.headers.get("Content-Type")).toContain(
      "application/problem+json"
    );
    expect(conflict.body.code).toBe("idempotency_conflict");
    // §1/§2: this code deliberately carries NO existingRoundId.
    expect(conflict.body).not.toHaveProperty("existingRoundId");

    const rows = await db
      .select({ id: round.id })
      .from(round)
      .where(
        and(eq(round.userId, firstParty.userId), eq(round.externalId, key))
      );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.id).toBe(first.body.id);
  }, 90_000);

  // ── §2 merge-blocking case 3: externalId WINS ───────────────────────────
  test("MB3 both keys violated at once → the externalId match WINS (200 replay, not duplicate_round)", async () => {
    // This is the ordinary duplicate submit, and it is the case Postgres
    // reports as the NATURAL key (that constraint is created first, so it
    // wins the OID order). A handler that branched on the constraint name
    // would return 409 duplicate_round here.
    const key = `mb3-${randomUUID()}`;
    const payload = submission({
      userId: firstParty.userId,
      externalId: key,
      teeTime: "2026-04-03T10:00:00.000Z",
    });

    const first = await post(firstParty, payload);
    expect(first.response.status).toBe(201);

    const replay = await post(firstParty, payload);
    expect(replay.response.status).toBe(200);
    expect(replay.body).toEqual(first.body);
  }, 90_000);

  test("MB3-mirror both keys violated, CHANGED strokes → 409 idempotency_conflict (never duplicate_round)", async () => {
    const key = `mb3m-${randomUUID()}`;
    const teeTime = "2026-04-04T10:00:00.000Z";
    const first = await post(
      firstParty,
      submission({ userId: firstParty.userId, externalId: key, teeTime })
    );
    expect(first.response.status).toBe(201);

    const conflict = await post(
      firstParty,
      submission({
        userId: firstParty.userId,
        externalId: key,
        teeTime,
        strokes: Array.from({ length: 18 }, (_, i) => (i === 0 ? 8 : 5)),
      })
    );
    expect(conflict.response.status).toBe(409);
    expect(conflict.body.code).toBe("idempotency_conflict");
  }, 90_000);

  test("natural-key collision WITHOUT an externalId match → 409 duplicate_round + existingRoundId", async () => {
    // §2 rule 5: the date-only-backfill case. The stored round carries a
    // different key, so the replay lookup finds nothing.
    const teeTime = "2026-04-05T10:00:00.000Z";
    const first = await post(
      firstParty,
      submission({
        userId: firstParty.userId,
        externalId: `rule5-a-${randomUUID()}`,
        teeTime,
      })
    );
    expect(first.response.status).toBe(201);

    const duplicate = await post(
      firstParty,
      submission({
        userId: firstParty.userId,
        externalId: `rule5-b-${randomUUID()}`,
        teeTime,
      })
    );
    expect(duplicate.response.status).toBe(409);
    expect(duplicate.body.code).toBe("duplicate_round");
    expect(duplicate.body.existingRoundId).toBe(first.body.id);
  }, 90_000);

  test("NO externalId supplied + natural-key collision → 409 duplicate_round (§2 rule 4)", async () => {
    const teeTime = "2026-04-06T10:00:00.000Z";
    const first = await post(
      firstParty,
      submission({ userId: firstParty.userId, teeTime })
    );
    expect(first.response.status).toBe(201);
    expect(first.body.externalId).toBeNull();

    const duplicate = await post(
      firstParty,
      submission({ userId: firstParty.userId, teeTime })
    );
    expect(duplicate.response.status).toBe(409);
    expect(duplicate.body.code).toBe("duplicate_round");
    expect(duplicate.body.existingRoundId).toBe(first.body.id);
  }, 90_000);

  // ── §2's three normalization retries, each a 200 replay ─────────────────
  test("N1 retry-WITHOUT-putts of a round stored with no putts → 200 replay", async () => {
    const key = `n1-${randomUUID()}`;
    const teeTime = "2026-05-01T10:00:00.000Z";
    // Stored with the field explicitly null …
    const first = await post(
      firstParty,
      submission({
        userId: firstParty.userId,
        externalId: key,
        teeTime,
        putts: Array.from({ length: 18 }, () => null),
      })
    );
    expect(first.response.status).toBe(201);

    // … retried with the key OMITTED entirely.
    const replay = await post(
      firstParty,
      submission({ userId: firstParty.userId, externalId: key, teeTime })
    );
    expect(replay.response.status).toBe(200);
    expect(replay.body).toEqual(first.body);
  }, 90_000);

  test("N2 retry of a BACK-NINE round → 200 replay (positions map holeNumber - 10)", async () => {
    const key = `n2-${randomUUID()}`;
    const payload = submission({
      userId: firstParty.userId,
      externalId: key,
      teeTime: "2026-05-02T10:00:00.000Z",
      nineHoleSection: "back",
      holes: 9,
      strokes: [4, 5, 6, 4, 5, 6, 4, 5, 6],
    });

    const first = await post(firstParty, payload);
    expect(first.response.status).toBe(201);
    expect(first.body.nineHoleSection).toBe("back");
    expect(first.body.holesPlayed).toBe(9);

    const replay = await post(firstParty, payload);
    expect(replay.response.status).toBe(200);
    expect(replay.body).toEqual(first.body);
  }, 90_000);

  test("N2 a back-nine round whose scores are REORDERED is a conflict, not a replay", async () => {
    const key = `n2c-${randomUUID()}`;
    const teeTime = "2026-05-03T10:00:00.000Z";
    const strokes = [4, 5, 6, 4, 5, 6, 4, 5, 7];
    const first = await post(
      firstParty,
      submission({
        userId: firstParty.userId,
        externalId: key,
        teeTime,
        nineHoleSection: "back",
        holes: 9,
        strokes,
      })
    );
    expect(first.response.status).toBe(201);

    const reordered = await post(
      firstParty,
      submission({
        userId: firstParty.userId,
        externalId: key,
        teeTime,
        nineHoleSection: "back",
        holes: 9,
        strokes: [...strokes].reverse(),
      })
    );
    expect(reordered.response.status).toBe(409);
    expect(reordered.body.code).toBe("idempotency_conflict");
  }, 90_000);

  test("N3 retry of the SAME INSTANT in a different timezone offset → 200 replay", async () => {
    const key = `n3-${randomUUID()}`;
    const first = await post(
      firstParty,
      submission({
        userId: firstParty.userId,
        externalId: key,
        teeTime: "2026-05-04T14:32:00.000Z",
      })
    );
    expect(first.response.status).toBe(201);

    const replay = await post(
      firstParty,
      submission({
        userId: firstParty.userId,
        externalId: key,
        teeTime: "2026-05-04T16:32:00+02:00",
      })
    );
    expect(replay.response.status).toBe(200);
    expect(replay.body).toEqual(first.body);
    expect(replay.body.teeTime).toBe("2026-05-04T14:32:00.000Z");
  }, 90_000);

  // ── §2 merge-blocking case 4: FORCED concurrency ────────────────────────
  test("MB4 FORCED-concurrency double submit → exactly one insert, the loser gets the 200 replay", async () => {
    // ── The mechanism, and why it is not a race ──────────────────────────
    // A naively-parallel test is a coin flip: if the winner commits first,
    // the loser's step-1 lookup finds the row and the test merely re-runs
    // MB3 while passing for the wrong reason. So the interleave is FORCED.
    //
    // `submitScorecard` takes `SELECT … FROM profile … FOR UPDATE` as the
    // first statement of its transaction whenever the account is on the free
    // plan. Holding that row lock from an outside transaction therefore
    // parks BOTH requests inside their own service transaction — after the
    // handler has already run §2 step 1 (it is sequential code before the
    // service call) and before either can insert or commit.
    //
    // The evidence that they genuinely overlapped is `blockedPeak`: two
    // backends simultaneously WAITING on a lock means two requests were
    // in-flight past step 1 with zero commits between them. Only then is the
    // lock released, and whichever request wins the race to insert, the
    // other MUST reach the 200 replay via the unique violation.
    const key = `mb4-${randomUUID()}`;
    const payload = submission({
      userId: race.userId,
      externalId: key,
      teeTime: "2026-06-01T10:00:00.000Z",
    });

    const databaseUrl = process.env.DATABASE_URL!;
    const holder = postgres(databaseUrl, { prepare: false, max: 1 });
    const probe = postgres(databaseUrl, { prepare: false, max: 1 });

    let winner: Promise<Response> | null = null;
    let loser: Promise<Response> | null = null;
    let blockedPeak = 0;

    try {
      await holder.begin(async (rawTx) => {
        // postgres.js declares `TransactionSql` as `Omit<Sql, …>`, and `Omit`
        // over an interface produces a MAPPED type — which drops call
        // signatures. So the tagged-template form, the library's own
        // documented API and the only form that parameterizes safely, is
        // untypeable on a transaction handle (TS2349).
        //
        // Widening back to the callable `Sql` shape fixes the TYPE only:
        // `rawTx` is the same handle, the statement still runs on the
        // transaction's own connection, and that connection is what holds the
        // row lock this whole barrier depends on. Using `tx.unsafe()` instead
        // would typecheck, but it would change the mechanism.
        const tx = rawTx as unknown as postgres.Sql;
        await tx`select id from profile where id = ${race.userId} for update`;

        winner = POST(postRequest(race, payload));
        loser = POST(postRequest(race, payload));

        const deadline = Date.now() + 30_000;
        while (Date.now() < deadline) {
          const rows = await probe<{ waiting: number }[]>`
            select count(*)::int as waiting
            from pg_locks
            where not granted and locktype in ('transactionid', 'tuple')`;
          blockedPeak = Math.max(blockedPeak, rows[0]?.waiting ?? 0);
          if (blockedPeak >= 2) break;
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
      });

      // THE OVERLAP PROOF: both requests were blocked at the same instant,
      // inside their transactions, before either had committed.
      expect(
        blockedPeak,
        "both submissions must be blocked simultaneously — otherwise they never overlapped and this test proves nothing"
      ).toBeGreaterThanOrEqual(2);

      const responses = await Promise.all([winner!, loser!]);
      const statuses = responses.map((response) => response.status).sort();
      expect(statuses).toEqual([200, 201]);

      const bodies = await Promise.all(
        responses.map((response) => response.json())
      );
      // The replay body is the 201 body.
      expect(bodies[0]).toEqual(bodies[1]);

      // EXACTLY ONE INSERT.
      const rows = await db
        .select({ id: round.id })
        .from(round)
        .where(and(eq(round.userId, race.userId), eq(round.externalId, key)));
      expect(rows).toHaveLength(1);
    } finally {
      await probe.end({ timeout: 5 });
      await holder.end({ timeout: 5 });
    }
  }, 180_000);

  test("MB4-complement N parallel submissions of the same key produce zero 409s and one round", async () => {
    // A weaker assertion than the forced interleave above, and deliberately
    // not the only coverage — but it does catch a handler that only survives
    // one specific ordering.
    const key = `mb4c-${randomUUID()}`;
    const payload = submission({
      userId: parallel.userId,
      externalId: key,
      teeTime: "2026-06-02T10:00:00.000Z",
    });

    const responses = await Promise.all(
      Array.from({ length: 5 }, () => POST(postRequest(parallel, payload)))
    );
    const statuses = responses.map((response) => response.status);

    expect(statuses.filter((status) => status === 409)).toHaveLength(0);
    expect(statuses.filter((status) => status === 201)).toHaveLength(1);
    expect(statuses.filter((status) => status === 200)).toHaveLength(4);

    const rows = await db
      .select({ id: round.id })
      .from(round)
      .where(and(eq(round.userId, parallel.userId), eq(round.externalId, key)));
    expect(rows).toHaveLength(1);
  }, 180_000);

  // ── §2 merge-blocking case 5: over-limit quarantine ─────────────────────
  test("MB5 over-limit → 201 + status 'quarantined', excluded from the count and the handicap", async () => {
    // Fill the free tier with active rounds written directly.
    await db.insert(round).values(
      Array.from({ length: FREE_TIER_ROUND_LIMIT }, (_, index) => ({
        userId: over.userId,
        courseId,
        teeId,
        teeTime: new Date(Date.UTC(2025, 0, index + 1, 10)),
        totalStrokes: 90,
        parPlayed: 71,
        adjustedGrossScore: 90,
        adjustedPlayedScore: 90,
        courseHandicap: 12,
        scoreDifferential: 16.5,
        existingHandicapIndex: 18.0,
        updatedHandicapIndex: 18.0,
        courseRatingUsed: 71,
        slopeRatingUsed: 130,
        holesPlayed: 18,
        approvalStatus: "approved",
      }))
    );

    const key = `mb5-${randomUUID()}`;
    const { response, body } = await post(
      over,
      submission({
        userId: over.userId,
        externalId: key,
        teeTime: "2026-06-03T10:00:00.000Z",
      })
    );

    // §5: accepted and stored. NEVER 403, and there is no
    // `round_limit_reached` code on this surface.
    expect(response.status).toBe(201);
    expect(body.status).toBe("quarantined");

    const [stored] = await db
      .select()
      .from(round)
      .where(and(eq(round.userId, over.userId), eq(round.externalId, key)));
    expect(stored!.quarantined).toBe(true);

    // Excluded from the free-tier COUNT: the entitlement RPC counts only
    // non-quarantined rounds, so `rounds_used` did not move past the limit.
    const [counted] = await db
      .select({ value: sql<number>`count(*)::int` })
      .from(round)
      .where(
        and(eq(round.userId, over.userId), eq(round.quarantined, false))
      );
    expect(counted!.value).toBe(FREE_TIER_ROUND_LIMIT);

    // Excluded from the HANDICAP: the processor's input filter is
    // `approvalStatus = 'approved' AND quarantined = false`.
    const [handicapInputs] = await db
      .select({ value: sql<number>`count(*)::int` })
      .from(round)
      .where(
        and(
          eq(round.userId, over.userId),
          eq(round.approvalStatus, "approved"),
          eq(round.quarantined, false)
        )
      );
    expect(handicapInputs!.value).toBe(FREE_TIER_ROUND_LIMIT);

    // And the replay of a quarantined round reflects CURRENT state (§2 rule 2).
    const replay = await post(
      over,
      submission({
        userId: over.userId,
        externalId: key,
        teeTime: "2026-06-03T10:00:00.000Z",
      })
    );
    expect(replay.response.status).toBe(200);
    expect(replay.body.status).toBe("quarantined");
  }, 180_000);

  // ── The server-side hcpStrokes derivation (§2's build dependency) ───────
  test("hcpStrokes is DERIVED server-side, not taken from the client", async () => {
    const key = `hcp-${randomUUID()}`;
    const { response, body } = await post(
      firstParty,
      submission({
        userId: firstParty.userId,
        externalId: key,
        teeTime: "2026-07-01T10:00:00.000Z",
      })
    );
    expect(response.status).toBe(201);

    const stored = await db
      .select({ hcpStrokes: score.hcpStrokes, hcp: hole.hcp })
      .from(score)
      .innerJoin(hole, eq(hole.id, score.holeId))
      .where(eq(score.roundId, body.id as number));

    // The client sent 0 on every hole. handicapIndex 18 on slope 130 /
    // rating 71 / par 71 → courseHandicap 21, so 18 holes get one stroke and
    // the three hardest get a second.
    expect(stored).toHaveLength(18);
    const total = stored.reduce((sum, row) => sum + row.hcpStrokes, 0);
    expect(total).toBeGreaterThan(0);
    const doubles = stored
      .filter((row) => row.hcpStrokes === 2)
      .map((row) => row.hcp)
      .sort((a, b) => a - b);
    expect(doubles).toEqual([1, 2, 3]);
  }, 90_000);

  // ── The 201 / 200 / list-entry shape guarantee (§2 rule 2, §5) ──────────
  test("the 201 body is byte-identical in shape to serializeV1Round AND to the GET list entry", async () => {
    const key = `shape-${randomUUID()}`;
    const { body } = await post(
      firstParty,
      submission({
        userId: firstParty.userId,
        externalId: key,
        teeTime: "2026-07-02T10:00:00.000Z",
      })
    );

    const [stored] = await db
      .select()
      .from(round)
      .where(eq(round.id, body.id as number));
    expect(body).toEqual(JSON.parse(JSON.stringify(serializeV1Round(stored!))));

    const listResponse = await GET(
      v1Request(oauth, `/rounds?externalId=${encodeURIComponent(key)}`)
    );
    const page = (await listResponse.json()) as {
      data: Record<string, unknown>[];
    };
    expect(page.data).toHaveLength(1);
    // Same keys, same values — one serializer, three response bodies.
    expect(page.data[0]).toEqual(body);
  }, 90_000);

  // ── Auth, entitlement, validation ──────────────────────────────────────
  test("no Bearer token → 401 unauthorized as problem+json", async () => {
    const response = await POST(
      new Request("https://api.handicappin.com/api/v1/rounds", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      })
    );
    expect(response.status).toBe(401);
    expect(response.headers.get("Content-Type")).toContain(
      "application/problem+json"
    );
    expect(await response.json()).toMatchObject({ code: "unauthorized" });
  }, 60_000);

  test("an account that never completed plan selection → 403 plan_required", async () => {
    const { response, body } = await post(
      planless,
      submission({ userId: planless.userId, teeTime: "2026-07-03T10:00:00.000Z" })
    );
    expect(response.status).toBe(403);
    expect(body.code).toBe("plan_required");
    // And nothing was written.
    const rows = await db
      .select({ id: round.id })
      .from(round)
      .where(eq(round.userId, planless.userId));
    expect(rows).toHaveLength(0);
  }, 90_000);

  test("submitting on ANOTHER user's behalf → 403 forbidden, nothing written", async () => {
    const { response, body } = await post(
      stranger,
      submission({
        // The body claims the owner; the token is the stranger's.
        userId: firstParty.userId,
        externalId: `cross-${randomUUID()}`,
        teeTime: "2026-07-04T10:00:00.000Z",
      })
    );
    expect(response.status).toBe(403);
    expect(body.code).toBe("forbidden");

    const rows = await db
      .select({ id: round.id })
      .from(round)
      .where(
        and(
          eq(round.userId, firstParty.userId),
          eq(round.teeTime, new Date("2026-07-04T10:00:00.000Z"))
        )
      );
    expect(rows).toHaveLength(0);
  }, 90_000);

  test("CROSS-USER REPLAY: another account's externalId is never replayed back", async () => {
    // The replay lookup runs on the Drizzle handle, which bypasses RLS — so
    // its `userId` predicate is the ONLY control here.
    const key = `xuser-${randomUUID()}`;
    const owned = await post(
      firstParty,
      submission({
        userId: firstParty.userId,
        externalId: key,
        teeTime: "2026-07-05T10:00:00.000Z",
      })
    );
    expect(owned.response.status).toBe(201);

    const other = await post(
      stranger,
      submission({
        userId: stranger.userId,
        externalId: key,
        teeTime: "2026-07-05T10:00:00.000Z",
      })
    );
    // A fresh round for the stranger — never a 200 replay of someone else's.
    expect(other.response.status).toBe(201);
    expect(other.body.id).not.toBe(owned.body.id);

    const [strangerRound] = await db
      .select({ userId: round.userId })
      .from(round)
      .where(eq(round.id, other.body.id as number));
    expect(strangerRound!.userId).toBe(stranger.userId);
  }, 90_000);

  test("teeTime outside D5's window → 422 with the field-level code", async () => {
    for (const teeTime of [
      "1989-12-31T00:00:00.000Z",
      new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
    ]) {
      const { response, body } = await post(
        firstParty,
        submission({ userId: firstParty.userId, teeTime })
      );
      expect(response.status).toBe(422);
      expect(body.code).toBe("validation_failed");
      const errors = body.errors as { path: string; code: string }[];
      expect(errors.map((entry) => entry.code)).toContain(
        "tee_time_out_of_window"
      );
    }
  }, 90_000);

  test("a non-JSON content type → 400 malformed_request", async () => {
    const response = await POST(
      v1Request(firstParty, "/rounds", {
        method: "POST",
        headers: { "content-type": "text/plain" },
        body: "{}",
      })
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: "malformed_request" });
  }, 60_000);

  test("unparseable JSON → 400 malformed_request", async () => {
    const response = await POST(
      v1Request(firstParty, "/rounds", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{ not json",
      })
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: "malformed_request" });
  }, 60_000);

  test("budget exhausted → 429 rate_limited with the header trio", async () => {
    const reset = Date.now() + 42_000;
    limiter.outcomes.push({
      success: false,
      failedClosed: false,
      limit: 60,
      remaining: 0,
      reset,
    });

    const response = await POST(
      postRequest(firstParty, submission({ userId: firstParty.userId }))
    );

    expect(response.status).toBe(429);
    expect(response.headers.get("X-RateLimit-Limit")).toBe("60");
    expect(Number(response.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(await response.json()).toMatchObject({ code: "rate_limited" });
  }, 60_000);

  test("limiter unavailable → 503 service_unavailable, Retry-After 60", async () => {
    limiter.outcomes.push({
      success: false,
      failedClosed: true,
      limit: 0,
      remaining: 0,
      reset: Date.now() + 60_000,
    });

    const response = await POST(
      postRequest(firstParty, submission({ userId: firstParty.userId }))
    );

    expect(response.status).toBe(503);
    expect(response.headers.get("Retry-After")).toBe("60");
    expect(await response.json()).toMatchObject({
      code: "service_unavailable",
    });
  }, 60_000);
});
