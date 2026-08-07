/**
 * `GET /v1/courses` and `GET /v1/tees` — handler contract.
 *
 * These are the assertions that do not need a database: the auth guard, the
 * rate-limit seam (the pre-auth IP bucket, then principal PARTS + the named
 * `reads` family), the frozen query-parameter validation, the frozen response
 * shape, and the two limiter denial outcomes. The catalog service is mocked
 * here so the wire contract is tested independently of the query;
 * `tests/integration/v1-catalog.test.ts` runs the same routes against a real
 * stack with real tokens of BOTH principal classes.
 *
 * The network token validator is stubbed, but classification is NOT: real
 * JWT-shaped tokens go through the real `authenticateV1Request`, so a
 * first-party token and an OAuth token really do produce different principal
 * parts at the limiter — the thing the double-prefix trap corrupts.
 *
 * That depth of mocking is load-bearing for one more reason. `networkValidator`
 * stands exactly where the GoTrue round trip is, so ORDERING between the
 * limiter and token validation is observable from here — see "the pre-auth IP
 * bucket runs BEFORE token validation". Stubbing `authenticateV1Request`
 * wholesale would make that claim untestable in this file.
 */
import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/lib/sentry-utils", () => ({ captureSentryError: vi.fn() }));

const networkValidator = vi.fn(
  async (_token: string): Promise<{ id: string } | null> => null
);
vi.mock("@/lib/api/bearer-token", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/api/bearer-token")>();
  return {
    ...actual,
    getUserFromBearerToken: (token: string) => networkValidator(token),
  };
});

/** The limiter is infrastructure; the handler's use of it is what we test. */
const enforcePublicApiRateLimit = vi.fn();
vi.mock("@/lib/rate-limit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/rate-limit")>();
  return {
    ...actual,
    enforcePublicApiRateLimit: (...args: unknown[]) =>
      enforcePublicApiRateLimit(...args),
  };
});

const searchCatalogCourses = vi.fn();
const findCatalogCourse = vi.fn();
const listCourseTees = vi.fn();
vi.mock("@/server/services/catalog", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/server/services/catalog")>();
  return {
    ...actual,
    searchCatalogCourses: (...args: unknown[]) => searchCatalogCourses(...args),
    findCatalogCourse: (...args: unknown[]) => findCatalogCourse(...args),
    listCourseTees: (...args: unknown[]) => listCourseTees(...args),
  };
});

const { GET: getCourses } = await import("@/app/api/v1/courses/route");
const { GET: getTees } = await import("@/app/api/v1/tees/route");

const USER_ID = "33333333-3333-4333-8333-333333333333";
const CLIENT_ID = "fitbull-test-client";

function jwt(payload: Record<string, unknown>): string {
  const encode = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "HS256", typ: "JWT" })}.${encode(payload)}.sig`;
}

const FIRST_PARTY_TOKEN = jwt({ sub: USER_ID });
const OAUTH_TOKEN = jwt({
  sub: USER_ID,
  client_id: CLIENT_ID,
  scope: "rounds:write",
});

function request(path: string, token: string | null = FIRST_PARTY_TOKEN) {
  return new Request(`https://api.handicappin.com/api/v1${path}`, {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

/** A limiter result that lets the request through. */
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

const TEE_ROW = {
  id: 7,
  courseId: 4,
  name: "Yellow",
  gender: "mens" as const,
  courseRating18: 71.4,
  slopeRating18: 129,
  courseRatingFront9: 35.6,
  slopeRatingFront9: 127,
  courseRatingBack9: 35.8,
  slopeRatingBack9: 131,
  outPar: 36,
  inPar: 36,
  totalPar: 72,
  outDistance: 3000,
  inDistance: 3100,
  totalDistance: 6100,
  distanceMeasurement: "meters" as const,
  // Everything below must NOT reach the wire.
  approvalStatus: "approved" as const,
  isArchived: false,
  version: 3,
  submittedBy: "99999999-9999-4999-8999-999999999999",
  parentTeeId: 6,
  // Already ordered: hole ordering is the shared service's guarantee, not
  // something the route re-derives (see the integration suite for the sort).
  holes: [
    { id: 50, teeId: 7, holeNumber: 1, par: 4, distance: 380, hcp: 5 },
    { id: 51, teeId: 7, holeNumber: 2, par: 3, distance: 150, hcp: 17 },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  networkValidator.mockResolvedValue({ id: USER_ID });
  enforcePublicApiRateLimit.mockResolvedValue(allowed());
  searchCatalogCourses.mockResolvedValue([]);
  findCatalogCourse.mockResolvedValue({
    id: 4,
    name: "Ballerud",
    country: "Norway",
    city: "Bærum",
    website: null,
  });
  listCourseTees.mockResolvedValue([]);
});

