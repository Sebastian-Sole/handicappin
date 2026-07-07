/**
 * Offline-at-finish handling: when submitScorecard fails on TRANSPORT (no
 * signal at the 18th green), the built payload parks in the pendingSubmit
 * slot and is retried opportunistically (Home mount / app foreground via
 * usePendingSubmitRetry). Server REJECTIONS (free-tier limit, validation)
 * are never auto-retried.
 *
 * Duplicate protection: the submit path has no server-side idempotency key
 * (backend change out of scope), so before every retry we check whether a
 * round with this payload's teeTime + total already landed — covers the
 * "timeout after the server actually committed" ambiguity.
 */
import { TRPCClientError } from "@trpc/client";
import type { QueryClient } from "@tanstack/react-query";

import { trpcQuery } from "@/lib/api/client";
import { submitScorecard } from "@/lib/api/procedures/scorecard";
import { roundsResponseSchema } from "@/lib/api/schemas/round";
import {
  clearRoundSession,
  getSession,
  sessionPersistence,
} from "@/lib/round-session/store";
import type { ScorecardInput } from "@/lib/scorecard";

/** Transport failure (offline/DNS/timeout) vs. a server response. tRPC
    server responses always carry `data` (code, httpStatus); pure transport
    errors don't. */
export function isTransportError(error: unknown): boolean {
  if (error instanceof TRPCClientError) {
    return error.data == null;
  }
  return error instanceof TypeError;
}

export async function roundAlreadyLanded(
  payload: ScorecardInput,
): Promise<boolean> {
  try {
    const rounds = await trpcQuery(
      "round.getAllByUserId",
      { userId: payload.userId, amount: 20 },
      roundsResponseSchema,
    );
    const target = new Date(payload.teeTime).getTime();
    const total = payload.scores.reduce((sum, s) => sum + s.strokes, 0);
    return rounds.some(
      (r) =>
        new Date(r.teeTime).getTime() === target && r.totalStrokes === total,
    );
  } catch {
    // Can't check (probably still offline) — don't block the retry on it;
    // the retry itself will fail on transport in that case.
    return false;
  }
}

export function invalidateRoundQueries(queryClient: QueryClient): void {
  // Prefix matching — hits every per-user/per-amount variant.
  void queryClient.invalidateQueries({ queryKey: ["round.getAllByUserId"] });
  void queryClient.invalidateQueries({ queryKey: ["round.getCountByUserId"] });
  void queryClient.invalidateQueries({ queryKey: ["round.getBestRound"] });
  void queryClient.invalidateQueries({
    queryKey: ["scorecard.getAllScorecardsByUserId"],
  });
}

/** The pending round reached the server (submitted or already there):
    clear the slot, and the session too if it's the one that produced it. */
function finalizePending(sessionId: string): void {
  sessionPersistence.clearPendingSubmit();
  const session = getSession();
  if (session && session.id === sessionId) {
    clearRoundSession();
  }
}

export type RetryOutcome = "none" | "submitted" | "deduped" | "failed";

/** Coalesce concurrent retries (Home hook + review-screen polling can both
    fire around app foreground) — one in-flight attempt at a time, everyone
    gets its outcome. Without this, two racing retries could double-submit. */
let inFlight: Promise<RetryOutcome> | null = null;

export function retryPendingSubmit(
  forUserId: string | null,
): Promise<RetryOutcome> {
  if (inFlight) return inFlight;
  inFlight = doRetry(forUserId).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function doRetry(forUserId: string | null): Promise<RetryOutcome> {
  const pending = sessionPersistence.loadPendingSubmit();
  if (!pending) return "none";
  // Never submit another account's parked round with this account's auth.
  // Leave the slot alone — it belongs to whoever parked it.
  if (forUserId == null || pending.payload.userId !== forUserId) {
    return "none";
  }

  if (await roundAlreadyLanded(pending.payload)) {
    finalizePending(pending.sessionId);
    return "deduped";
  }

  try {
    await submitScorecard(pending.payload);
    finalizePending(pending.sessionId);
    return "submitted";
  } catch (error) {
    if (isTransportError(error)) {
      sessionPersistence.savePendingSubmit({
        ...pending,
        attempts: pending.attempts + 1,
        lastAttemptAt: new Date().toISOString(),
      });
    } else {
      // Server rejected — never auto-retry a rejection. The session itself
      // is still on-device; the user resolves it from the review screen.
      sessionPersistence.clearPendingSubmit();
    }
    return "failed";
  }
}
