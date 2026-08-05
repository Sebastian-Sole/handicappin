/**
 * The /onboarding half of the D3 consent gate: the page must thread a
 * guard-passing `?redirect=` resume path into PlanSelector (which navigates
 * there after free-plan selection) and discard anything that fails
 * `safeInternalPath` — the same open-redirect posture as the login surfaces.
 */
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { ReactElement } from "react";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  getSession: vi.fn(),
}));

vi.mock("@/utils/supabase/server", () => ({
  createServerComponentClient: vi.fn(async () => ({
    auth: { getUser: mocks.getUser, getSession: mocks.getSession },
  })),
}));

import OnboardingPage from "@/app/onboarding/page";
import { PlanSelector } from "@/components/billing/plan-selector";

const USER_ID = "00000000-0000-0000-0000-000000000002";

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

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUser.mockResolvedValue({ data: { user: { id: USER_ID } } });
  // No session → no JWT billing claims → the plan-selection UI renders.
  mocks.getSession.mockResolvedValue({ data: { session: null } });
});

describe("onboarding resume-path threading (D3)", () => {
  test("guard-passing internal redirect reaches PlanSelector as resumePath", async () => {
    const result = await OnboardingPage({
      searchParams: Promise.resolve({
        redirect: "/oauth/consent?authorization_id=abc",
      }),
    });
    const selector = findElement(result, PlanSelector);
    expect(selector).not.toBeNull();
    expect(selector!.props.resumePath).toBe(
      "/oauth/consent?authorization_id=abc",
    );
    expect(selector!.props.userId).toBe(USER_ID);
  });

  test("malicious redirect is nulled before it reaches PlanSelector", async () => {
    for (const evil of [
      "https://evil.example/phish",
      "//evil.example",
      "/\\evil.example",
    ]) {
      const result = await OnboardingPage({
        searchParams: Promise.resolve({ redirect: evil }),
      });
      const selector = findElement(result, PlanSelector);
      expect(selector).not.toBeNull();
      expect(selector!.props.resumePath).toBeNull();
    }
  });

  test("no redirect param behaves as before (resumePath null)", async () => {
    const result = await OnboardingPage({
      searchParams: Promise.resolve({}),
    });
    const selector = findElement(result, PlanSelector);
    expect(selector).not.toBeNull();
    expect(selector!.props.resumePath).toBeNull();
  });
});