describe("auth guard", () => {
  test.each([
    ["GET /v1/courses", () => getCourses(request("/courses?q=st", null))],
    ["GET /v1/tees", () => getTees(request("/tees?courseId=4", null))],
  ])("%s without a Bearer token is 401 unauthorized", async (_name, call) => {
    const response = await call();
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.code).toBe("unauthorized");
    // The guard runs BEFORE any catalog read.
    expect(searchCatalogCourses).not.toHaveBeenCalled();
    expect(findCatalogCourse).not.toHaveBeenCalled();
  });

  test.each([
    ["GET /v1/courses", () => getCourses(request("/courses?q=st"))],
    ["GET /v1/tees", () => getTees(request("/tees?courseId=4"))],
  ])("%s with a token the network rejects is 401", async (_name, call) => {
    networkValidator.mockResolvedValue(null);
    const response = await call();
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ code: "unauthorized" });
  });
});

describe("rate-limit seam — the two traps the barrel documents", () => {
  test.each([
    ["GET /v1/courses", () => getCourses(request("/courses?q=st"))],
    ["GET /v1/tees", () => getTees(request("/tees?courseId=4"))],
  ])(
    "%s passes first-party principal PARTS and names the reads family",
    async (_name, call) => {
      await call();
      // Two buckets per allowed request: the pre-auth IP one, then this.
      expect(enforcePublicApiRateLimit).toHaveBeenCalledTimes(2);
      const [, principal, family] = enforcePublicApiRateLimit.mock.calls[1];
      // PARTS, not a composed `user:{sub}` string.
      expect(principal).toEqual({ userId: USER_ID });
      expect(typeof principal).toBe("object");
      expect(family).toBe("reads");
    }
  );

  test.each([
    [
      "GET /v1/courses",
      () => getCourses(request("/courses?q=st", OAUTH_TOKEN)),
    ],
    ["GET /v1/tees", () => getTees(request("/tees?courseId=4", OAUTH_TOKEN))],
  ])(
    "%s passes OAuth principal PARTS — never the composed pair key",
    async (_name, call) => {
      await call();
      const [, principal, family] = enforcePublicApiRateLimit.mock.calls[1];
      expect(principal).toEqual({ userId: USER_ID, clientId: CLIENT_ID });
      // The double-prefix trap: a composed key would arrive as a string and
      // be re-prefixed to `user:client:…:user:…` by the limiter.
      expect(principal).not.toBe(`client:${CLIENT_ID}:user:${USER_ID}`);
      expect(family).toBe("reads");
    }
  );

  test.each([
    ["GET /v1/courses", () => getCourses(request("/courses?q=st"))],
    ["GET /v1/tees", () => getTees(request("/tees?courseId=4"))],
  ])(
    "%s a limiter denial short-circuits before any catalog read",
    async (_name, call) => {
      // Renamed from "the limiter runs BEFORE the catalog is touched", which
      // over-claimed: this asserts only that a 429 skips the catalog, which
      // was never the ordering at risk. The auth-vs-limiter ordering is
      // pinned by "the pre-auth IP bucket" below.
      enforcePublicApiRateLimit.mockResolvedValue({
        success: false,
        failedClosed: false,
        family: "reads",
        limit: 120,
        remaining: 0,
        reset: Date.now() + 30_000,
      });
      await call();
      expect(searchCatalogCourses).not.toHaveBeenCalled();
      expect(findCatalogCourse).not.toHaveBeenCalled();
      expect(listCourseTees).not.toHaveBeenCalled();
    }
  );
});

/**
 * §3: "**Pre-auth / invalid-token requests** (which still cost validation
 * work and must be limited): keyed `ip:{ip}`".
 *
 * The cost being metered is `supabase.auth.getUser(token)`, a NETWORK round
 * trip to GoTrue. `extractBearerToken` short-circuits without any network
 * ONLY for an absent / unsplittable / wrongly-schemed / empty header —
 * `Bearer garbage-not-even-a-jwt` and a well-formed JWT with a bogus
 * signature both reach the validator. `networkValidator` above IS that call,
 * so "the limiter ran before validation" is directly observable here: these
 * assertions are the reason the mock exists at that depth rather than
 * stubbing `authenticateV1Request` wholesale.
 */
