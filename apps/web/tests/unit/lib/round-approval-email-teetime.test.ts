/**
 * Round-approval notification route: naive `teeTime` must reach the email
 * templates as the UTC instant it encodes.
 *
 * `apps/web/app/api/notifications/round-approval/route.ts` reads
 * `round.teeTime` through the PostgREST admin client, so the value arrives
 * zone-less (naive `timestamp` column — see lib/parse-db-timestamp.ts). The
 * email templates format `teePlayedAt` with a raw `new Date(value)`, which
 * spec-parses a zone-less string as *process-local* time. On Vercel that is
 * a no-op because the runtime defaults to `TZ=UTC`, so this only bites on a
 * non-UTC runtime — which is exactly what these tests pin.
 *
 * Route module deps (env, supabase admin client, email service, logging,
 * Sentry) all have import-time side effects outside a configured
 * environment, so they are stubbed the same way
 * tests/unit/lib/revenuecat-lifecycle-email.test.ts stubs its route's deps.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

vi.mock("@/env", () => ({
  env: {
    NODE_ENV: "test",
    SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
  },
}));
vi.mock("@/lib/logging", () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));
vi.mock("@/lib/sentry-utils", () => ({ captureSentryError: vi.fn() }));
vi.mock("@/lib/email-service", () => ({
  sendRoundApprovedEmail: vi.fn(),
  sendRoundRejectedEmail: vi.fn(),
}));

/** Zone-less `teeTime` exactly as PostgREST renders the naive column. The
    23:00 hour is deliberate: in Europe/Oslo (UTC+2 in July) the correct
    instant lands on the *next* calendar day, so a local misparse is visible
    as a whole-day shift, not just an hour offset. */
const TEE_TIME_NAIVE = "2026-07-15T23:00:00";
const TEE_TIME_INSTANT = "2026-07-15T23:00:00.000Z";

const ROUND_ROW = {
  id: 42,
  userId: "11111111-1111-4111-8111-111111111111",
  teeTime: TEE_TIME_NAIVE,
  adjustedGrossScore: 88,
  scoreDifferential: "12.3",
  courseId: 7,
  teeId: 9,
};

/** Minimal chainable PostgREST double: every builder method returns `this`,
    and the terminal `single()`/await resolves to the per-table fixture. */
function makeSupabaseStub() {
  const results: Record<string, { data: unknown; error: null }> = {
    round: { data: ROUND_ROW, error: null },
    profile: { data: { email: "golfer@example.com", name: "Golfer" }, error: null },
    course: { data: { name: "Ballerud" }, error: null },
    teeInfo: {
      data: { name: "Yellow", outPar: 36, inPar: 36, totalPar: 72 },
      error: null,
    },
    hole: { data: [], error: null },
    score: { data: [], error: null },
    submissions: { data: [], error: null },
  };

  return {
    from(table: string) {
      const result = results[table] ?? { data: null, error: null };
      const builder = {
        select: () => builder,
        eq: () => builder,
        order: () => builder,
        single: () => Promise.resolve(result),
        then: (
          resolve: (value: { data: unknown; error: null }) => unknown,
          reject?: (reason: unknown) => unknown,
        ) => Promise.resolve(result).then(resolve, reject),
      };
      return builder;
    },
  };
}

vi.mock("@/utils/supabase/admin", () => ({
  createAdminClient: () => makeSupabaseStub(),
}));

import { POST } from "@/app/api/notifications/round-approval/route";
import {
  sendRoundApprovedEmail,
  sendRoundRejectedEmail,
} from "@/lib/email-service";

function postRequest(approvalStatus: "approved" | "rejected") {
  return new Request("http://localhost/api/notifications/round-approval", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      roundId: ROUND_ROW.id,
      userId: ROUND_ROW.userId,
      approvalStatus,
    }),
  }) as unknown as NextRequest;
}

describe("round-approval notification: teeTime reaches emails as a UTC instant", () => {
  beforeAll(() => {
    vi.stubEnv("TZ", "Europe/Oslo");
  });
  afterAll(() => {
    vi.unstubAllEnvs();
  });
  beforeEach(() => {
    vi.mocked(sendRoundApprovedEmail).mockClear();
    vi.mocked(sendRoundRejectedEmail).mockClear();
  });

  it("pins the ambient timezone so a local misparse is observable", () => {
    // Guard for the two assertions below: if the ambient TZ were UTC, a raw
    // `new Date(naive)` would coincide with the correct instant and these
    // tests would pass even against the unfixed code.
    expect(new Date(TEE_TIME_NAIVE).toISOString()).toBe(
      "2026-07-15T21:00:00.000Z",
    );
  });

  it("sends the approved email with the UTC instant, not a local misparse", async () => {
    const response = await POST(postRequest("approved"));
    expect(response.status).toBe(200);

    expect(sendRoundApprovedEmail).toHaveBeenCalledTimes(1);
    const { teePlayedAt } = vi.mocked(sendRoundApprovedEmail).mock.calls[0][0];
    expect(teePlayedAt).toBeInstanceOf(Date);
    expect((teePlayedAt as Date).toISOString()).toBe(TEE_TIME_INSTANT);
    // Regression pin: the pre-fix `teePlayedAt: round.teeTime` produced this.
    expect((teePlayedAt as Date).getTime()).not.toBe(
      new Date(TEE_TIME_NAIVE).getTime(),
    );
  });

  it("sends the rejected email with the UTC instant, not a local misparse", async () => {
    const response = await POST(postRequest("rejected"));
    expect(response.status).toBe(200);

    expect(sendRoundRejectedEmail).toHaveBeenCalledTimes(1);
    const { teePlayedAt } = vi.mocked(sendRoundRejectedEmail).mock.calls[0][0];
    expect(teePlayedAt).toBeInstanceOf(Date);
    expect((teePlayedAt as Date).toISOString()).toBe(TEE_TIME_INSTANT);
    expect((teePlayedAt as Date).getTime()).not.toBe(
      new Date(TEE_TIME_NAIVE).getTime(),
    );
  });
});
