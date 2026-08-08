/**
 * `POST /v1/rounds` — domain errors thrown by the SERVICE, observed at the
 * HANDLER boundary.
 *
 * The mapper's own table is covered in `problem-mapper.test.ts`; this suite
 * pins the route wiring — a domain error raised inside `submitScorecard`
 * travels through `createV1Round`'s rethrow and the handler's `errorResponse`
 * catch and surfaces as the §1-mapped problem document, not as the catch-all's
 * `500 internal_error` + Sentry page.
 *
 * ── The defect D13 closes ─────────────────────────────────────────────────
 * `ScoreHoleMismatchError` (a submitted score references a hole outside the
 * played section of the tee — client-caused, tRPC answers BAD_REQUEST) was
 * absent from §1's frozen table, so the catch-all sent it to 500 + a Sentry
 * alert. Any token holder could page the on-call with a bad `holeId`. D13
 * maps it to **422 `validation_failed`** with field code
 * `score_hole_mismatch`; the Sentry assertion below is half the fix.
 */
import { beforeEach, describe, expect, test, vi } from "vitest";

const ALLOW = {
  success: true,
  failedClosed: false,
  limit: 60,
  remaining: 59,
  reset: 0,
};

vi.mock("@/lib/rate-limit", () => ({
  enforcePublicApiRateLimit: async () => ALLOW,
}));

vi.mock("@/lib/api/bearer-token", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/api/bearer-token")>();
  return {
    ...actual,
    // Stands in for the GoTrue round trip — always this user.
    getUserFromBearerToken: async () => ({ id: USER_ID }),
    createBearerTokenSupabaseClient: () => ({
      rpc: async () => ({ data: [], error: null }),
    }),
  };
});

// `readHandicapIndex`'s single query: no profile row → the hcpStrokes
// derivation is skipped and the submission reaches the service unchanged.
vi.mock("@/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({ limit: async () => [] }),
      }),
    }),
  },
}));

// THE seam under test: the 002 service throws the domain error.
const submitScorecard = vi.hoisted(() => vi.fn());
vi.mock("@/server/services/scorecard/submit-scorecard", () => ({
  submitScorecard: (...args: unknown[]) => submitScorecard(...args),
}));

const captureSentryError = vi.hoisted(() => vi.fn());
vi.mock("@/lib/sentry-utils", () => ({
  captureSentryError: (...args: unknown[]) => captureSentryError(...args),
}));

const USER_ID = "11111111-1111-4111-8111-111111111111";

const { POST } = await import("@/app/api/v1/rounds/route");
const { ScoreHoleMismatchError } = await import(
  "@/server/services/scorecard/errors"
);

/** Stroke indices 1–18; values are irrelevant here, validity is not. */
function holes() {
  return Array.from({ length: 18 }, (_, index) => ({
    id: 1000 + index,
    holeNumber: index + 1,
    par: 4,
    hcp: index + 1,
    distance: 350,
  }));
}

/** A schema-valid submission — the error must come from the SERVICE. */
function body() {
  return {
    userId: USER_ID,
    course: {
      id: 7,
      name: "Test Links",
      approvalStatus: "approved",
      country: "Norway",
      city: "Oslo",
    },
    teePlayed: {
      id: 42,
      name: "Blue",
      gender: "mens",
      courseRating18: 71,
      slopeRating18: 113,
      courseRatingFront9: 36,
      slopeRatingFront9: 113,
      courseRatingBack9: 35,
      slopeRatingBack9: 113,
      outPar: 36,
      inPar: 36,
      totalPar: 72,
      outDistance: 3150,
      inDistance: 3150,
      totalDistance: 6300,
      distanceMeasurement: "yards",
      approvalStatus: "approved",
      holes: holes(),
    },
    scores: Array.from({ length: 18 }, () => ({ strokes: 5, hcpStrokes: 0 })),
    teeTime: "2026-07-29T14:32:00.000Z",
    approvalStatus: "approved",
  };
}

/** A JWS whose payload carries the given claims. Signature is never checked. */
function tokenWithClaims(claims: Record<string, unknown>): string {
  const segment = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${segment({ alg: "HS256", typ: "JWT" })}.${segment(claims)}.sig`;
}

function request(): Request {
  return new Request("https://api.handicappin.com/api/v1/rounds", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      // No `client_id` claim → first-party principal, no scope gate.
      authorization: `Bearer ${tokenWithClaims({ sub: USER_ID })}`,
      "cf-connecting-ip": "203.0.113.9",
    },
    body: JSON.stringify(body()),
  });
}

beforeEach(() => {
  submitScorecard.mockReset();
  captureSentryError.mockClear();
});

describe("POST /v1/rounds — ScoreHoleMismatchError from the service (D13)", () => {
  test("→ 422 validation_failed with a score_hole_mismatch field entry", async () => {
    submitScorecard.mockRejectedValue(new ScoreHoleMismatchError(1013, 42));

    const response = await POST(request());

    expect(response.status).toBe(422);
    expect(response.headers.get("content-type")).toContain(
      "application/problem+json"
    );

    const problem = await response.json();
    expect(problem).toMatchObject({
      code: "validation_failed",
      status: 422,
      errors: [
        {
          path: "scores",
          code: "score_hole_mismatch",
        },
      ],
    });
    // The ids in the message are the CLIENT'S OWN values — useful to the
    // developer reading the 422, internal to nobody.
    expect(problem.errors[0].message).toContain("1013");
    expect(problem.errors[0].message).toContain("42");
    // Correlation id present, like every /v1 problem.
    expect(typeof problem.instance).toBe("string");
  });

  test("does NOT page anyone — client-caused, so no Sentry capture", async () => {
    submitScorecard.mockRejectedValue(new ScoreHoleMismatchError(1013, 42));

    await POST(request());

    expect(captureSentryError).not.toHaveBeenCalled();
  });

  test("a genuinely unmapped service failure still 500s and alerts", async () => {
    // The counterweight: D13 narrows the catch-all by ONE error, it does not
    // blunt it. Anything else keeps the 500 + Sentry contract.
    submitScorecard.mockRejectedValue(new Error("connect ECONNREFUSED"));

    const response = await POST(request());

    expect(response.status).toBe(500);
    expect((await response.json()).code).toBe("internal_error");
    expect(captureSentryError).toHaveBeenCalledTimes(1);
  });
});
