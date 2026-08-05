/**
 * Gate-decision coverage for the /oauth/consent server page (decision D3):
 * a signed-in but plan-less account must be redirected to onboarding — with
 * the consent URL threaded through the guarded `?redirect=` resume param —
 * instead of being allowed to approve an authorization whose token could
 * only ever `403 plan_required`.
 *
 * The page is an async Server Component, so it can be invoked directly in
 * the node environment with the Supabase server client mocked; `redirect()`
 * from next/navigation throws a NEXT_REDIRECT error whose digest carries the
 * destination, which is what these tests assert on. No DOM rendering is
 * involved (repo convention: full-page render behavior belongs to e2e).
 */
import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const maybeSingle = vi.fn();
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  const getUser = vi.fn();
  const getAuthorizationDetails = vi.fn();
  return { maybeSingle, eq, select, from, getUser, getAuthorizationDetails };
});

vi.mock("@/utils/supabase/server", () => ({
  createServerComponentClient: vi.fn(async () => ({
    auth: {
      getUser: mocks.getUser,
      oauth: { getAuthorizationDetails: mocks.getAuthorizationDetails },
    },
    from: mocks.from,
  })),
}));

import OAuthConsentPage from "@/app/oauth/consent/page";

const AUTHORIZATION_ID = "auth-123";
const USER_ID = "00000000-0000-0000-0000-000000000001";

const renderPage = () =>
  OAuthConsentPage({
    searchParams: Promise.resolve({ authorization_id: AUTHORIZATION_ID }),
  });

/** Runs the page and returns the redirect destination it threw, or null. */
async function redirectedTo(): Promise<string | null> {
  try {
    await renderPage();
    return null;
  } catch (err) {
    const digest = (err as { digest?: string }).digest;
    if (typeof digest !== "string" || !digest.startsWith("NEXT_REDIRECT")) {
      throw err;
    }
    // Digest format: NEXT_REDIRECT;<type>;<url>;<status>;
    return digest.split(";")[2];
  }
}

const EXPECTED_ONBOARDING_REDIRECT =
  "/onboarding?redirect=%2Foauth%2Fconsent%3Fauthorization_id%3Dauth-123";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUser.mockResolvedValue({
    data: { user: { id: USER_ID, email: "golfer@example.com" } },
  });
  mocks.getAuthorizationDetails.mockResolvedValue({
    data: {
      authorization_id: AUTHORIZATION_ID,
      client: { name: "Fitbull", uri: "https://fitbull.example" },
      redirect_uri: "https://fitbull.example/callback",
      user: { id: USER_ID, email: "golfer@example.com" },
    },
    error: null,
  });
});

describe("consent page plan-selection gate (D3)", () => {
  test("plan-less profile (plan_selected NULL) redirects to onboarding with the consent resume param", async () => {
    mocks.maybeSingle.mockResolvedValue({
      data: { planSelected: null },
      error: null,
    });

    expect(await redirectedTo()).toBe(EXPECTED_ONBOARDING_REDIRECT);
    // The gate must decide BEFORE the authorization details are fetched.
    expect(mocks.getAuthorizationDetails).not.toHaveBeenCalled();
    // And it must have consulted the profile of the signed-in user.
    expect(mocks.from).toHaveBeenCalledWith("profile");
    expect(mocks.select).toHaveBeenCalledWith("planSelected: plan_selected");
    expect(mocks.eq).toHaveBeenCalledWith("id", USER_ID);
  });

  test("missing profile row redirects to onboarding (fail closed)", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });

    expect(await redirectedTo()).toBe(EXPECTED_ONBOARDING_REDIRECT);
    expect(mocks.getAuthorizationDetails).not.toHaveBeenCalled();
  });

  test("profile query error redirects to onboarding (fail closed, no dead-end grant)", async () => {
    mocks.maybeSingle.mockResolvedValue({
      data: null,
      error: { message: "boom" },
    });

    expect(await redirectedTo()).toBe(EXPECTED_ONBOARDING_REDIRECT);
    expect(mocks.getAuthorizationDetails).not.toHaveBeenCalled();
  });

  test("provisioned user (plan selected) reaches the consent card as before", async () => {
    mocks.maybeSingle.mockResolvedValue({
      data: { planSelected: "free" },
      error: null,
    });

    const result = await renderPage();
    // No redirect thrown; the page rendered its consent <main> shell.
    expect(result).toBeTruthy();
    expect((result as { type?: unknown }).type).toBe("main");
    expect(mocks.getAuthorizationDetails).toHaveBeenCalledWith(
      AUTHORIZATION_ID,
    );
  });

  test("signed-out user still gets the sign-in shell, never the profile query", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });

    const result = await renderPage();
    expect(result).toBeTruthy();
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.getAuthorizationDetails).not.toHaveBeenCalled();
  });

  test("the onboarding redirect round-trips the open-redirect guard", async () => {
    mocks.maybeSingle.mockResolvedValue({
      data: { planSelected: null },
      error: null,
    });

    const destination = await redirectedTo();
    const { safeInternalPath, LOGIN_REDIRECT_PARAM } = await import(
      "@/lib/oauth/consent-flow"
    );
    // The destination itself is internal…
    expect(safeInternalPath(destination)).toBe(destination);
    // …and the nested resume target survives the guard and points back here.
    const nested = new URL(
      `http://localhost${destination}`,
    ).searchParams.get(LOGIN_REDIRECT_PARAM);
    expect(safeInternalPath(nested)).toBe(
      `/oauth/consent?authorization_id=${AUTHORIZATION_ID}`,
    );
  });
});
