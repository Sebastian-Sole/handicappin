/**
 * `GET /v1/rounds` (T13.3) against the REAL local Supabase stack, through the
 * REAL route handler.
 *
 * Contract §6 requires that "**integration tests must cover both principal
 * classes per route**" — the same route, same code path, same user can see
 * different data depending on whether the token carries `client_id`, and a
 * route tested only with a first-party token is untested on the path that
 * matters. So every data-shape assertion below runs twice, once per class,
 * driven by `helpers/v1-principals`.
 *
 * Real: tokens (password sign-in and the full OAuth 2.1 authorization-code +
 * PKCE flow), RLS, the `get_connected_entitlement()` RPC, PostgREST, and the
 * handler itself.
 *
 * Mocked: the rate limiter, and ONLY it. `RATE_LIMIT_ENABLED` is unset
 * locally, so the real fail-closed limiter would deny every request with a
 * 503 and nothing else in this file could be exercised; and the 429 / 503
 * branches are otherwise unreachable without a live Upstash bucket. The mock
 * also lets the suite assert what the handler PASSES the limiter — the two
 * arguments that fail silently when wrong.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";

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

/**
 * Limiter double. `vi.hoisted` because `vi.mock`'s factory is hoisted above
 * every import and cannot close over ordinary module-scope bindings.
 */
const limiter = vi.hoisted(() => ({
  calls: [] as { principal: unknown; family: unknown }[],
  state: {
    outcome: {
      success: true,
      failedClosed: false,
      limit: 120,
      remaining: 119,
      reset: 0,
    } as {
      success: boolean;
      failedClosed: boolean;
      limit: number;
      remaining: number;
      reset: number;
      reason?: string;
      family?: string;
    },
  },
}));

vi.mock("@/lib/rate-limit", () => ({
  enforcePublicApiRateLimit: async (
    _request: Request,
    principal: unknown,
    family: unknown
  ) => {
    limiter.calls.push({ principal, family });
    return limiter.state.outcome;
  },
}));

const { GET } = await import("@/app/api/v1/rounds/route");
const { serializeV1Round } = await import(
  "@/app/api/v1/_lib/serializers/round"
);
const { db } = await import("@/db");
const { profile, course, teeInfo, round } = await import("@/db/schema");

const describeIfLocal = hasLocalStack ? describe : describe.skip;

const EMAILS = {
  owner: "v1-rounds-read-owner@handicappin.local",
  decoy: "v1-rounds-read-decoy@handicappin.local",
  planless: "v1-rounds-read-planless@handicappin.local",
} as const;
const COURSE_NAME = "V1 Rounds Read Course";

let firstParty: TestPrincipal;
let oauth: TestPrincipal;
let decoy: TestPrincipal;
let planless: TestPrincipal;
let ownerId: string;
let decoyId: string;
let courseId: number;
let teeId: number;

/** Round ids by role, so assertions can name them. */
const ids = {
  oldest: 0,
  quarantined: 0,
  newest: 0,
  decoy: 0,
};

const EXTERNAL_ID = `fitbull-${randomUUID()}`;

function baseRound(
  userId: string,
  teeTime: Date,
  overrides: Partial<typeof round.$inferInsert> = {}
): typeof round.$inferInsert {
  return {
    userId,
    courseId,
    teeId,
    teeTime,
    totalStrokes: 90,
    parPlayed: 71,
    adjustedGrossScore: 90,
    adjustedPlayedScore: 90,
    courseHandicap: 12,
    scoreDifferential: 16.5,
    existingHandicapIndex: 10.4,
    updatedHandicapIndex: 10.4,
    courseRatingUsed: 71,
    slopeRatingUsed: 130,
    holesPlayed: 18,
    approvalStatus: "approved",
    ...overrides,
  };
}

function allowLimiter() {
  limiter.state.outcome = {
    success: true,
    failedClosed: false,
    limit: 120,
    remaining: 119,
    reset: Date.now() + 60_000,
  };
}

interface RoundsPageBody {
  data: Record<string, unknown>[];
  pagination: { limit: number; offset: number; count: number; hasMore: boolean };
}

async function getRounds(
  principal: TestPrincipal,
  query = ""
): Promise<{ response: Response; body: RoundsPageBody }> {
  const response = await GET(v1Request(principal, `/rounds${query}`));
  return { response, body: (await response.clone().json()) as RoundsPageBody };
}

