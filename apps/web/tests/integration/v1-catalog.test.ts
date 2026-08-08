/**
 * `GET /v1/courses` and `GET /v1/tees` against a REAL local Supabase stack,
 * with REAL tokens of BOTH principal classes.
 *
 * Contract §6 requires it: "integration tests must cover both principal
 * classes per route… a handler tested only with a first-party token is
 * untested on the path that matters". For the catalog the interesting result
 * is that the two classes see the SAME data — the catalog is approved
 * reference data, not user data — and this suite asserts that equality
 * byte-for-byte rather than assuming it. If a deny-policy ever made the
 * catalog asymmetric, these assertions are what would notice.
 *
 * It also pins the second half of the extraction: `tee.fetchTees` and
 * `course.searchCourses` now call the SAME shared catalog service the `/v1`
 * routes do, so this suite drives both surfaces over one seeded fixture and
 * asserts they agree where they must and differ exactly where they should —
 * the submitter's own pending tee, which tRPC shows and `/v1` does not.
 *
 * The rate limiter is the one thing mocked: it is Upstash infrastructure that
 * is not part of the local stack, and with `RATE_LIMIT_ENABLED` unset the
 * real module fails closed on every call, which would turn every assertion
 * below into a 503. `tests/unit/api/v1/catalog-routes.test.ts` covers the
 * denial paths; here the mock also records what the handlers passed it, so
 * the "principal parts + named family" contract is asserted against tokens
 * GoTrue really minted rather than hand-built ones. Note that each allowed
 * request now records TWO calls — the pre-auth `ip:{ip}` bucket, then the
 * per-principal one (§3) — so the recorded-call indices below are paired.
 */
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import { randomUUID } from "crypto";
import { eq, inArray } from "drizzle-orm";

const enforcePublicApiRateLimit = vi.fn();
vi.mock("@/lib/rate-limit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/rate-limit")>();
  return {
    ...actual,
    enforcePublicApiRateLimit: (...args: unknown[]) =>
      enforcePublicApiRateLimit(...args),
  };
});

import { courseRouter } from "@/server/api/routers/course";
import { teeRouter } from "@/server/api/routers/tee";
import { createCallerFactory } from "@/server/api/trpc";
import { searchCatalogCourses } from "@/server/services/catalog";
import {
  deleteAuthUserByEmail,
  hasLocalStack,
  mintFirstPartyPrincipal,
  mintOAuthPrincipal,
  sweepStaleOAuthTestClients,
  v1Request,
  type TestPrincipal,
} from "./helpers/v1-principals";

const { GET: getCourses } = await import("@/app/api/v1/courses/route");
const { GET: getTees } = await import("@/app/api/v1/tees/route");
const { db } = await import("@/db");
const { course, hole, profile, teeInfo } = await import("@/db/schema");

const describeIfLocal = hasLocalStack ? describe : describe.skip;

/**
 * A term unique to this fixture. Course search is a substring match over the
 * whole table, so a generic term would pick up seed data and make the
 * assertions depend on what else is loaded locally.
 */
const FIXTURE = "V1CatalogFixture";

const EMAILS = {
  owner: "v1-catalog-owner@handicappin.local",
  other: "v1-catalog-other@handicappin.local",
} as const;

/**
 * This suite's OWN OAuth-client name prefix, deliberately NOT starting with
 * the helper's shared `v1-test-client-`.
 *
 * Vitest runs suite files in parallel, and `sweepStaleOAuthTestClients()`
 * deletes every client matching its prefix — including ones a concurrently
 * running suite has live. Sharing the default prefix with
 * `v1-scaffolding.test.ts` therefore made each run a coin flip over which
 * suite had its token's client deleted out from under it. A disjoint prefix
 * makes the two sweeps unable to reach each other's clients, while this
 * suite still reclaims its own leaks on the way in.
 */
const CLIENT_PREFIX = "v1-catalog-test-client-";

let firstParty: TestPrincipal;
let oauth: TestPrincipal;
let otherUserId: string;

let approvedCourseId: number;
let pendingCourseId: number;
let approvedTeeId: number;
let archivedTeeId: number;
let ownerPendingTeeId: number;
let otherPendingTeeId: number;

/** An id no course can have — the "absent" half of the catalog-miss pair. */
const ABSENT_COURSE_ID = 2_147_483_000;

