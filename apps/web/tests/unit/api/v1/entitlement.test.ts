/**
 * The `/v1`-only entitlement adapter — contract §1's FeatureAccess table.
 *
 * The two things that must not drift:
 *   1. `plan: has_unlimited_rounds ? "lifetime" : "free"` — the service
 *      branches on `access.plan === "free"`, so "premium"/"unlimited" would
 *      silently mis-apply the round-limit branch.
 *   2. zero rows → the record that produces 403 `plan_required`, PLUS a
 *      Sentry alert (an unalerted 403 hides a provisioning defect).
 */
import { beforeEach, describe, expect, test, vi } from "vitest";

const captureSentryError = vi.fn();
vi.mock("@/lib/sentry-utils", () => ({
  captureSentryError: (...args: unknown[]) => captureSentryError(...args),
}));

const {
  V1_ENTITLEMENT_RPC,
  V1_NO_PROFILE_ACCESS,
  V1EntitlementRpcError,
  createV1UserAccess,
  fetchV1Entitlement,
  toV1FeatureAccess,
  v1EntitlementProblem,
  v1EntitlementRpcFromSupabase,
} = await import("@/app/api/v1/_lib/entitlement");

const USER_ID = "11111111-1111-4111-8111-111111111111";

const row = (over: Partial<Record<string, unknown>> = {}) => ({
  is_provisioned: true,
  has_unlimited_rounds: false,
  rounds_limit: 25,
  rounds_used: 3,
  ...over,
});

const rpcReturning = (data: unknown) => async () => ({ data, error: null });

beforeEach(() => {
  captureSentryError.mockClear();
});

describe("FeatureAccess mapping table (§1)", () => {
  test("free tier: every field, spelled out", () => {
    expect(toV1FeatureAccess(row() as never)).toEqual({
      hasAccess: true,
      hasUnlimitedRounds: false,
      plan: "free",
      remainingRounds: 22,
      isLifetime: false,
      hasPremiumAccess: false,
      status: "active",
      currentPeriodEnd: null,
    });
  });

  test("unlimited: every field, spelled out", () => {
    expect(
      toV1FeatureAccess(
        row({
          has_unlimited_rounds: true,
          rounds_limit: null,
          rounds_used: 40,
        }) as never
      )
    ).toEqual({
      hasAccess: true,
      hasUnlimitedRounds: true,
      plan: "lifetime",
      remainingRounds: Infinity,
      isLifetime: true,
      hasPremiumAccess: true,
      status: "active",
      currentPeriodEnd: null,
    });
  });

  test('plan is "lifetime" for unlimited — never "premium" or "unlimited"', () => {
    const plan = toV1FeatureAccess(
      row({ has_unlimited_rounds: true, rounds_limit: null }) as never
    ).plan;
    expect(plan).toBe("lifetime");
    expect(plan).not.toBe("premium");
    expect(plan).not.toBe("unlimited");
  });

  test('plan is "free" whenever not unlimited — the service branches on it', () => {
    expect(toV1FeatureAccess(row() as never).plan).toBe("free");
    expect(
      toV1FeatureAccess(row({ is_provisioned: false }) as never).plan
    ).toBe("free");
  });

  test("hasAccess comes from is_provisioned and nothing else", () => {
    expect(toV1FeatureAccess(row({ is_provisioned: false }) as never).hasAccess).toBe(
      false
    );
    expect(toV1FeatureAccess(row({ is_provisioned: true }) as never).hasAccess).toBe(
      true
    );
  });

  test("remainingRounds floors at 0 and never goes negative", () => {
    expect(
      toV1FeatureAccess(row({ rounds_limit: 25, rounds_used: 40 }) as never)
        .remainingRounds
    ).toBe(0);
  });

  test("hasPremiumAccess is false for a free account", () => {
    expect(toV1FeatureAccess(row() as never).hasPremiumAccess).toBe(false);
  });

  test("status and currentPeriodEnd are the synthesized values, always", () => {
    for (const unlimited of [true, false]) {
      const access = toV1FeatureAccess(
        row({
          has_unlimited_rounds: unlimited,
          rounds_limit: unlimited ? null : 25,
        }) as never
      );
      expect(access.status).toBe("active");
      expect(access.currentPeriodEnd).toBeNull();
    }
  });
});