describeIfLocal("GET /v1/rounds (real local Supabase)", () => {
  beforeAll(async () => {
    await sweepStaleOAuthTestClients();
    for (const email of Object.values(EMAILS)) {
      const admin = adminClient();
      const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
      const existing = data?.users.find((u) => u.email === email);
      if (existing) {
        await db.delete(round).where(eq(round.userId, existing.id));
        await db.delete(profile).where(eq(profile.id, existing.id));
      }
      await deleteAuthUserByEmail(email);
    }

    // Stale course/tee from an aborted run.
    for (const stale of await db
      .select({ id: course.id })
      .from(course)
      .where(eq(course.name, COURSE_NAME))) {
      await db.delete(teeInfo).where(eq(teeInfo.courseId, stale.id));
      await db.delete(course).where(eq(course.id, stale.id));
    }

    const owner = await mintFirstPartyPrincipal(EMAILS.owner);
    firstParty = owner;
    ownerId = owner.userId;
    oauth = await mintOAuthPrincipal({
      userClient: owner.userClient,
      userId: owner.userId,
    });

    const decoyOwner = await mintFirstPartyPrincipal(EMAILS.decoy);
    decoy = decoyOwner;
    decoyId = decoyOwner.userId;

    planless = await mintFirstPartyPrincipal(EMAILS.planless);

    await db.insert(profile).values([
      {
        id: ownerId,
        email: EMAILS.owner,
        name: "V1 Rounds Owner",
        verified: true,
        handicapIndex: 10.4,
        planSelected: "unlimited",
        subscriptionStatus: "active",
      },
      {
        id: decoyId,
        email: EMAILS.decoy,
        name: "V1 Rounds Decoy",
        verified: true,
        handicapIndex: 20.1,
        planSelected: "unlimited",
        subscriptionStatus: "active",
      },
      {
        // No `planSelected` → `is_provisioned = false` → 403 plan_required.
        id: planless.userId,
        email: EMAILS.planless,
        name: "V1 Rounds Planless",
        verified: true,
        handicapIndex: 0,
      },
    ]);

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
        name: "Blue",
        gender: "mens",
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
        distanceMeasurement: "yards",
        approvalStatus: "approved",
        submittedBy: ownerId,
      })
      .returning();
    teeId = createdTee!.id;

    const inserted = await db
      .insert(round)
      .values([
        baseRound(ownerId, new Date("2026-07-01T10:00:00.000Z"), {
          externalId: EXTERNAL_ID,
          notes: "oldest",
        }),
        baseRound(ownerId, new Date("2026-07-02T10:00:00.000Z"), {
          quarantined: true,
          notes: "over the free-tier limit",
        }),
        baseRound(ownerId, new Date("2026-07-03T10:00:00.000Z"), {
          notes: "newest",
          nineHoleSection: "back",
          holesPlayed: 9,
        }),
        baseRound(decoyId, new Date("2026-07-04T10:00:00.000Z"), {
          notes: "another user's round",
        }),
      ])
      .returning();

    ids.oldest = inserted[0]!.id;
    ids.quarantined = inserted[1]!.id;
    ids.newest = inserted[2]!.id;
    ids.decoy = inserted[3]!.id;
  }, 120_000);

  afterAll(async () => {
    for (const userId of [ownerId, decoyId, planless?.userId]) {
      if (userId) await db.delete(round).where(eq(round.userId, userId));
    }
    if (teeId) await db.delete(teeInfo).where(eq(teeInfo.id, teeId));
    if (courseId) await db.delete(course).where(eq(course.id, courseId));
    for (const userId of [ownerId, decoyId, planless?.userId]) {
      if (userId) await db.delete(profile).where(eq(profile.id, userId));
    }
    await oauth?.cleanup();
    await firstParty?.cleanup();
    await decoy?.cleanup();
    await planless?.cleanup();
  }, 120_000);

  beforeEach(() => {
    limiter.calls.length = 0;
    allowLimiter();
  });

  // ── Both principal classes (§6) ─────────────────────────────────────────
  for (const className of ["first-party", "oauth"] as const) {
    const principalFor = () => (className === "oauth" ? oauth : firstParty);

    describe(`principal class: ${className}`, () => {
      test("200 with the caller's rounds and the stability header", async () => {
        const { response, body } = await getRounds(principalFor());

        expect(response.status).toBe(200);
        expect(response.headers.get("X-API-Stability")).toBe("internal");
        expect(response.headers.get("Content-Type")).toContain(
          "application/json"
        );
        expect(body.data.map((entry) => entry.id).sort()).toEqual(
          [ids.oldest, ids.quarantined, ids.newest].sort()
        );
      }, 60_000);

      test("a QUARANTINED round APPEARS in the list, with status 'quarantined'", async () => {
        const { body } = await getRounds(principalFor());
        const entry = body.data.find((r) => r.id === ids.quarantined);

        expect(entry, "quarantined round must not be filtered out").toBeDefined();
        expect(entry!.status).toBe("quarantined");
        // The raw column never ships — §5 rejects a `quarantined: boolean`.
        expect(entry).not.toHaveProperty("quarantined");
      }, 60_000);

      test("an active round shows status 'active'", async () => {
        const { body } = await getRounds(principalFor());
        const entry = body.data.find((r) => r.id === ids.newest);
        expect(entry!.status).toBe("active");
      }, 60_000);

      test("every entry carries a 'pending' handicapRevision and a provisional handicapIndex", async () => {
        const { body } = await getRounds(principalFor());
        expect(body.data.length).toBeGreaterThan(0);
        for (const entry of body.data) {
          expect(entry.handicapRevision).toBe("pending");
          expect(typeof entry.handicapIndex).toBe("number");
        }
      }, 60_000);

      test("CROSS-USER ISOLATION: another user's round is never returned", async () => {
        const { body } = await getRounds(principalFor());
        expect(body.data.map((entry) => entry.id)).not.toContain(ids.decoy);
        // And the decoy's own token sees only its own round.
        const { body: decoyBody } = await getRounds(decoy);
        expect(decoyBody.data.map((entry) => entry.id)).toEqual([ids.decoy]);
      }, 60_000);

      test("ordering is teeTime DESC, id DESC", async () => {
        const { body } = await getRounds(principalFor());
        expect(body.data.map((entry) => entry.id)).toEqual([
          ids.newest,
          ids.quarantined,
          ids.oldest,
        ]);
      }, 60_000);

      test("?externalId= returns exactly the round stored under that key", async () => {
        const { body } = await getRounds(
          principalFor(),
          `?externalId=${encodeURIComponent(EXTERNAL_ID)}`
        );
        expect(body.data.map((entry) => entry.id)).toEqual([ids.oldest]);
        expect(body.data[0]!.externalId).toBe(EXTERNAL_ID);
      }, 60_000);

      test("?externalId= for an unknown key is an empty page, not a 404", async () => {
        const { response, body } = await getRounds(
          principalFor(),
          "?externalId=never-submitted"
        );
        expect(response.status).toBe(200);
        expect(body.data).toEqual([]);
        expect(body.pagination.hasMore).toBe(false);
      }, 60_000);

      test("limit/offset paginate and hasMore is honest", async () => {
        const first = await getRounds(principalFor(), "?limit=2");
        expect(first.body.data.map((e) => e.id)).toEqual([
          ids.newest,
          ids.quarantined,
        ]);
        expect(first.body.pagination).toEqual({
          limit: 2,
          offset: 0,
          count: 2,
          hasMore: true,
        });

        const second = await getRounds(principalFor(), "?limit=2&offset=2");
        expect(second.body.data.map((e) => e.id)).toEqual([ids.oldest]);
        expect(second.body.pagination).toEqual({
          limit: 2,
          offset: 2,
          count: 1,
          hasMore: false,
        });
      }, 60_000);

      test("the limiter is called with the principal PARTS and the 'reads' family", async () => {
        await getRounds(principalFor());

        expect(limiter.calls).toHaveLength(1);
        const call = limiter.calls[0]!;
        // Named family — omitting it falls back to the legacy 60/min bucket.
        expect(call.family).toBe("reads");
        // PARTS, never a composed key string.
        expect(typeof call.principal).toBe("object");
        const parts = call.principal as { userId: string; clientId?: string };
        expect(parts.userId).toBe(ownerId);
        if (className === "oauth") {
          expect(parts.clientId).toBe(oauth.clientId);
        } else {
          expect(parts.clientId).toBeUndefined();
        }
      }, 60_000);
    });
  }

  // ── The serializer reuse guarantee (§2 rule 2 / §5) ─────────────────────
  test("a list entry is byte-identical to serializeV1Round of the stored row — the shape POST /v1/rounds returns", async () => {
    const [storedRow] = await db
      .select()
      .from(round)
      .where(eq(round.id, ids.quarantined));

    const { body } = await getRounds(oauth);
    const entry = body.data.find((r) => r.id === ids.quarantined);

    // `storedRow` is exactly what `submitScorecard` returns as `round`, so
    // this is the assertion that T13.4's 201 body and this list entry cannot
    // diverge.
    expect(entry).toEqual(
      JSON.parse(JSON.stringify(serializeV1Round(storedRow!)))
    );
  }, 60_000);

  test("teeTime round-trips as the UTC instant it was stored as", async () => {
    const { body } = await getRounds(firstParty);
    const entry = body.data.find((r) => r.id === ids.oldest);
    expect(entry!.teeTime).toBe("2026-07-01T10:00:00.000Z");
  }, 60_000);

  // ── Auth, entitlement, validation ──────────────────────────────────────
  test("no Bearer token → 401 unauthorized as problem+json", async () => {
    const response = await GET(
      new Request("https://api.handicappin.com/api/v1/rounds")
    );
    expect(response.status).toBe(401);
    expect(response.headers.get("Content-Type")).toContain(
      "application/problem+json"
    );
    expect(response.headers.get("X-API-Stability")).toBe("internal");
    expect(await response.json()).toMatchObject({ code: "unauthorized" });
    // Rejected before the limiter is consulted.
    expect(limiter.calls).toHaveLength(0);
  }, 60_000);

  test("an account that never completed plan selection → 403 plan_required", async () => {
    const response = await GET(v1Request(planless, "/rounds"));
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: "plan_required" });
  }, 60_000);

  test("an invalid limit → 422 validation_failed naming the field", async () => {
    const response = await GET(v1Request(firstParty, "/rounds?limit=0"));
    expect(response.status).toBe(422);
    const problem = (await response.json()) as {
      code: string;
      errors: { path: string }[];
    };
    expect(problem.code).toBe("validation_failed");
    expect(problem.errors.map((e) => e.path)).toContain("limit");
  }, 60_000);

  test("unknown query parameters are ignored, not rejected", async () => {
    const { response, body } = await getRounds(
      firstParty,
      "?external_id=typo&order=asc"
    );
    expect(response.status).toBe(200);
    expect(body.data).toHaveLength(3);
  }, 60_000);

  // ── Rate limiting (§3) ─────────────────────────────────────────────────
  test("budget exhausted → 429 rate_limited with Retry-After and the X-RateLimit trio", async () => {
    const reset = Date.now() + 42_000;
    limiter.state.outcome = {
      success: false,
      failedClosed: false,
      limit: 120,
      remaining: 0,
      reset,
      family: "reads",
    };

    const response = await GET(v1Request(oauth, "/rounds"));

    expect(response.status).toBe(429);
    expect(response.headers.get("Content-Type")).toContain(
      "application/problem+json"
    );
    expect(Number(response.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(response.headers.get("X-RateLimit-Limit")).toBe("120");
    expect(response.headers.get("X-RateLimit-Remaining")).toBe("0");
    expect(response.headers.get("X-RateLimit-Reset")).toBe(
      String(Math.ceil(reset / 1000))
    );
    expect(await response.json()).toMatchObject({
      code: "rate_limited",
      status: 429,
    });
  }, 60_000);

  test("limiter unavailable → 503 service_unavailable with Retry-After: 60 and NO X-RateLimit headers", async () => {
    limiter.state.outcome = {
      success: false,
      failedClosed: true,
      limit: 0,
      remaining: 0,
      reset: Date.now() + 60_000,
      reason: "missing-credentials",
    };

    const response = await GET(v1Request(oauth, "/rounds"));

    expect(response.status).toBe(503);
    expect(response.headers.get("Retry-After")).toBe("60");
    expect(response.headers.get("X-RateLimit-Limit")).toBeNull();
    expect(response.headers.get("X-RateLimit-Remaining")).toBeNull();
    expect(response.headers.get("X-RateLimit-Reset")).toBeNull();
    expect(await response.json()).toMatchObject({
      code: "service_unavailable",
      status: 503,
    });
  }, 60_000);

  test("the limiter's internal reason reaches NEITHER the body NOR any header", async () => {
    for (const reason of [
      "disabled",
      "missing-credentials",
      "init-error",
      "runtime-error",
    ]) {
      limiter.state.outcome = {
        success: false,
        failedClosed: true,
        limit: 0,
        remaining: 0,
        reset: Date.now() + 60_000,
        reason,
      };

      const response = await GET(v1Request(firstParty, "/rounds"));
      const body = await response.text();
      const headers = JSON.stringify([...response.headers.entries()]);

      expect(body).not.toContain(reason);
      expect(headers).not.toContain(reason);
    }
  }, 60_000);
});
