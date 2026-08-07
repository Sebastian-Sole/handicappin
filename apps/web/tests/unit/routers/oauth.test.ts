/**
 * oauthRouter.connectCompleted unit tests (plan 010 T12, decision D9).
 *
 * The server-owned `api_connect_completed` event (DEMAND_INSTRUMENTATION.md
 * §3.4) is captured by this mutation after re-verifying against GoTrue that
 * a grant for the claimed client exists for the session user. These tests
 * call the real mutation through a tRPC caller (stripe-router test pattern)
 * and pin: exact capture payload on the happy path, NO capture when the
 * grant cannot be verified, fail-open on GoTrue errors, and UNAUTHORIZED
 * for anonymous callers.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCapture = vi.fn();
const mockFlush = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);

vi.mock("@/lib/posthog", () => ({
  getPostHogClient: () => ({
    capture: mockCapture,
    flush: mockFlush,
  }),
}));

const mockWarn = vi.fn();
vi.mock("@/lib/logging", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: (...args: unknown[]) => mockWarn(...args),
    error: vi.fn(),
  },
}));

import { oauthRouter } from "@/server/api/routers/oauth";
import { createCallerFactory } from "@/server/api/trpc";

const createCaller = createCallerFactory(oauthRouter);

const USER_ID = "550e8400-e29b-41d4-a716-446655440000";
const CLIENT_ID = "11111111-2222-4333-8444-555555555555";
const OTHER_CLIENT_ID = "99999999-8888-4777-a666-555555555555";

function buildCtx(opts?: {
  user?: { id: string; email?: string } | null;
  listGrants?: () => Promise<unknown>;
}) {
  const listGrants =
    opts?.listGrants ??
    (() =>
      Promise.resolve({
        data: [
          {
            client: { id: CLIENT_ID, name: "fitbull", uri: "", logo_uri: "" },
            scopes: [],
            granted_at: "2026-08-05T00:00:00Z",
          },
        ],
        error: null,
      }));

  return {
    user:
      opts?.user === undefined
        ? { id: USER_ID, email: "user@example.com" }
        : opts.user,
    supabase: { auth: { oauth: { listGrants } } },
    headers: new Headers(),
  } as unknown as Parameters<typeof createCaller>[0];
}

describe("oauthRouter.connectCompleted", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFlush.mockResolvedValue(undefined);
  });

  it("captures api_connect_completed exactly once with the spec'd payload when the grant exists", async () => {
    const caller = createCaller(buildCtx());
    const result = await caller.connectCompleted({ clientId: CLIENT_ID });

    expect(result).toStrictEqual({ captured: true });
    expect(mockCapture).toHaveBeenCalledTimes(1);
    // Closed shape: distinctId is the Supabase user id; the only property
    // is `consumer`. The ctx user's email must never appear.
    expect(mockCapture.mock.calls[0][0]).toStrictEqual({
      distinctId: USER_ID,
      event: "api_connect_completed",
      properties: { consumer: CLIENT_ID },
    });
    expect(JSON.stringify(mockCapture.mock.calls[0][0])).not.toContain(
      "user@example.com",
    );
    expect(mockFlush).toHaveBeenCalledTimes(1);
  });

  it("does NOT capture when no grant exists for the claimed client, and says so in the log", async () => {
    const caller = createCaller(buildCtx());
    const result = await caller.connectCompleted({
      clientId: OTHER_CLIENT_ID,
    });

    expect(result).toStrictEqual({ captured: false });
    expect(mockCapture).not.toHaveBeenCalled();
    // The drop must be visible: a systemic undercount (e.g. the grant read
    // no longer observing the just-written grant) would otherwise be silent.
    expect(mockWarn).toHaveBeenCalledTimes(1);
    expect(mockWarn.mock.calls[0][1]).toStrictEqual({
      clientId: OTHER_CLIENT_ID,
      grantCount: 1,
    });
  });

  it("fails open (no capture, no throw) when GoTrue grant listing errors", async () => {
    const caller = createCaller(
      buildCtx({
        listGrants: () =>
          Promise.resolve({ data: null, error: { message: "boom" } }),
      }),
    );
    const result = await caller.connectCompleted({ clientId: CLIENT_ID });

    expect(result).toStrictEqual({ captured: false });
    expect(mockCapture).not.toHaveBeenCalled();
  });

  it("rejects anonymous callers with UNAUTHORIZED and never captures", async () => {
    const caller = createCaller(buildCtx({ user: null }));
    await expect(
      caller.connectCompleted({ clientId: CLIENT_ID }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(mockCapture).not.toHaveBeenCalled();
  });

  it("rejects a non-UUID clientId (input validation) and never captures", async () => {
    const caller = createCaller(buildCtx());
    await expect(
      caller.connectCompleted({ clientId: "not-a-uuid" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mockCapture).not.toHaveBeenCalled();
  });
});
