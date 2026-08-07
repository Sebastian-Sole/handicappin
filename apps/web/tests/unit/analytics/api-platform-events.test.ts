/**
 * G2 server events (plan 010 T12, decision D9) — unit tests for the
 * api-platform capture helpers in `@/lib/api-platform/analytics`.
 *
 * Spec: docs/research/api-platform/DEMAND_INSTRUMENTATION.md §3.3/§3.4.
 * Pins: exact property sets (closed — no email, no free text), distinctId
 * = Supabase user id, fail-open behavior, and the ownership rule that the
 * web submission path (apps/web/server/**) never emits
 * `api_round_submitted` — that event is the /v1 transport fact only.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";

const mockCapture = vi.fn();
const mockFlush = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);

vi.mock("@/lib/posthog", () => ({
  getPostHogClient: () => ({
    capture: mockCapture,
    flush: mockFlush,
  }),
}));

import {
  captureApiRoundSubmitted,
  captureApiConnectCompleted,
} from "@/lib/api-platform/analytics";

const USER_ID = "550e8400-e29b-41d4-a716-446655440000";
const CLIENT_ID = "11111111-2222-4333-8444-555555555555";

describe("captureApiRoundSubmitted (§3.3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFlush.mockResolvedValue(undefined);
  });

  it("captures exactly the spec'd message: distinctId = user id, closed property set", async () => {
    await captureApiRoundSubmitted({
      userId: USER_ID,
      consumer: CLIENT_ID,
      quarantined: true,
      holesPlayed: 18,
    });

    expect(mockCapture).toHaveBeenCalledTimes(1);
    // toStrictEqual pins the CLOSED shape — an added email/free-text
    // property (or a leaked extra field) fails this assertion.
    expect(mockCapture.mock.calls[0][0]).toStrictEqual({
      distinctId: USER_ID,
      event: "api_round_submitted",
      properties: {
        consumer: CLIENT_ID,
        quarantined: true,
        holes_played: 18,
      },
    });
    expect(mockFlush).toHaveBeenCalledTimes(1);
  });

  it("never puts an email or free text into the captured message", async () => {
    await captureApiRoundSubmitted({
      userId: USER_ID,
      consumer: CLIENT_ID,
      quarantined: false,
      holesPlayed: 9,
    });

    const serialized = JSON.stringify(mockCapture.mock.calls[0][0]);
    expect(serialized).not.toMatch(/@/);
    expect(Object.keys(mockCapture.mock.calls[0][0].properties)).toStrictEqual([
      "consumer",
      "quarantined",
      "holes_played",
    ]);
  });

  it("is fail-open: a throwing capture never propagates", async () => {
    mockCapture.mockImplementationOnce(() => {
      throw new Error("posthog down");
    });
    await expect(
      captureApiRoundSubmitted({
        userId: USER_ID,
        consumer: CLIENT_ID,
        quarantined: false,
        holesPlayed: 18,
      }),
    ).resolves.toBeUndefined();
  });

  it("is fail-open: a rejecting flush never propagates", async () => {
    mockFlush.mockRejectedValueOnce(new Error("network"));
    await expect(
      captureApiRoundSubmitted({
        userId: USER_ID,
        consumer: CLIENT_ID,
        quarantined: false,
        holesPlayed: 18,
      }),
    ).resolves.toBeUndefined();
  });
});

describe("captureApiConnectCompleted (§3.4)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFlush.mockResolvedValue(undefined);
  });

  it("captures exactly the spec'd message: distinctId = user id, single consumer property", async () => {
    await captureApiConnectCompleted({
      userId: USER_ID,
      consumer: CLIENT_ID,
    });

    expect(mockCapture).toHaveBeenCalledTimes(1);
    expect(mockCapture.mock.calls[0][0]).toStrictEqual({
      distinctId: USER_ID,
      event: "api_connect_completed",
      properties: { consumer: CLIENT_ID },
    });
    expect(mockFlush).toHaveBeenCalledTimes(1);
  });

  it("is fail-open: a throwing capture never propagates", async () => {
    mockCapture.mockImplementationOnce(() => {
      throw new Error("posthog down");
    });
    await expect(
      captureApiConnectCompleted({ userId: USER_ID, consumer: CLIENT_ID }),
    ).resolves.toBeUndefined();
  });
});

describe("ownership: web-path submissions never emit api_round_submitted", () => {
  // DEMAND_INSTRUMENTATION.md §3.3 ownership note: `round_submitted` (shared
  // service) fires exactly once per round for every transport;
  // `api_round_submitted` is the /v1 transport fact and fires ONLY from the
  // /v1 route handler (apps/web/app/api/v1/**, wave 2 T13). This scan pins
  // that nothing under apps/web/server/ — the web/native tRPC submission
  // path, including the shared scorecard service — references the event or
  // its helper.
  it("no file under apps/web/server references the event or its capture helper", () => {
    const serverRoot = path.resolve(__dirname, "../../../server");
    const offenders: string[] = [];

    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
        } else if (/\.(ts|tsx)$/.test(entry.name)) {
          const source = fs.readFileSync(full, "utf-8");
          if (
            /api_round_submitted|API_ROUND_SUBMITTED|captureApiRoundSubmitted/.test(
              source,
            )
          ) {
            offenders.push(full);
          }
        }
      }
    };
    walk(serverRoot);

    expect(offenders).toStrictEqual([]);
  });
});