describe("the pre-auth IP bucket runs BEFORE token validation", () => {
  test.each([
    ["GET /v1/courses", () => getCourses(request("/courses?q=st"))],
    ["GET /v1/tees", () => getTees(request("/tees?courseId=4"))],
  ])(
    "%s calls the limiter with NO principal first, then with the parts",
    async (_name, call) => {
      await call();
      expect(enforcePublicApiRateLimit).toHaveBeenCalledTimes(2);

      const [, preAuthPrincipal, preAuthFamily] =
        enforcePublicApiRateLimit.mock.calls[0];
      // `undefined`, so `getIdentifier` falls through to `ip:{ip}`. A
      // hand-composed string here would take the limiter's string branch and
      // be re-prefixed to `user:…`.
      expect(preAuthPrincipal).toBeUndefined();
      expect(preAuthFamily).toBe("reads");

      const [, principal] = enforcePublicApiRateLimit.mock.calls[1];
      expect(principal).toEqual({ userId: USER_ID });
    }
  );

  test.each([
    ["GET /v1/courses", () => getCourses(request("/courses?q=st"))],
    ["GET /v1/tees", () => getTees(request("/tees?courseId=4"))],
  ])(
    "%s never reaches token validation once the pre-auth budget is spent",
    async (_name, call) => {
      enforcePublicApiRateLimit.mockResolvedValue({
        success: false,
        failedClosed: false,
        family: "reads",
        limit: 120,
        remaining: 0,
        reset: Date.now() + 30_000,
      });

      const response = await call();

      expect(response.status).toBe(429);
      // THE assertion: the GoTrue round trip never happened.
      expect(networkValidator).not.toHaveBeenCalled();
      // …and the per-principal bucket was never consulted either, because
      // there is no principal to key it on.
      expect(enforcePublicApiRateLimit).toHaveBeenCalledTimes(1);
    }
  );

  test("a syntactically valid but REJECTED token is limited, not validated", async () => {
    // The amplification shape: a JWT-shaped token whose signature GoTrue
    // would reject. Without a pre-auth bucket this is one network call per
    // request, unmetered, from a caller holding no credential at all.
    networkValidator.mockResolvedValue(null);
    enforcePublicApiRateLimit.mockResolvedValue({
      success: false,
      failedClosed: false,
      family: "reads",
      limit: 120,
      remaining: 0,
      reset: Date.now() + 30_000,
    });

    const forged = jwt({ sub: "11111111-1111-4111-8111-111111111111" });
    const response = await getCourses(request("/courses?q=st", forged));

    // 429, not 401 — proof the limiter decided before authentication did.
    expect(response.status).toBe(429);
    expect(await response.json()).toMatchObject({ code: "rate_limited" });
    expect(networkValidator).not.toHaveBeenCalled();
  });

  test("garbage that is not even a JWT is limited before validation too", async () => {
    enforcePublicApiRateLimit.mockResolvedValue({
      success: false,
      failedClosed: false,
      family: "reads",
      limit: 120,
      remaining: 0,
      reset: Date.now() + 30_000,
    });

    const response = await getTees(
      request("/tees?courseId=4", "garbage-not-even-a-jwt")
    );

    expect(response.status).toBe(429);
    expect(networkValidator).not.toHaveBeenCalled();
  });

  test("an ABSENT Authorization header still costs a pre-auth bucket slot", async () => {
    // It cannot amplify — `extractBearerToken` short-circuits with no
    // network — but it is still a request the origin served, and §3 keys
    // pre-auth traffic on IP without carving out the cheap shapes.
    const response = await getCourses(request("/courses?q=st", null));
    expect(response.status).toBe(401);
    expect(enforcePublicApiRateLimit).toHaveBeenCalledTimes(1);
    expect(enforcePublicApiRateLimit.mock.calls[0][1]).toBeUndefined();
    expect(networkValidator).not.toHaveBeenCalled();
  });

  test("a fail-closed pre-auth limiter is 503, and still skips validation", async () => {
    enforcePublicApiRateLimit.mockResolvedValue({
      success: false,
      failedClosed: true,
      reason: "missing-credentials",
      family: "reads",
      limit: 0,
      remaining: 0,
      reset: Date.now() + 60_000,
    });

    const response = await getCourses(request("/courses?q=st"));
    expect(response.status).toBe(503);
    expect(networkValidator).not.toHaveBeenCalled();
  });
});

