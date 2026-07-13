import { describe, expect, it, expectTypeOf } from "vitest";
import {
  ANALYTICS_EVENTS,
  createNoopClient,
  type AnalyticsEventMap,
  type AnalyticsEventName,
} from "@handicappin/analytics";

describe("@handicappin/analytics taxonomy", () => {
  it("every constant follows the naming rule (snake_case, no spaces)", () => {
    for (const name of Object.values(ANALYTICS_EVENTS)) {
      expect(name).toMatch(/^[a-z][a-z0-9]*(_[a-z0-9]+)*$/);
    }
  });

  it("constants are unique", () => {
    const names = Object.values(ANALYTICS_EVENTS);
    expect(new Set(names).size).toBe(names.length);
  });

  it("every event name maps to a payload type (compile-time)", () => {
    // Each constant is assignable to the map's key union — a constant for a
    // name missing from AnalyticsEventMap fails to compile via `satisfies`
    // in events.ts; this pins the reverse direction too.
    expectTypeOf<
      (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS]
    >().toEqualTypeOf<AnalyticsEventName>();
    expectTypeOf<AnalyticsEventMap["plan_selected"]>().toEqualTypeOf<{
      plan: "free" | "premium" | "unlimited" | "lifetime";
    }>();
  });

  it("createNoopClient() methods never throw", () => {
    const client = createNoopClient();
    expect(() => {
      client.identify("user-123");
      client.capture("paywall_viewed", { surface: "onboarding" });
      client.capture("round_limit_hit", {});
      client.capture("round_add_started", { method: "manual" });
      client.reset();
    }).not.toThrow();
  });
});
