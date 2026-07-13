import { describe, expect, it, vi } from "vitest";
import posthog from "posthog-js";
import { analytics, createWebAnalyticsClient } from "@/lib/analytics";

describe("web analytics wrapper (fail-open)", () => {
  it("chooses the no-op path when no key is configured", () => {
    const initSpy = vi.spyOn(posthog, "init");
    const captureSpy = vi.spyOn(posthog, "capture");

    const client = createWebAnalyticsClient(undefined);

    expect(() => {
      client.identify("user-123");
      client.capture("stats_viewed", { tab: "performance" });
      client.reset();
    }).not.toThrow();

    expect(initSpy).not.toHaveBeenCalled();
    expect(captureSpy).not.toHaveBeenCalled();
  });

  it("stays no-op outside the browser even with a key (SSR safety)", () => {
    const initSpy = vi.spyOn(posthog, "init");

    // vitest runs in a node environment: window is undefined.
    const client = createWebAnalyticsClient("phc_test_key");
    expect(() => client.capture("round_limit_hit", {})).not.toThrow();
    expect(initSpy).not.toHaveBeenCalled();
  });

  it("the app singleton never throws regardless of env", () => {
    expect(() => {
      analytics.identify("user-123");
      analytics.capture("paywall_viewed", { surface: "upgrade_page" });
      analytics.reset();
    }).not.toThrow();
  });
});