/**
 * A caller with no submissions of their own, so tRPC's own-pending widening
 * contributes nothing and the two surfaces must return the identical set.
 */
const NO_SUBMISSIONS_USER_ID = "44444444-4444-4444-8444-444444444444";

const createCourseCaller = createCallerFactory(courseRouter);
const createTeeCaller = createCallerFactory(teeRouter);

function callerCtx(userId: string) {
  return { user: { id: userId }, supabase: {} } as unknown as Parameters<
    typeof createTeeCaller
  >[0];
}

function allowed() {
  return {
    success: true,
    failedClosed: false,
    family: "reads" as const,
    limit: 120,
    remaining: 119,
    reset: Date.now() + 60_000,
  };
}

/**
 * Ratings the fixture uses, chosen so a string/number confusion is visible:
 * every `courseRating*` is a non-integer, so a missing `Number()` coercion
 * shows up as `"71.4" !== 71.4` rather than passing by luck.
 *
 * They are written as NUMBERS, matching `decimal<"number">()` in the schema.
 * The insert form does not weaken the assertions: the columns are postgres
 * `decimal`, and the driver hands them back as **strings either way**
 * (verified against the local stack — inserting `71.4` and `"71.4"` both read
 * back as the string `"71.4"`). So `listCourseTees`'s coercion is still the
 * thing under test, and the declared type no longer has to be cast around.
 */
const RATINGS = {
  courseRating18: 71.4,
  slopeRating18: 129,
  courseRatingFront9: 35.6,
  slopeRatingFront9: 127,
  courseRatingBack9: 35.8,
  slopeRatingBack9: 131,
} as const;

/**
 * The insert shape, taken from the schema rather than restated.
 *
 * `Record<string, unknown>` overrides used to make `teeValues` return a
 * widened object — `gender: string`, `distanceMeasurement: string`, and no
 * `name` at all — which is five `TS2769`s at the `db.insert` call sites. They
 * never surfaced because Vitest transpiles without type-checking and
 * `next build` does not compile tests. Typing the return pins the enum
 * columns to their unions and makes `name` a required override.
 */
type TeeInsert = typeof teeInfo.$inferInsert;

function teeValues(
  overrides: Partial<TeeInsert> & { name: string }
): TeeInsert {
  return {
    courseId: approvedCourseId,
    gender: "mens",
    ...RATINGS,
    outPar: 36,
    inPar: 36,
    totalPar: 72,
    outDistance: 3000,
    inDistance: 3100,
    totalDistance: 6100,
    distanceMeasurement: "meters",
    ...overrides,
  };
}