describe("limiter denials", () => {
  test.each([
    ["GET /v1/courses", () => getCourses(request("/courses?q=st"))],
    ["GET /v1/tees", () => getTees(request("/tees?courseId=4"))],
  ])("%s budget exhausted is 429 with the full header set", async (_name, call) => {
    const reset = Date.now() + 30_000;
    enforcePublicApiRateLimit.mockResolvedValue({
      success: false,
      failedClosed: false,
      family: "reads",
      limit: 120,
      remaining: 0,
      reset,
    });

    const response = await call();
    expect(response.status).toBe(429);
    expect(response.headers.get("X-RateLimit-Limit")).toBe("120");
    expect(response.headers.get("X-RateLimit-Remaining")).toBe("0");
    expect(response.headers.get("X-RateLimit-Reset")).toBe(
      String(Math.ceil(reset / 1000))
    );
    const retryAfter = Number(response.headers.get("Retry-After"));
    expect(retryAfter).toBeGreaterThan(0);
    expect(retryAfter).toBeLessThanOrEqual(30);

    const body = await response.json();
    expect(body.code).toBe("rate_limited");
    expect(response.headers.get("Content-Type")).toContain(
      "application/problem+json"
    );
  });

  test.each([
    ["GET /v1/courses", () => getCourses(request("/courses?q=st"))],
    ["GET /v1/tees", () => getTees(request("/tees?courseId=4"))],
  ])(
    "%s limiter unavailable is 503 with Retry-After: 60 and no X-RateLimit-*",
    async (_name, call) => {
      enforcePublicApiRateLimit.mockResolvedValue({
        success: false,
        failedClosed: true,
        reason: "missing-credentials",
        family: "reads",
        limit: 0,
        remaining: 0,
        reset: Date.now() + 60_000,
      });

      const response = await call();
      expect(response.status).toBe(503);
      expect(response.headers.get("Retry-After")).toBe("60");
      // A budget that was never consulted must not be advertised.
      expect(response.headers.get("X-RateLimit-Limit")).toBeNull();
      expect(response.headers.get("X-RateLimit-Remaining")).toBeNull();
      expect(response.headers.get("X-RateLimit-Reset")).toBeNull();
      expect(await response.json()).toMatchObject({
        code: "service_unavailable",
      });
    }
  );

  test.each([
    ["GET /v1/courses", () => getCourses(request("/courses?q=st"))],
    ["GET /v1/tees", () => getTees(request("/tees?courseId=4"))],
  ])(
    "%s never leaks the limiter's internal reason (body or headers)",
    async (_name, call) => {
      enforcePublicApiRateLimit.mockResolvedValue({
        success: false,
        failedClosed: true,
        reason: "missing-credentials",
        family: "reads",
        limit: 0,
        remaining: 0,
        reset: Date.now() + 60_000,
      });

      const response = await call();
      const raw = await response.text();
      for (const reason of [
        "missing-credentials",
        "disabled",
        "init-error",
        "runtime-error",
      ]) {
        expect(raw).not.toContain(reason);
      }
      expect(JSON.parse(raw).reason).toBeUndefined();
      expect([...response.headers.keys()].join(" ")).not.toContain("reason");
      expect(JSON.stringify([...response.headers])).not.toContain(
        "missing-credentials"
      );
    }
  );
});