describe("zero rows (no profile row at all)", () => {
  test("fetch returns null rather than throwing", async () => {
    await expect(fetchV1Entitlement(rpcReturning([]))).resolves.toBeNull();
  });

  test("the adapter returns the no-access record AND alerts Sentry", async () => {
    const getUserAccess = createV1UserAccess(rpcReturning([]), {
      userId: USER_ID,
    });
    const access = await getUserAccess(USER_ID);

    // hasAccess:false is what the service turns into PlanNotSelectedError,
    // which the mapper turns into 403 plan_required.
    expect(access.hasAccess).toBe(false);
    expect(access).toEqual(V1_NO_PROFILE_ACCESS);

    expect(captureSentryError).toHaveBeenCalledTimes(1);
    const [error, context] = captureSentryError.mock.calls[0] as [
      Error,
      { userId?: string; eventType?: string },
    ];
    expect(error.message).toMatch(/no profile row/i);
    expect(context.userId).toBe(USER_ID);
    expect(context.eventType).toBe("v1-entitlement-missing-profile");
  });

  test("is_provisioned:false maps to the same 403 but does NOT alert", async () => {
    const getUserAccess = createV1UserAccess(
      rpcReturning([row({ is_provisioned: false })]),
      { userId: USER_ID }
    );
    const access = await getUserAccess(USER_ID);
    expect(access.hasAccess).toBe(false);
    expect(captureSentryError).not.toHaveBeenCalled();
  });

  test("v1EntitlementProblem gates on both null and is_provisioned:false", () => {
    expect(v1EntitlementProblem(null)?.code).toBe("plan_required");
    expect(v1EntitlementProblem(row({ is_provisioned: false }) as never)?.code).toBe(
      "plan_required"
    );
    expect(v1EntitlementProblem(row() as never)).toBeNull();
  });
});

describe("RPC plumbing", () => {
  test("a provisioned free user flows straight through the adapter", async () => {
    const getUserAccess = createV1UserAccess(rpcReturning([row()]), {
      userId: USER_ID,
    });
    await expect(getUserAccess(USER_ID)).resolves.toMatchObject({
      hasAccess: true,
      plan: "free",
      remainingRounds: 22,
    });
    expect(captureSentryError).not.toHaveBeenCalled();
  });

  test("an RPC error becomes V1EntitlementRpcError carrying the SQLSTATE", async () => {
    const rpc = async () => ({
      data: null,
      error: { message: "permission denied for function", code: "42501" },
    });
    await expect(fetchV1Entitlement(rpc)).rejects.toBeInstanceOf(
      V1EntitlementRpcError
    );
    await expect(fetchV1Entitlement(rpc)).rejects.toMatchObject({
      code: "42501",
    });
  });

  test("a 42501 from the RPC maps to 403 forbidden through the central mapper", async () => {
    const { mapErrorToProblem } = await import("@/lib/api/problem-mapper");
    const error = new V1EntitlementRpcError("permission denied", "42501");
    expect(mapErrorToProblem(error).code).toBe("forbidden");
  });

  test("a malformed RPC payload fails zod parsing rather than being trusted", async () => {
    await expect(
      fetchV1Entitlement(rpcReturning([{ is_provisioned: "yes" }]))
    ).rejects.toThrow();
  });

  test("null data is treated as zero rows", async () => {
    await expect(fetchV1Entitlement(rpcReturning(null))).resolves.toBeNull();
  });

  test("the supabase binding calls exactly get_connected_entitlement, with no arguments", async () => {
    const rpc = vi.fn(async () => ({ data: [row()], error: null }));
    const caller = v1EntitlementRpcFromSupabase({ rpc } as never);
    await caller();
    expect(rpc).toHaveBeenCalledWith(V1_ENTITLEMENT_RPC);
    expect(rpc.mock.calls[0]).toHaveLength(1);
    expect(V1_ENTITLEMENT_RPC).toBe("get_connected_entitlement");
  });
});

describe("the adapter is not getComprehensiveUserAccess", () => {
  test("it never reads the profile table — the RPC is the only source", async () => {
    // A client whose PostgREST `from()` is a landmine: if the adapter ever
    // reaches for `profile` directly (the false-positive path §1 exists to
    // kill), this throws.
    const client = {
      rpc: async () => ({ data: [row()], error: null }),
      from: () => {
        throw new Error("adapter must not query tables directly");
      },
    };
    const getUserAccess = createV1UserAccess(
      v1EntitlementRpcFromSupabase(client as never),
      { userId: USER_ID }
    );
    await expect(getUserAccess(USER_ID)).resolves.toMatchObject({
      hasAccess: true,
    });
  });

  test("the userId argument does not steer the lookup (the RPC filters on auth.uid())", async () => {
    const rpc = vi.fn(async () => ({ data: [row()], error: null }));
    const getUserAccess = createV1UserAccess(rpc, { userId: USER_ID });
    await getUserAccess("some-other-user-id");
    expect(rpc).toHaveBeenCalledWith();
  });
});
