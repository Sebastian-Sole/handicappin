/**
 * Middleware-layer coverage for the /oauth/consent plan gate (decision D3).
 *
 * The page-level gate in `app/oauth/consent/page.tsx` only helps if the
 * request actually reaches the page. `updateSession` runs first and redirects
 * any authenticated request with a NULL `billing.plan` JWT claim to
 * `/onboarding` by rewriting `.pathname` alone — which would drop the pending
 * authorization's resume param on the floor for the mainline first-time
 * plan-less user. These tests pin the exemption that keeps /oauth/consent
 * flowing through to the page gate, and pin that every other protected path
 * still gets the onboarding bounce.
 *
 * `@supabase/ssr` is mocked so `updateSession` runs for real; the access token
 * is a genuine (unsigned) JWT shape because `getAppMetadataFromJWT` decodes
 * the payload segment itself.
 */
import { beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  getSession: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({
    auth: { getUser: mocks.getUser, getSession: mocks.getSession },
  })),
}));

const { updateSession } = await import("@/utils/supabase/middleware");
const { onboardingPathForConsent, safeInternalPath } = await import(
  "@/lib/oauth/consent-flow"
);

const USER_ID = "00000000-0000-0000-0000-000000000001";
const AUTHORIZATION_ID = "auth-123";

function base64url(value: object): string {
  return Buffer.from(JSON.stringify(value))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * A JWT whose `app_metadata.billing.plan` is what the custom access token
 * hook emits for the given profile state. `plan: null` is exactly what
 * 20251025154500_fix_jwt_hook_null_handling.sql produces for a profile whose
 * `plan_selected` is NULL (no COALESCE) — the first-time-user case.
 */
function accessTokenWithPlan(plan: string | null): string {
  return [
    base64url({ alg: "HS256", typ: "JWT" }),
    base64url({
      sub: USER_ID,
      app_metadata: {
        billing: {
          plan,
          status: plan ? "active" : null,
          current_period_end: null,
          cancel_at_period_end: false,
          billing_version: 1,
        },
      },
    }),
    "signature",
  ].join(".");
}

function buildRequest(path: string): NextRequest {
  const headers = new Headers({ host: "www.handicappin.com" });
  return new NextRequest(`https://www.handicappin.com${path}`, { headers });
}

function signInAs(plan: string | null) {
  mocks.getUser.mockResolvedValue({ data: { user: { id: USER_ID } } });
  mocks.getSession.mockResolvedValue({
    data: { session: { access_token: accessTokenWithPlan(plan) } },
  });
}

/** The Location header of a redirect response, or null for a pass-through. */
function redirectLocation(response: Response): string | null {
  return response.status >= 300 && response.status < 400
    ? response.headers.get("location")
    : null;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("middleware onboarding redirect — /oauth/consent exemption (D3)", () => {
  test("a plan-less user reaching the consent deeplink is NOT bounced by middleware", async () => {
    signInAs(null);

    const response = await updateSession(
      buildRequest(`/oauth/consent?authorization_id=${AUTHORIZATION_ID}`),
    );

    // Passes through so the page-level D3 gate — the only layer that builds
    // the `?redirect=` resume URL — is the one that decides.
    expect(redirectLocation(response)).toBeNull();
  });

  test("trailing-slash variant is exempt too (no bypass via /oauth/consent/)", async () => {
    signInAs(null);

    const response = await updateSession(
      buildRequest(`/oauth/consent/?authorization_id=${AUTHORIZATION_ID}`),
    );

    expect(redirectLocation(response)).toBeNull();
  });

  test("a plan-less user on any other protected path still gets the onboarding bounce", async () => {
    signInAs(null);

    const response = await updateSession(buildRequest("/rounds"));

    expect(redirectLocation(response)).toBe(
      "https://www.handicappin.com/onboarding",
    );
  });

  test("a user WITH a plan reaches the consent page untouched", async () => {
    signInAs("free");

    const response = await updateSession(
      buildRequest(`/oauth/consent?authorization_id=${AUTHORIZATION_ID}`),
    );

    expect(redirectLocation(response)).toBeNull();
  });

  test("regression: a bare pathname rewrite would have dropped the resume param", () => {
    // What middleware used to produce for the consent deeplink: the pending
    // authorization survives as `?authorization_id=`, which OnboardingPage
    // never reads, so resumePath resolves to null and the authorization is
    // abandoned after plan selection.
    const bounced = new URL(
      `https://www.handicappin.com/oauth/consent?authorization_id=${AUTHORIZATION_ID}`,
    );
    bounced.pathname = "/onboarding";
    expect(bounced.searchParams.get("redirect")).toBeNull();

    // What the page-level gate produces instead — a resume path that survives
    // the open-redirect guard OnboardingPage runs it through.
    const gated = new URL(
      onboardingPathForConsent(AUTHORIZATION_ID),
      "https://www.handicappin.com",
    );
    expect(safeInternalPath(gated.searchParams.get("redirect"))).toBe(
      `/oauth/consent?authorization_id=${AUTHORIZATION_ID}`,
    );
  });
});