describe("GET /v1/courses — frozen query parameters", () => {
  test("q is required", async () => {
    const response = await getCourses(request("/courses"));
    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.code).toBe("validation_failed");
    expect(body.errors.some((e: { path: string }) => e.path === "q")).toBe(true);
    expect(searchCatalogCourses).not.toHaveBeenCalled();
  });

  test("a whitespace-only q is rejected, not matched as '%  %'", async () => {
    const response = await getCourses(request("/courses?q=%20%20"));
    expect(response.status).toBe(422);
    expect(searchCatalogCourses).not.toHaveBeenCalled();
  });

  test("q is trimmed before it reaches the catalog", async () => {
    await getCourses(request("/courses?q=%20st%20andrews%20"));
    expect(searchCatalogCourses).toHaveBeenCalledWith({
      query: "st andrews",
      limit: 10,
    });
  });

  test.each([
    ["a lone NUL", "%00"],
    ["an embedded NUL", "ab%00cd"],
    ["a NUL with surrounding whitespace", "%20%00%20"],
  ])(
    "q containing %s is 422 validation_failed, never a 500",
    async (_label, encoded) => {
      // Postgres rejects a NUL inside a `text` bind parameter with SQLSTATE
      // 22021, which the central mapper turns into 500 internal_error + a
      // Sentry alert — i.e. any token holder could mint unlimited alerts
      // from inside its 120/min budget. §4 also makes turning a shipped 500
      // into a 422 breaking, so this has to be right on day one.
      const response = await getCourses(request(`/courses?q=${encoded}`));
      expect(response.status).toBe(422);

      const body = await response.json();
      expect(body.code).toBe("validation_failed");
      const issue = body.errors.find((e: { path: string }) => e.path === "q");
      expect(issue).toBeDefined();
      expect(issue.code).toBe("q_contains_nul");

      // The byte never reaches the driver.
      expect(searchCatalogCourses).not.toHaveBeenCalled();
    }
  );

  test("q longer than 100 characters is rejected", async () => {
    const response = await getCourses(
      request(`/courses?q=${"a".repeat(101)}`)
    );
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ code: "validation_failed" });
  });

  test("limit defaults to 10 when absent", async () => {
    await getCourses(request("/courses?q=st"));
    expect(searchCatalogCourses).toHaveBeenCalledWith({
      query: "st",
      limit: 10,
    });
  });

  test("limit is honoured within 1..50", async () => {
    await getCourses(request("/courses?q=st&limit=50"));
    expect(searchCatalogCourses).toHaveBeenCalledWith({
      query: "st",
      limit: 50,
    });
  });

  test.each(["0", "51", "abc", "2.5", "-1", ""])(
    "limit=%s is 422 validation_failed",
    async (value) => {
      const response = await getCourses(
        request(`/courses?q=st&limit=${value}`)
      );
      expect(response.status).toBe(422);
      expect(await response.json()).toMatchObject({
        code: "validation_failed",
      });
      expect(searchCatalogCourses).not.toHaveBeenCalled();
    }
  );
});

describe("GET /v1/courses — frozen response shape", () => {
  test("200 wraps the results in an object, never a bare array", async () => {
    searchCatalogCourses.mockResolvedValue([
      {
        id: 4,
        name: "Ballerud",
        country: "Norway",
        city: "Bærum",
        website: "https://example.test",
      },
    ]);

    const response = await getCourses(request("/courses?q=ball"));
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("application/json");
    expect(response.headers.get("X-API-Stability")).toBe("internal");

    const body = await response.json();
    expect(Array.isArray(body)).toBe(false);
    expect(body).toEqual({
      courses: [
        {
          id: 4,
          name: "Ballerud",
          country: "Norway",
          city: "Bærum",
          website: "https://example.test",
        },
      ],
    });
  });

  test("website is null rather than absent when unknown", async () => {
    searchCatalogCourses.mockResolvedValue([
      { id: 4, name: "X", country: "Norway", city: "Oslo", website: null },
    ]);
    const body = await (await getCourses(request("/courses?q=x"))).json();
    expect(body.courses[0]).toHaveProperty("website", null);
  });

  test("no match is 200 with an empty list, not a problem", async () => {
    searchCatalogCourses.mockResolvedValue([]);
    const response = await getCourses(request("/courses?q=zzzz"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ courses: [] });
  });
});

describe("GET /v1/tees — frozen query parameters", () => {
  test.each([
    ["absent", "/tees"],
    ["blank", "/tees?courseId="],
    ["non-numeric", "/tees?courseId=abc"],
    ["zero", "/tees?courseId=0"],
    ["negative", "/tees?courseId=-3"],
    ["fractional", "/tees?courseId=4.5"],
    ["out of int range", "/tees?courseId=99999999999"],
  ])("courseId %s is 422 validation_failed", async (_label, path) => {
    const response = await getTees(request(path));
    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.code).toBe("validation_failed");
    expect(body.errors[0].path).toBe("courseId");
    expect(findCatalogCourse).not.toHaveBeenCalled();
  });
});

describe("GET /v1/tees — catalog miss", () => {
  test("a courseId not in the catalog is 422 course_not_found", async () => {
    findCatalogCourse.mockResolvedValue(null);
    const response = await getTees(request("/tees?courseId=999"));
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({
      code: "course_not_found",
      type: "https://api.handicappin.com/problems/course_not_found",
    });
    expect(listCourseTees).not.toHaveBeenCalled();
  });

  test("a catalog course with no approved tees is 200 with an empty list", async () => {
    listCourseTees.mockResolvedValue([]);
    const response = await getTees(request("/tees?courseId=4"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ tees: [] });
  });

  test("the tee read never widens visibility to a submitter's pending tees", async () => {
    await getTees(request("/tees?courseId=4"));
    expect(listCourseTees).toHaveBeenCalledWith({ courseId: 4 });
    const [options] = listCourseTees.mock.calls[0];
    expect(options.includePendingSubmittedBy).toBeUndefined();
  });
});

