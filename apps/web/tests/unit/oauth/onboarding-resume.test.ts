/**
 * The /onboarding half of the D3 consent gate:
 * - the page must thread a guard-passing `?redirect=` resume path into
 *   PlanSelector (which navigates there after free-plan selection) and
 *   discard anything that fails `safeInternalPath` — the same open-redirect
 *   posture as the login surfaces;
 * - repeated `?redirect=` params (Next.js yields string[]) must normalize to
 *   null, not crash;
 * - before honoring the JWT plan shortcut into a resume path, the page must
 *   re-verify `plan_selected` on the profile table — a stale JWT claim with
 *   a plan-less/missing profile row must fall through to plan selection, not
 *   bounce back into the consent gate forever.
 */
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { ReactElement } from "react";

const mocks = vi.hoisted(() => {
  const maybeSingle = vi.fn();
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  const getUser = vi.fn();
  const getSession = vi.fn();
  return { maybeSingle, eq, select, from, getUser, getSession };
});

vi.mock("@/utils/supabase/server", () => ({
  createServerComponentClient: vi.fn(async () => ({
    auth: { getUser: mocks.getUser, getSession: mocks.getSession },
    from: mocks.from,
  })),
}));

import OnboardingPage from "@/app/onboarding/page";
import { PlanSelector } from "@/components/billing/plan-selector";

const USER_ID = "00000000-0000-0000-0000-000000000002";

/** A structurally valid JWT whose payload carries the given billing claims
 *  (exercises the real getBillingFromJWT base64url decode). */
function accessTokenWithBilling(billing: unknown): string {
  const payload = Buffer.from(
    JSON.stringify({ sub: USER_ID, app_metadata: { billing } }),
  ).toString("base64url");
  return `header.${payload}.signature`;
}

/** Depth-first search of a JSX tree for an element of the given type. */
function findElement(
  node: unknown,
  type: unknown,
): ReactElement<Record<string, unknown>> | null {
  if (node == null || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    for (const child of node) {
      const hit = findElement(child, type);
      if (hit) return hit;
    }
    return null;
  }
  const el = node as ReactElement<Record<string, unknown>>;
  if (el.type === type) return el;
  return findElement((el.props as { children?: unknown })?.children, type);
}

const renderOnboarding = (
  searchParams: { redirect?: string | string[] } = {},
) => OnboardingPage({ searchParams: Promise.resolve(searchParams) });

/** Runs the page and returns the redirect destination it threw, or null. */
async function redirectedTo(
  searchParams: { redirect?: string | string[] } = {},
): Promise<string | null> {
  try {
    await renderOnboarding(searchParams);
    return null;
  } catch (err) {
    const digest = (err as { digest?: string }).digest;
    if (typeof digest !== "string" || !digest.startsWith("NEXT_REDIRECT")) {
      throw err;
    }
    return digest.split(";")[2];
  }
}

const CONSENT_RESUME = "/oauth/consent?authorization_id=abc";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUser.mockResolvedValue({ data: { user: { id: USER_ID } } });
  // Default: no session → no JWT billing claims → plan selection renders.
  mocks.getSession.mockResolvedValue({ data: { session: null } });
});

describe("onboarding resume-path threading (D3)", () => {
  test("guard-passing internal redirect reaches PlanSelector as resumePath", async () => {
    const result = await renderOnboarding({ redirect: CONSENT_RESUME });
    const selector = findElement(result, PlanSelector);
    expect(selector).not.toBeNull();
    expect(selector!.props.resumePath).toBe(CONSENT_RESUME);
    expect(selector!.props.userId).toBe(USER_ID);
  });

  test("malicious redirect is nulled before it reaches PlanSelector", async () => {
    for (const evil of [
      "https://evil.example/phish",
      "//evil.example",
      "/\\evil.example",
    ]) {
      const result = await renderOnboarding({ redirect: evil });
      const selector = findElement(result, PlanSelector);
      expect(selector).not.toBeNull();
      expect(selector!.props.resumePath).toBeNull();
    }
  });

  test("repeated ?redirect= params (string[]) normalize to null instead of crashing", async () => {
    const result = await renderOnboarding({
      redirect: [CONSENT_RESUME, "https://evil.example"],
    });
    const selector = findElement(result, PlanSelector);
    expect(selector).not.toBeNull();
    expect(selector!.props.resumePath).toBeNull();
  });

  test("no redirect param behaves as before (resumePath null)", async () => {
    const result = await renderOnboarding({});
    const selector = findElement(result, PlanSelector);
    expect(selector).not.toBeNull();
    expect(selector!.props.resumePath).toBeNull();
  });
});

describe("onboarding JWT shortcut loop guard (D3)", () => {
  beforeEach(() => {
    mocks.getSession.mockResolvedValue({
      data: {
        session: { access_token: accessTokenWithBilling({ plan: "free" }) },
      },
    });
  });

  test("JWT plan + profile-confirmed plan resumes the guarded path", async () => {
    mocks.maybeSingle.mockResolvedValue({
      data: { planSelected: "free" },
      error: null,
    });

    expect(await redirectedTo({ redirect: CONSENT_RESUME })).toBe(
      CONSENT_RESUME,
    );
    expect(mocks.from).toHaveBeenCalledWith("profile");
    expect(mocks.eq).toHaveBeenCalledWith("id", USER_ID);
  });

  test("JWT plan but MISSING profile row renders plan selection — no bounce back to consent", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });

    const result = await renderOnboarding({ redirect: CONSENT_RESUME });
    const selector = findElement(result, PlanSelector);
    expect(selector).not.toBeNull();
    expect(selector!.props.resumePath).toBe(CONSENT_RESUME);
  });

  test("JWT plan but plan-less profile row renders plan selection — no bounce back to consent", async () => {
    mocks.maybeSingle.mockResolvedValue({
      data: { planSelected: null },
      error: null,
    });

    const result = await renderOnboarding({ redirect: CONSENT_RESUME });
    expect(findElement(result, PlanSelector)).not.toBeNull();
  });

  test("JWT plan with a failing profile read renders plan selection — no bounce", async () => {
    mocks.maybeSingle.mockResolvedValue({
      data: null,
      error: { message: "db down" },
    });

    const result = await renderOnboarding({ redirect: CONSENT_RESUME });
    expect(findElement(result, PlanSelector)).not.toBeNull();
  });

  test("JWT plan without a resume path still goes to /billing, without a profile query", async () => {
    expect(await redirectedTo({})).toBe("/billing");
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