describeIfLocal("/v1 catalog reads (real local Supabase)", () => {
  beforeAll(async () => {
    await sweepStaleOAuthTestClients(CLIENT_PREFIX);
    for (const email of Object.values(EMAILS)) {
      await deleteAuthUserByEmail(email);
    }
    // Any wreckage from an earlier crashed run.
    await db.delete(course).where(eq(course.city, FIXTURE));

    const owner = await mintFirstPartyPrincipal(EMAILS.owner);
    firstParty = owner;
    await db.insert(profile).values({
      id: owner.userId,
      email: EMAILS.owner,
      name: "V1 Catalog Owner",
      verified: true,
      planSelected: "free",
    });

    // Same human, second token: the OAuth class.
    oauth = await mintOAuthPrincipal({
      userClient: owner.userClient,
      userId: owner.userId,
      clientName: `${CLIENT_PREFIX}${randomUUID().slice(0, 8)}`,
    });

    const other = await mintFirstPartyPrincipal(EMAILS.other);
    otherUserId = other.userId;
    await db.insert(profile).values({
      id: other.userId,
      email: EMAILS.other,
      name: "V1 Catalog Other",
      verified: true,
      planSelected: "free",
    });

    const [approvedCourse] = await db
      .insert(course)
      .values({
        name: `${FIXTURE} Approved Links`,
        approvalStatus: "approved",
        country: "Norway",
        city: FIXTURE,
        website: "https://example.test/approved",
      })
      .returning({ id: course.id });
    approvedCourseId = approvedCourse.id;

    const [pendingCourse] = await db
      .insert(course)
      .values({
        name: `${FIXTURE} Pending Moor`,
        approvalStatus: "pending",
        country: "Norway",
        city: FIXTURE,
        submittedBy: owner.userId,
      })
      .returning({ id: course.id });
    pendingCourseId = pendingCourse.id;

    const [approvedTee] = await db
      .insert(teeInfo)
      .values(
        teeValues({
          name: "Yellow",
          approvalStatus: "approved",
          isArchived: false,
        })
      )
      .returning({ id: teeInfo.id });
    approvedTeeId = approvedTee.id;

    // Approved but superseded — still `approved`, which is exactly why the
    // archive flag has to be part of the visibility predicate.
    const [archivedTee] = await db
      .insert(teeInfo)
      .values(
        teeValues({
          name: "Retired White",
          approvalStatus: "approved",
          isArchived: true,
        })
      )
      .returning({ id: teeInfo.id });
    archivedTeeId = archivedTee.id;

    const [ownerPendingTee] = await db
      .insert(teeInfo)
      .values(
        teeValues({
          name: "Owner Pending Blue",
          approvalStatus: "pending",
          submittedBy: owner.userId,
        })
      )
      .returning({ id: teeInfo.id });
    ownerPendingTeeId = ownerPendingTee.id;

    const [otherPendingTee] = await db
      .insert(teeInfo)
      .values(
        teeValues({
          name: "Other Pending Red",
          gender: "ladies",
          approvalStatus: "pending",
          submittedBy: other.userId,
        })
      )
      .returning({ id: teeInfo.id });
    otherPendingTeeId = otherPendingTee.id;

    // Holes inserted OUT of order, so "sorted by hole number" is a real
    // assertion about the service rather than an accident of insertion.
    await db.insert(hole).values(
      [18, 1, 9, 2].map((holeNumber) => ({
        teeId: approvedTeeId,
        holeNumber,
        par: holeNumber === 2 ? 3 : 4,
        distance: 100 + holeNumber,
        hcp: holeNumber,
      }))
    );
    await db.insert(hole).values({
      teeId: ownerPendingTeeId,
      holeNumber: 1,
      par: 4,
      distance: 380,
      hcp: 5,
    });
  }, 120_000);

  afterAll(async () => {
    await oauth?.cleanup();
    await db
      .delete(hole)
      .where(
        inArray(hole.teeId, [
          approvedTeeId,
          archivedTeeId,
          ownerPendingTeeId,
          otherPendingTeeId,
        ])
      );
    await db
      .delete(teeInfo)
      .where(inArray(teeInfo.courseId, [approvedCourseId, pendingCourseId]));
    await db.delete(course).where(eq(course.city, FIXTURE));
    for (const id of [firstParty?.userId, otherUserId]) {
      if (id) await db.delete(profile).where(eq(profile.id, id));
    }
    for (const email of Object.values(EMAILS)) {
      await deleteAuthUserByEmail(email);
    }
  }, 120_000);

  describe("both principal classes, per route", () => {
    test("the fixture really produced two different principal classes", () => {
      expect(firstParty.class).toBe("first-party");
      expect(firstParty.clientId).toBeUndefined();
      expect(oauth.class).toBe("oauth");
      expect(oauth.clientId).toBeTruthy();
      // Same human — the asymmetry under test is the token's, not the user's.
      expect(oauth.userId).toBe(firstParty.userId);
    });

    test("GET /v1/courses returns the same catalog to both classes", async () => {
      enforcePublicApiRateLimit.mockResolvedValue(allowed());

      const asFirstParty = await getCourses(
        v1Request(firstParty, `/courses?q=${FIXTURE}`)
      );
      const asOAuth = await getCourses(
        v1Request(oauth, `/courses?q=${FIXTURE}`)
      );

      expect(asFirstParty.status).toBe(200);
      expect(asOAuth.status).toBe(200);

      const first = await asFirstParty.json();
      const second = await asOAuth.json();
      expect(first).toEqual(second);
      expect(first.courses).toHaveLength(1);
      expect(first.courses[0]).toEqual({
        id: approvedCourseId,
        name: `${FIXTURE} Approved Links`,
        country: "Norway",
        city: FIXTURE,
        website: "https://example.test/approved",
      });
    });

    test("GET /v1/tees returns the same tees to both classes", async () => {
      enforcePublicApiRateLimit.mockResolvedValue(allowed());

      const asFirstParty = await getTees(
        v1Request(firstParty, `/tees?courseId=${approvedCourseId}`)
      );
      const asOAuth = await getTees(
        v1Request(oauth, `/tees?courseId=${approvedCourseId}`)
      );

      expect(asFirstParty.status).toBe(200);
      expect(asOAuth.status).toBe(200);

      const first = await asFirstParty.json();
      const second = await asOAuth.json();
      expect(first).toEqual(second);
      expect(first.tees).toHaveLength(1);
      expect(first.tees[0].id).toBe(approvedTeeId);
      expect(first.tees[0].name).toBe("Yellow");
    });

    test("both classes are rate-limited by PARTS on the reads family", async () => {
      enforcePublicApiRateLimit.mockResolvedValue(allowed());
      enforcePublicApiRateLimit.mockClear();

      await getCourses(v1Request(firstParty, `/courses?q=${FIXTURE}`));
      await getTees(v1Request(oauth, `/tees?courseId=${approvedCourseId}`));

      // Two calls per allowed request: the pre-auth IP bucket (no principal),
      // then the per-principal one. Indices 0 and 2 are the pre-auth pair.
      expect(enforcePublicApiRateLimit).toHaveBeenCalledTimes(4);
      expect(enforcePublicApiRateLimit.mock.calls[0][1]).toBeUndefined();
      expect(enforcePublicApiRateLimit.mock.calls[2][1]).toBeUndefined();

      const [, firstPartyParts, firstPartyFamily] =
        enforcePublicApiRateLimit.mock.calls[1];
      expect(firstPartyParts).toEqual({ userId: firstParty.userId });
      expect(firstPartyFamily).toBe("reads");

      const [, oauthParts, oauthFamily] =
        enforcePublicApiRateLimit.mock.calls[3];
      expect(oauthParts).toEqual({
        userId: oauth.userId,
        clientId: oauth.clientId,
      });
      expect(oauthFamily).toBe("reads");
      // The double-prefix trap: a composed key would arrive as a string.
      expect(typeof oauthParts).toBe("object");
    });

    test("a REAL token GoTrue would reject never reaches GoTrue once the pre-auth budget is spent", async () => {
      // The amplification shape, against the live stack: a token minted by
      // this suite's own GoTrue and then mangled, so the signature is real
      // enough to be worth checking and wrong enough to fail. With the
      // pre-auth bucket exhausted the answer must be 429 — a 401 would mean
      // `supabase.auth.getUser` ran first, i.e. the request bought a GoTrue
      // round trip before anything metered it.
      enforcePublicApiRateLimit.mockResolvedValue({
        success: false,
        failedClosed: false,
        family: "reads" as const,
        limit: 120,
        remaining: 0,
        reset: Date.now() + 30_000,
      });

      const forged = `${firstParty.token.slice(0, -4)}zzzz`;
      const response = await getCourses(
        new Request(
          `https://api.handicappin.com/api/v1/courses?q=${FIXTURE}`,
          { headers: { authorization: `Bearer ${forged}` } }
        )
      );

      expect(response.status).toBe(429);
      expect(await response.json()).toMatchObject({ code: "rate_limited" });

      enforcePublicApiRateLimit.mockResolvedValue(allowed());
    });

    test.each(["first-party", "oauth"] as const)(
      "an unapproved course is 422 course_not_found for a %s principal",
      async (cls) => {
        enforcePublicApiRateLimit.mockResolvedValue(allowed());
        const principal = cls === "oauth" ? oauth : firstParty;

        const response = await getTees(
          v1Request(principal, `/tees?courseId=${pendingCourseId}`)
        );
        expect(response.status).toBe(422);
        expect(await response.json()).toMatchObject({
          code: "course_not_found",
        });
      }
    );

    test.each(["first-party", "oauth"] as const)(
      "an absent course is 422 course_not_found for a %s principal",
      async (cls) => {
        enforcePublicApiRateLimit.mockResolvedValue(allowed());
        const principal = cls === "oauth" ? oauth : firstParty;

        const response = await getTees(
          v1Request(principal, `/tees?courseId=${ABSENT_COURSE_ID}`)
        );
        expect(response.status).toBe(422);
        expect(await response.json()).toMatchObject({
          code: "course_not_found",
        });
      }
    );

    test("unapproved and absent are INDISTINGUISHABLE — no existence oracle", async () => {
      enforcePublicApiRateLimit.mockResolvedValue(allowed());

      const pending = await getTees(
        v1Request(oauth, `/tees?courseId=${pendingCourseId}`)
      );
      const absent = await getTees(
        v1Request(oauth, `/tees?courseId=${ABSENT_COURSE_ID}`)
      );

      expect(pending.status).toBe(absent.status);
      const [a, b] = await Promise.all([pending.json(), absent.json()]);
      // `instance` is per-request by design; everything else must match.
      delete a.instance;
      delete b.instance;
      expect(a).toEqual(b);
    });

    test("a request carrying NEITHER class's token is 401", async () => {
      enforcePublicApiRateLimit.mockResolvedValue(allowed());
      const response = await getCourses(
        new Request(`https://api.handicappin.com/api/v1/courses?q=${FIXTURE}`)
      );
      expect(response.status).toBe(401);
      expect(await response.json()).toMatchObject({ code: "unauthorized" });
    });
  });

  describe("catalog visibility", () => {
    test("a pending course is not searchable", async () => {
      enforcePublicApiRateLimit.mockResolvedValue(allowed());
      const response = await getCourses(
        v1Request(oauth, `/courses?q=${FIXTURE} Pending`)
      );
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ courses: [] });
    });

    test("archived and pending tees are excluded — approved+non-archived only", async () => {
      enforcePublicApiRateLimit.mockResolvedValue(allowed());
      const body = await (
        await getTees(v1Request(oauth, `/tees?courseId=${approvedCourseId}`))
      ).json();

      const ids = body.tees.map((tee: { id: number }) => tee.id);
      expect(ids).toEqual([approvedTeeId]);
      expect(ids).not.toContain(archivedTeeId);
      expect(ids).not.toContain(ownerPendingTeeId);
      expect(ids).not.toContain(otherPendingTeeId);
    });

    test("the submitter's OWN pending tee is invisible on /v1", async () => {
      enforcePublicApiRateLimit.mockResolvedValue(allowed());
      // The owner submitted `ownerPendingTeeId` and holds BOTH tokens, so if
      // /v1 leaked the tRPC widening this is where it would show.
      for (const principal of [firstParty, oauth]) {
        const body = await (
          await getTees(
            v1Request(principal, `/tees?courseId=${approvedCourseId}`)
          )
        ).json();
        expect(
          body.tees.map((tee: { id: number }) => tee.id)
        ).not.toContain(ownerPendingTeeId);
      }
    });

    test("no submitter identity reaches the wire", async () => {
      enforcePublicApiRateLimit.mockResolvedValue(allowed());
      const raw = await (
        await getTees(v1Request(oauth, `/tees?courseId=${approvedCourseId}`))
      ).text();
      expect(raw).not.toContain("submittedBy");
      expect(raw).not.toContain(firstParty.userId);
      expect(raw).not.toContain(otherUserId);
    });
  });

  /**
   * The one input postgres cannot carry. `?q=%00` used to reach the driver,
   * raise SQLSTATE 22021 ("invalid byte sequence for encoding UTF8: 0x00"),
   * and come back as a 500 `internal_error` plus a Sentry alert — unlimited
   * alerts from inside a token's 120/min budget, and (per §4) a status we
   * could never have narrowed to a 422 after ship.
   */
  describe("a NUL byte in q is rejected at the boundary", () => {
    test.each([
      ["a lone NUL", "%00"],
      ["an embedded NUL", "ab%00cd"],
    ])("q=%s is 422 validation_failed against the real DB", async (_l, enc) => {
      enforcePublicApiRateLimit.mockResolvedValue(allowed());

      const response = await getCourses(
        v1Request(oauth, `/courses?q=${enc}`)
      );

      expect(response.status).toBe(422);
      const body = await response.json();
      expect(body.code).toBe("validation_failed");
      expect(body.errors).toContainEqual(
        expect.objectContaining({ path: "q", code: "q_contains_nul" })
      );
    });

    test("the guard is load-bearing: the same byte still breaks the query", async () => {
      // Without this, the assertions above could pass against a database
      // that happily accepts NULs and the guard would be ceremony.
      await expect(
        searchCatalogCourses({ query: `${FIXTURE}\u0000` })
      ).rejects.toThrow();
    });
  });

  describe("serialization over real rows", () => {
    test("decimal ratings arrive as JSON numbers, not postgres strings", async () => {
      enforcePublicApiRateLimit.mockResolvedValue(allowed());
      const body = await (
        await getTees(v1Request(oauth, `/tees?courseId=${approvedCourseId}`))
      ).json();
      const tee = body.tees[0];
      expect(tee.courseRating18).toBe(71.4);
      expect(tee.courseRatingFront9).toBe(35.6);
      expect(tee.courseRatingBack9).toBe(35.8);
      expect(typeof tee.courseRating18).toBe("number");
    });

    test("holes come back ordered by hole number despite unordered inserts", async () => {
      enforcePublicApiRateLimit.mockResolvedValue(allowed());
      const body = await (
        await getTees(v1Request(oauth, `/tees?courseId=${approvedCourseId}`))
      ).json();
      expect(
        body.tees[0].holes.map((h: { holeNumber: number }) => h.holeNumber)
      ).toEqual([1, 2, 9, 18]);
      expect(Object.keys(body.tees[0].holes[0]).sort()).toEqual([
        "distance",
        "hcp",
        "holeNumber",
        "par",
      ]);
    });

    test("every response carries X-API-Stability: internal", async () => {
      enforcePublicApiRateLimit.mockResolvedValue(allowed());
      const responses = await Promise.all([
        getCourses(v1Request(oauth, `/courses?q=${FIXTURE}`)),
        getTees(v1Request(oauth, `/tees?courseId=${approvedCourseId}`)),
        getTees(v1Request(oauth, `/tees?courseId=${ABSENT_COURSE_ID}`)),
        getCourses(v1Request(oauth, "/courses")),
      ]);
      for (const response of responses) {
        expect(response.headers.get("X-API-Stability")).toBe("internal");
      }
    });
  });

  describe("tRPC behaviour is unchanged by the extraction", () => {
    test("tee.fetchTees still shows the caller their OWN pending tee", async () => {
      const caller = createTeeCaller(callerCtx(firstParty.userId));
      const tees = await caller.fetchTees({ courseId: approvedCourseId });
      const ids = tees.map((tee) => tee.id).sort((a, b) => a - b);
      expect(ids).toEqual(
        [approvedTeeId, ownerPendingTeeId].sort((a, b) => a - b)
      );
    });

    test("tee.fetchTees still hides ANOTHER user's pending tee, and archived tees", async () => {
      const caller = createTeeCaller(callerCtx(firstParty.userId));
      const ids = (
        await caller.fetchTees({ courseId: approvedCourseId })
      ).map((tee) => tee.id);
      expect(ids).not.toContain(otherPendingTeeId);
      expect(ids).not.toContain(archivedTeeId);
    });

    test("tee.fetchTees still returns coerced numbers, moderation columns and sorted holes", async () => {
      const caller = createTeeCaller(callerCtx(firstParty.userId));
      const tees = await caller.fetchTees({ courseId: approvedCourseId });
      const yellow = tees.find((tee) => tee.id === approvedTeeId)!;

      expect(yellow.courseRating18).toBe(71.4);
      expect(yellow.courseRatingFront9).toBe(35.6);
      expect(yellow.courseRatingBack9).toBe(35.8);
      // The app surfaces read these; the extraction must not have dropped them.
      expect(yellow.approvalStatus).toBe("approved");
      expect(yellow.isArchived).toBe(false);
      expect(yellow.gender).toBe("mens");
      expect(yellow.distanceMeasurement).toBe("meters");
      expect(yellow.holes.map((h) => h.holeNumber)).toEqual([1, 2, 9, 18]);
      expect(yellow.holes[0]).toHaveProperty("id");
      expect(yellow.holes[0]).toHaveProperty("teeId");
    });

    test("tee.fetchTees prefers the caller's pending EDIT of an approved tee", async () => {
      // A pending row with the SAME (courseId, name, gender) as the approved
      // Yellow tee — the deduplication case the procedure has always had.
      const [pendingEdit] = await db
        .insert(teeInfo)
        .values(
          teeValues({
            name: "Yellow",
            approvalStatus: "pending",
            submittedBy: firstParty.userId,
            parentTeeId: approvedTeeId,
          })
        )
        .returning({ id: teeInfo.id });

      try {
        const caller = createTeeCaller(callerCtx(firstParty.userId));
        const tees = await caller.fetchTees({ courseId: approvedCourseId });
        const yellows = tees.filter((tee) => tee.name === "Yellow");
        expect(yellows).toHaveLength(1);
        expect(yellows[0].id).toBe(pendingEdit.id);

        // …and /v1 still shows the APPROVED one, because it never widens.
        enforcePublicApiRateLimit.mockResolvedValue(allowed());
        const body = await (
          await getTees(v1Request(oauth, `/tees?courseId=${approvedCourseId}`))
        ).json();
        expect(body.tees.map((tee: { id: number }) => tee.id)).toEqual([
          approvedTeeId,
        ]);
      } finally {
        await db.delete(hole).where(eq(hole.teeId, pendingEdit.id));
        await db.delete(teeInfo).where(eq(teeInfo.id, pendingEdit.id));
      }
    });

    test("course.searchCourses still returns approved only, website as undefined", async () => {
      const caller = createCourseCaller(callerCtx(firstParty.userId));
      const results = await caller.searchCourses({ query: FIXTURE });
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        id: approvedCourseId,
        name: `${FIXTURE} Approved Links`,
        country: "Norway",
        city: FIXTURE,
        website: "https://example.test/approved",
        approvalStatus: "approved",
      });

      const noWebsite = await db
        .insert(course)
        .values({
          name: `${FIXTURE} No Website`,
          approvalStatus: "approved",
          country: "Norway",
          city: FIXTURE,
        })
        .returning({ id: course.id });
      try {
        const all = await caller.searchCourses({ query: `${FIXTURE} No Web` });
        expect(all).toHaveLength(1);
        expect(all[0].website).toBeUndefined();
        expect("website" in all[0]).toBe(true);
      } finally {
        await db.delete(course).where(eq(course.id, noWebsite[0].id));
      }
    });

    test("course.searchCourses still caps at 10 results", async () => {
      const extras = await db
        .insert(course)
        .values(
          Array.from({ length: 12 }, (_, i) => ({
            name: `${FIXTURE} Bulk ${i}`,
            approvalStatus: "approved",
            country: "Norway",
            city: FIXTURE,
          }))
        )
        .returning({ id: course.id });
      try {
        const caller = createCourseCaller(callerCtx(firstParty.userId));
        const results = await caller.searchCourses({
          query: `${FIXTURE} Bulk`,
        });
        expect(results).toHaveLength(10);
      } finally {
        await db.delete(course).where(
          inArray(
            course.id,
            extras.map((row) => row.id)
          )
        );
      }
    });

    test("/v1/courses can exceed tRPC's cap when a client asks for it", async () => {
      const extras = await db
        .insert(course)
        .values(
          Array.from({ length: 12 }, (_, i) => ({
            name: `${FIXTURE} Bulk ${i}`,
            approvalStatus: "approved",
            country: "Norway",
            city: FIXTURE,
          }))
        )
        .returning({ id: course.id });
      try {
        enforcePublicApiRateLimit.mockResolvedValue(allowed());
        const body = await (
          await getCourses(
            v1Request(oauth, `/courses?q=${FIXTURE} Bulk&limit=12`)
          )
        ).json();
        expect(body.courses).toHaveLength(12);

        const defaulted = await (
          await getCourses(v1Request(oauth, `/courses?q=${FIXTURE} Bulk`))
        ).json();
        expect(defaulted.courses).toHaveLength(10);
      } finally {
        await db.delete(course).where(
          inArray(
            course.id,
            extras.map((row) => row.id)
          )
        );
      }
    });
  });

  describe("the shared service is the ONLY implementation", () => {
    test("/v1 and tRPC agree on the approved tee, field for field", async () => {
      enforcePublicApiRateLimit.mockResolvedValue(allowed());
      const caller = createTeeCaller(callerCtx(NO_SUBMISSIONS_USER_ID));
      // A user with no pending tees on this course sees exactly the catalog.
      const viaTrpc = await caller.fetchTees({ courseId: approvedCourseId });
      const viaV1 = (
        await (
          await getTees(v1Request(oauth, `/tees?courseId=${approvedCourseId}`))
        ).json()
      ).tees;

      expect(viaV1.map((t: { id: number }) => t.id)).toEqual(
        viaTrpc.map((t) => t.id)
      );
      const trpcTee = viaTrpc[0];
      const v1Tee = viaV1[0];
      for (const field of [
        "id",
        "courseId",
        "name",
        "gender",
        "distanceMeasurement",
        "courseRating18",
        "slopeRating18",
        "courseRatingFront9",
        "slopeRatingFront9",
        "courseRatingBack9",
        "slopeRatingBack9",
        "outPar",
        "inPar",
        "totalPar",
        "outDistance",
        "inDistance",
        "totalDistance",
      ] as const) {
        expect(v1Tee[field]).toEqual(trpcTee[field]);
      }
    });
  });
});