describe("GET /v1/tees — frozen response shape", () => {
  test("moderation columns and submitter identity never reach the wire", async () => {
    listCourseTees.mockResolvedValue([TEE_ROW]);
    const response = await getTees(request("/tees?courseId=4"));
    const raw = await response.text();

    expect(raw).not.toContain("submittedBy");
    expect(raw).not.toContain(TEE_ROW.submittedBy);
    expect(raw).not.toContain("approvalStatus");
    expect(raw).not.toContain("isArchived");
    expect(raw).not.toContain("parentTeeId");
    expect(raw).not.toContain("version");

    const tee = JSON.parse(raw).tees[0];
    expect(Object.keys(tee).sort()).toEqual(
      [
        "courseId",
        "courseRating18",
        "courseRatingBack9",
        "courseRatingFront9",
        "distanceMeasurement",
        "gender",
        "holes",
        "id",
        "inDistance",
        "inPar",
        "name",
        "outDistance",
        "outPar",
        "slopeRating18",
        "slopeRatingBack9",
        "slopeRatingFront9",
        "totalDistance",
        "totalPar",
      ].sort()
    );
  });

  test("holes carry only the four public fields, in the service's order", async () => {
    listCourseTees.mockResolvedValue([TEE_ROW]);
    const body = await (await getTees(request("/tees?courseId=4"))).json();
    expect(body.tees[0].holes).toEqual([
      { holeNumber: 1, par: 4, hcp: 5, distance: 380 },
      { holeNumber: 2, par: 3, hcp: 17, distance: 150 },
    ]);
  });

  test("ratings are numbers, and the 9-hole pairs are present", async () => {
    listCourseTees.mockResolvedValue([TEE_ROW]);
    const tee = (await (await getTees(request("/tees?courseId=4"))).json())
      .tees[0];
    expect(tee.courseRating18).toBe(71.4);
    expect(tee.courseRatingFront9).toBe(35.6);
    expect(tee.courseRatingBack9).toBe(35.8);
    expect(tee.slopeRatingFront9).toBe(127);
    expect(tee.slopeRatingBack9).toBe(131);
  });

  test("the payload is an object wrapper, never a bare array", async () => {
    listCourseTees.mockResolvedValue([TEE_ROW]);
    const body = await (await getTees(request("/tees?courseId=4"))).json();
    expect(Array.isArray(body)).toBe(false);
    expect(Array.isArray(body.tees)).toBe(true);
  });
});

describe("X-API-Stability on every application-emitted response", () => {
  test.each([
    ["200 courses", () => getCourses(request("/courses?q=st"))],
    ["200 tees", () => getTees(request("/tees?courseId=4"))],
    ["401", () => getCourses(request("/courses?q=st", null))],
    ["422 validation", () => getCourses(request("/courses"))],
  ])("%s carries X-API-Stability: internal", async (_name, call) => {
    const response = await call();
    expect(response.headers.get("X-API-Stability")).toBe("internal");
  });

  test("422 course_not_found carries it too", async () => {
    findCatalogCourse.mockResolvedValue(null);
    const response = await getTees(request("/tees?courseId=999"));
    expect(response.headers.get("X-API-Stability")).toBe("internal");
  });

  test("a limiter denial cannot displace it", async () => {
    enforcePublicApiRateLimit.mockResolvedValue({
      success: false,
      failedClosed: false,
      family: "reads",
      limit: 120,
      remaining: 0,
      reset: Date.now() + 5_000,
    });
    const response = await getCourses(request("/courses?q=st"));
    expect(response.headers.get("X-API-Stability")).toBe("internal");
  });
});

describe("unexpected failures map through the central mapper", () => {
  test("a thrown catalog error is 500 internal_error, leaking nothing", async () => {
    searchCatalogCourses.mockRejectedValue(
      new Error("connect ECONNREFUSED 127.0.0.1:54322")
    );
    const response = await getCourses(request("/courses?q=st"));
    expect(response.status).toBe(500);
    const raw = await response.text();
    expect(raw).not.toContain("ECONNREFUSED");
    expect(JSON.parse(raw).code).toBe("internal_error");
  });
});
