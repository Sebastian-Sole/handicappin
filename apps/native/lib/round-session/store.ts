/**
 * The single stateful module for live rounds: a module-singleton store
 * bound to React via useSyncExternalStore.
 *
 * Persistence happens INSIDE dispatch, synchronously, BEFORE listeners are
 * notified — so an app killed 1ms after a tap has already written the score
 * to SQLite. Rejected/no-op events return the same reference and skip both
 * the write and the render.
 *
 * A future watch bridge feeds received watch events into this same
 * dispatch() (see PROTOCOL.md) — the UI is just another subscriber.
 */
import { useSyncExternalStore } from "react";

import {
  applyEvent,
  startSession,
  type StartSessionParams,
} from "@/lib/round-session/engine";
import { sqliteKvBackend } from "@/lib/round-session/kv-backend";
import { createSessionPersistence } from "@/lib/round-session/persistence";
import type { RoundSession, SessionEvent } from "@/lib/round-session/types";

export const sessionPersistence = createSessionPersistence(sqliteKvBackend);

/** undefined = not yet hydrated; null = hydrated, no active session. */
let cached: RoundSession | null | undefined;
const listeners = new Set<() => void>();

const hydrate = (): RoundSession | null => {
  if (cached === undefined) {
    const loaded = sessionPersistence.loadActiveSession();
    if (loaded?.status === "submitted") {
      // App was killed inside the post-submit grace window — the round is
      // already on the server; don't resurrect the session.
      sessionPersistence.clearActiveSession();
      cached = null;
    } else if (loaded?.status === "finishing") {
      // App was killed mid-submit. Demote to active so the UI isn't frozen;
      // the pendingSubmit retry path (with its dedupe check) owns whether
      // the submit actually landed.
      const demoted: RoundSession = { ...loaded, status: "active" };
      sessionPersistence.saveActiveSession(demoted);
      cached = demoted;
    } else {
      cached = loaded;
    }
  }
  return cached;
};

const emit = () => {
  for (const listener of [...listeners]) listener();
};

export function getSession(): RoundSession | null {
  return hydrate();
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function dispatch(event: SessionEvent): RoundSession | null {
  const current = hydrate();
  if (current === null) return null;
  const next = applyEvent(current, event);
  if (next === current) return current;
  // Persist FIRST: if the SQLite write throws, memory and disk must not
  // diverge (a score shown in the UI that wouldn't survive relaunch).
  sessionPersistence.saveActiveSession(next);
  cached = next;
  emit();
  return next;
}

export function startRoundSession(params: StartSessionParams): RoundSession {
  const session = startSession(params);
  sessionPersistence.saveActiveSession(session);
  cached = session;
  emit();
  return session;
}

export function clearRoundSession(): void {
  sessionPersistence.clearActiveSession();
  cached = null;
  emit();
}

/**
 * User-intent discard: clears the session AND any pendingSubmit slot it
 * produced — otherwise a round finished offline and then discarded would
 * still auto-submit the next time connectivity returns.
 */
export function discardRoundSession(): void {
  const session = hydrate();
  const pending = sessionPersistence.loadPendingSubmit();
  if (pending && session && pending.sessionId === session.id) {
    sessionPersistence.clearPendingSubmit();
  }
  clearRoundSession();
}

/** Reactive view of the active session (null when none). */
export function useRoundSession(): RoundSession | null {
  return useSyncExternalStore(subscribe, getSession, getSession);
}
