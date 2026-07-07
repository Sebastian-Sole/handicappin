/**
 * Durable storage for live-round state. The backend is INJECTED (KvBackend)
 * so everything here stays pure-TS-testable with a Map fake; the real
 * SQLite-backed backend lives in kv-backend.ts (the only expo-sqlite import).
 *
 * Three keys, one value each (all JSON strings). Key suffixes are frozen at
 * .v1 forever — payload versioning happens INSIDE the value (see codec.ts).
 */
import { z } from "zod";

import { decodeSession, encodeSession } from "@/lib/round-session/codec";
import type { RoundSession, SessionCourse } from "@/lib/round-session/types";
import { scorecardInputSchema, type ScorecardInput } from "@/lib/scorecard";
import type { Tee } from "@handicappin/handicap-core";

export interface KvBackend {
  getItemSync(key: string): string | null;
  setItemSync(key: string, value: string): void;
  removeItemSync(key: string): void;
}

export const ACTIVE_SESSION_KEY = "hcp.roundSession.active.v1";
export const PENDING_SUBMIT_KEY = "hcp.roundSession.pendingSubmit.v1";
export const LAST_SETUP_KEY = "hcp.liveRound.lastSetup.v1";

/** A round that finished while offline, waiting to be submitted. */
export interface PendingSubmit {
  v: 1;
  sessionId: string;
  payload: ScorecardInput;
  attempts: number;
  lastAttemptAt: string;
}

const pendingSubmitSchema = z.object({
  v: z.literal(1),
  sessionId: z.string().min(1),
  payload: scorecardInputSchema,
  attempts: z.number().int().min(0),
  lastAttemptAt: z.string(),
});

/** Setup prefill for the next round — includes the full tee snapshot so a
    repeat-course start works entirely offline. */
export interface LastSetup {
  v: 1;
  course: SessionCourse;
  tee: Tee;
  holeCount: 9 | 18;
  nineHoleSection?: "front" | "back";
  savedAt: string;
}

const lastSetupSchema = z.object({
  v: z.literal(1),
  course: z.object({
    id: z.number(),
    name: z.string(),
    city: z.string(),
    country: z.string(),
    website: z.string(),
    approvalStatus: z.enum(["approved", "pending"]),
  }),
  tee: z.object({ name: z.string() }).passthrough(),
  holeCount: z.literal(9).or(z.literal(18)),
  nineHoleSection: z.enum(["front", "back"]).optional(),
  savedAt: z.string(),
});

export interface SessionPersistence {
  loadActiveSession(): RoundSession | null;
  saveActiveSession(session: RoundSession): void;
  clearActiveSession(): void;
  loadPendingSubmit(): PendingSubmit | null;
  savePendingSubmit(pending: PendingSubmit): void;
  clearPendingSubmit(): void;
  loadLastSetup(): LastSetup | null;
  saveLastSetup(setup: LastSetup): void;
}

export function createSessionPersistence(kv: KvBackend): SessionPersistence {
  /** Read + validate; anything unreadable is cleared so it can't wedge the
      app into a corrupt-state loop (documented data-loss tradeoff). */
  const readOrClear = <T>(key: string, parse: (raw: string) => T | null) => {
    const raw = kv.getItemSync(key);
    if (raw == null) return null;
    const value = parse(raw);
    if (value === null) kv.removeItemSync(key);
    return value;
  };

  return {
    loadActiveSession: () =>
      readOrClear(ACTIVE_SESSION_KEY, (raw) => decodeSession(raw)),
    saveActiveSession: (session) =>
      kv.setItemSync(ACTIVE_SESSION_KEY, encodeSession(session)),
    clearActiveSession: () => kv.removeItemSync(ACTIVE_SESSION_KEY),

    loadPendingSubmit: () =>
      readOrClear(PENDING_SUBMIT_KEY, (raw) => {
        try {
          const parsed = pendingSubmitSchema.safeParse(JSON.parse(raw));
          return parsed.success ? parsed.data : null;
        } catch {
          return null;
        }
      }),
    savePendingSubmit: (pending) =>
      kv.setItemSync(PENDING_SUBMIT_KEY, JSON.stringify(pending)),
    clearPendingSubmit: () => kv.removeItemSync(PENDING_SUBMIT_KEY),

    loadLastSetup: () =>
      readOrClear(LAST_SETUP_KEY, (raw) => {
        try {
          const parsed = lastSetupSchema.safeParse(JSON.parse(raw));
          return parsed.success ? (parsed.data as LastSetup) : null;
        } catch {
          return null;
        }
      }),
    saveLastSetup: (setup) =>
      kv.setItemSync(LAST_SETUP_KEY, JSON.stringify(setup)),
  };
}
