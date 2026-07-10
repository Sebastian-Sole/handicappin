/**
 * Phone-side watch bridge: connects the WatchBridge native module (WCSession)
 * to the round-session store and the tRPC API. Headless counterpart of the
 * live-round screens — every watch action funnels into the exact same code
 * paths the phone UI uses (store.dispatch, startRoundSession,
 * submitScorecard, pendingSubmit parking).
 *
 * Mounted once by WatchBridgeHost (components/watch-bridge-host.tsx).
 * Ownership rule (use-owned-session.ts) applies throughout: a session that
 * doesn't belong to the signed-in user is invisible to the watch.
 */
import type { QueryClient } from "@tanstack/react-query";
import { randomUUID } from "expo-crypto";
import { z } from "zod";

import { trpcQuery } from "@/lib/api/client";
import {
  fetchedTeeSchema,
  searchedCourseSchema,
  submitScorecard,
  type FetchedTee,
} from "@/lib/api/procedures/scorecard";
import { profileSchema } from "@/lib/api/schemas/profile";
import {
  courseRowSchema,
  roundsResponseSchema,
} from "@/lib/api/schemas/round";
import { encodeSession } from "@/lib/round-session/codec";
import {
  invalidateRoundQueries,
  isTransportError,
} from "@/lib/round-session/pending-submit";
import { finishEligibility } from "@/lib/round-session/selectors";
import {
  dispatch,
  getSession,
  clearRoundSession,
  sessionPersistence,
  startRoundSession,
  subscribe,
} from "@/lib/round-session/store";
import { toScorecardInput, type SubmitAs } from "@/lib/round-session/to-scorecard";
import type { RoundSession, SessionEvent } from "@/lib/round-session/types";
import {
  decodeWatchFrame,
  type CatalogReply,
  type ContextFrame,
  type EventAck,
  type SearchReply,
  type StartReply,
  type SubmitReply,
  type TeesReply,
  type WatchCourseOption,
  type WatchCourseRef,
  type WatchLastRound,
  type WatchStats,
  type WatchTeeOption,
} from "@/lib/round-session/watch-protocol";
import { roundToNearestMinute, type Tee } from "@/lib/scorecard";
import { WatchBridge } from "@/modules/watch-bridge";

export interface WatchBridgeDeps {
  getUserId: () => string | null;
  queryClient: QueryClient;
}

/** Post-submit grace before the session (and the watch UI) resets —
    mirrors the review screen's 1.5s "Submitted!" beat. */
const SUBMIT_GRACE_MS = 1500;

/** Rounds fetched per stats refresh — enough to cover a season's counters
    without paging (the list is teeTime-desc). */
const STATS_ROUNDS_WINDOW = 100;

/** Post-submit index polling cadence. The server's handicap queue is swept
    by a ~1-minute pg_cron, so a few spaced polls (cumulative ~2.5 min)
    catch the rework; if the index never moves (round outside the top-8
    differentials) the window expiring clears the "recalculating" chip. */
const RECALC_POLL_DELAYS_MS = [10_000, 20_000, 30_000, 45_000, 60_000];

/** submitScorecard's response is z.unknown() for its other callers; the
    bridge alone reads the synchronously-computed differential out of it
    (round.submitScorecard returns the drizzle-inserted round row, whose
    numeric columns arrive as STRINGS — hence the coercion). */
const submitRoundResultSchema = z.object({
  scoreDifferential: z.coerce.number(),
});

const nowIso = () => new Date().toISOString();

function ownedSession(userId: string | null): RoundSession | null {
  const session = getSession();
  if (!session || userId == null || session.userId !== userId) return null;
  return session;
}

function toTeeOption(tee: FetchedTee | Tee): WatchTeeOption | null {
  if (tee.id == null) return null;
  return {
    id: tee.id,
    name: tee.name,
    gender: tee.gender,
    totalPar: tee.totalPar,
    totalDistance: tee.totalDistance,
    distanceMeasurement: tee.distanceMeasurement,
  };
}

/** A tee is startable only with a full hole set (mirrors setup's gate). */
const teeHasHoles = (tee: FetchedTee | Tee): boolean =>
  (tee.holes?.length ?? 0) >= 18;

export function startWatchBridge(deps: WatchBridgeDeps): () => void {
  if (!WatchBridge.isAvailable()) {
    return () => {};
  }

  // ------------------------------------------------------------------
  // Home-screen stats (ride the ContextFrame; advisory, last-value-wins)
  // ------------------------------------------------------------------

  let cachedStats: Omit<WatchStats, "recalculating"> | null = null;
  let recalculating = false;
  let recalcTimer: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;

  const publish = () => {
    const owned = ownedSession(deps.getUserId());
    const frame: ContextFrame = {
      v: 1,
      kind: "context",
      // Key omitted (not null!) when sessionless — an NSNull in the dict
      // makes WCSession silently reject the whole frame (non-plist type),
      // so clears would never propagate. Same rule for stats and every
      // optional key nested inside it.
      ...(owned ? { session: encodeSession(owned) } : {}),
      ...(cachedStats ? { stats: { ...cachedStats, recalculating } } : {}),
      seq: owned?.eventSeq ?? -1,
      publishedAt: nowIso(),
    };
    WatchBridge.publishContext(JSON.stringify(frame));
  };

  /** Fetch the home-screen stats the same way the phone home does (profile
      + rounds + count). Failures keep the previous cache — stale stats on
      the wrist beat an empty home. Returns whether the cache was updated. */
  const fetchStats = async (): Promise<boolean> => {
    const userId = deps.getUserId();
    if (userId == null) return false;
    try {
      const [profile, rounds, totalRounds] = await Promise.all([
        trpcQuery("auth.getProfileFromUserId", userId, profileSchema),
        trpcQuery(
          "round.getAllByUserId",
          { userId, amount: STATS_ROUNDS_WINDOW },
          roundsResponseSchema,
        ),
        trpcQuery("round.getCountByUserId", { userId }, z.number()),
      ]);

      // The list is teeTime-desc, so [0] is the latest submitted round.
      const latest = rounds[0];
      let lastRound: WatchLastRound | undefined;
      if (latest) {
        let courseName = "";
        try {
          const course = await trpcQuery(
            "course.getCourseById",
            { courseId: latest.courseId },
            courseRowSchema.nullable(),
          );
          courseName = course?.name ?? "";
        } catch {
          // Course name is cosmetic — the card degrades to scores only.
        }
        lastRound = {
          courseName,
          totalStrokes: latest.totalStrokes,
          toPar: latest.totalStrokes - latest.parPlayed,
          differential: latest.scoreDifferential,
          playedAt: latest.teeTime,
          holesPlayed: latest.holes_played,
          ...(latest.nine_hole_section === "front" ||
          latest.nine_hole_section === "back"
            ? { nineHoleSection: latest.nine_hole_section }
            : {}),
        };
      }

      const year = new Date().getFullYear();
      const season = rounds.filter(
        (r) => new Date(r.teeTime).getFullYear() === year,
      );
      const seasonBest = season.length
        ? Math.min(...season.map((r) => r.scoreDifferential))
        : undefined;

      cachedStats = {
        handicapIndex: profile.handicapIndex,
        initialHandicapIndex: profile.initialHandicapIndex,
        ...(lastRound ? { lastRound } : {}),
        seasonRounds: season.length,
        ...(seasonBest !== undefined
          ? { seasonBestDifferential: seasonBest }
          : {}),
        totalRounds,
        generatedAt: nowIso(),
      };
      return true;
    } catch {
      return false;
    }
  };

  const refreshStats = async () => {
    if (await fetchStats()) publish();
  };

  const stopRecalcWatch = () => {
    if (recalcTimer != null) {
      clearTimeout(recalcTimer);
      recalcTimer = null;
    }
  };

  /** A round just reached "submitted" (phone- or watch-initiated): flag the
      index as recalculating, then poll the profile until the queue's rework
      lands (index changes) or the window expires (index unchanged — the
      round didn't crack the top-8 differentials). */
  const beginRecalcWatch = () => {
    stopRecalcWatch();
    const baseline = cachedStats?.handicapIndex;
    recalculating = true;
    publish();
    let step = 0;
    const tick = async () => {
      recalcTimer = null;
      if (disposed) return;
      const updated = await fetchStats();
      const settled =
        updated &&
        baseline !== undefined &&
        cachedStats != null &&
        cachedStats.handicapIndex !== baseline;
      step += 1;
      if (settled || step >= RECALC_POLL_DELAYS_MS.length) {
        recalculating = false;
        publish();
        return;
      }
      publish(); // fresh lastRound/season counters while still waiting
      schedule();
    };
    const schedule = () => {
      recalcTimer = setTimeout(() => {
        void tick();
      }, RECALC_POLL_DELAYS_MS[step]);
    };
    schedule();
  };

  // ------------------------------------------------------------------
  // Request handlers (reply payloads mirror watch-protocol.ts)
  // ------------------------------------------------------------------

  const buildCatalog = (): CatalogReply => {
    const lastSetup = sessionPersistence.loadLastSetup();
    const courses: WatchCourseOption[] = [];
    if (lastSetup) {
      const teeOption = toTeeOption(lastSetup.tee);
      courses.push({
        ...lastSetup.course,
        tees: teeOption ? [teeOption] : [],
      });
    }
    return { v: 1, kind: "catalog", courses };
  };

  const handleSearch = async (query: string): Promise<SearchReply> => {
    try {
      const found = await trpcQuery(
        "course.searchCourses",
        { query },
        z.array(searchedCourseSchema),
      );
      return {
        v: 1,
        kind: "searchResult",
        courses: found.slice(0, 10).map((c) => ({
          id: c.id,
          name: c.name,
          city: c.city,
          country: c.country,
          website: c.website ?? "",
          approvalStatus: c.approvalStatus,
        })),
      };
    } catch {
      return {
        v: 1,
        kind: "searchResult",
        courses: [],
        error: "Search failed — check your phone's connection.",
      };
    }
  };

  const fetchTees = (courseId: number): Promise<FetchedTee[]> =>
    trpcQuery("tee.fetchTees", { courseId }, z.array(fetchedTeeSchema));

  const handleTees = async (courseId: number): Promise<TeesReply> => {
    // Offline fallback: the last-setup tee snapshot still allows the
    // repeat-course happy path with zero connectivity.
    const lastSetup = sessionPersistence.loadLastSetup();
    try {
      const tees = await fetchTees(courseId);
      const options = tees
        .filter(teeHasHoles)
        .map(toTeeOption)
        .filter((t): t is WatchTeeOption => t !== null);
      if (
        lastSetup &&
        lastSetup.course.id === courseId &&
        lastSetup.tee.id != null &&
        !options.some((t) => t.id === lastSetup.tee.id)
      ) {
        const fallback = toTeeOption(lastSetup.tee);
        if (fallback) options.unshift(fallback);
      }
      return { v: 1, kind: "teesResult", tees: options };
    } catch {
      if (lastSetup && lastSetup.course.id === courseId) {
        const fallback = toTeeOption(lastSetup.tee);
        if (fallback) return { v: 1, kind: "teesResult", tees: [fallback] };
      }
      return {
        v: 1,
        kind: "teesResult",
        tees: [],
        error: "Couldn't load tees — check your phone's connection.",
      };
    }
  };

  const handleStart = async (frame: {
    course: WatchCourseRef;
    teeId: number;
    holeCount: 9 | 18;
    nineHoleSection?: "front" | "back";
  }): Promise<StartReply> => {
    const userId = deps.getUserId();
    if (userId == null) {
      return { v: 1, kind: "startResult", ok: false, error: "Sign in on your iPhone first." };
    }
    if (ownedSession(userId)) {
      return { v: 1, kind: "startResult", ok: false, error: "A round is already in progress." };
    }

    // Resolve the tee snapshot: last-setup match works offline; otherwise
    // fetch the course's tees and pick by id.
    const lastSetup = sessionPersistence.loadLastSetup();
    let tee: Tee | null = null;
    if (
      lastSetup &&
      lastSetup.course.id === frame.course.id &&
      lastSetup.tee.id === frame.teeId &&
      teeHasHoles(lastSetup.tee)
    ) {
      tee = lastSetup.tee;
    } else {
      try {
        const tees = await fetchTees(frame.course.id);
        tee = (tees.find((t) => t.id === frame.teeId && teeHasHoles(t)) ??
          null) as Tee | null;
      } catch {
        return {
          v: 1,
          kind: "startResult",
          ok: false,
          error: "Couldn't load the tee — check your phone's connection.",
        };
      }
    }
    if (!tee) {
      return { v: 1, kind: "startResult", ok: false, error: "That tee is unavailable." };
    }

    const now = roundToNearestMinute(new Date()).toISOString();
    try {
      startRoundSession({
        id: randomUUID(),
        userId,
        course: frame.course,
        tee,
        holeCount: frame.holeCount,
        nineHoleSection: frame.holeCount === 9 ? (frame.nineHoleSection ?? "front") : undefined,
        now,
      });
    } catch (error) {
      return {
        v: 1,
        kind: "startResult",
        ok: false,
        error: error instanceof Error ? error.message : "Could not start the round",
      };
    }
    sessionPersistence.saveLastSetup({
      v: 1,
      course: frame.course,
      tee,
      holeCount: frame.holeCount,
      ...(frame.holeCount === 9
        ? { nineHoleSection: frame.nineHoleSection ?? "front" }
        : {}),
      savedAt: now,
    });
    return { v: 1, kind: "startResult", ok: true };
  };

  /** Headless mirror of the review screen's onSubmit: same status gates,
      same failure triage (transport → park, rejection → surface). */
  const handleSubmit = async (): Promise<SubmitReply> => {
    const userId = deps.getUserId();
    const current = ownedSession(userId);
    if (!current) {
      return { v: 1, kind: "submitResult", outcome: "error", error: "No active round." };
    }

    // The watch sends FINISH_STARTED before submitRequest; tolerate a lost
    // event by finishing here. Anything else mid-flight bails.
    let finishing = current;
    if (current.status === "active") {
      const transitioned = dispatch({ type: "FINISH_STARTED", at: nowIso() });
      if (!transitioned || transitioned.status !== "finishing") {
        return { v: 1, kind: "submitResult", outcome: "error", error: "Round is busy." };
      }
      finishing = transitioned;
    } else if (current.status !== "finishing") {
      return { v: 1, kind: "submitResult", outcome: "error", error: "Round is busy." };
    }

    const eligibility = finishEligibility(finishing);
    const submitAs: SubmitAs | null = eligibility.as18
      ? "18"
      : finishing.holeCount === 9 && eligibility.asNine
        ? "nine"
        : eligibility.asNine === "front"
          ? "front9"
          : eligibility.asNine === "back"
            ? "back9"
            : null;
    if (!submitAs) {
      dispatch({ type: "FINISH_CANCELLED", at: nowIso() });
      return {
        v: 1,
        kind: "submitResult",
        outcome: "error",
        error: "Round incomplete — score all holes (or a full nine).",
      };
    }

    let payload;
    try {
      payload = toScorecardInput(finishing, {
        teeTime: finishing.startedAt,
        submitAs,
      });
    } catch (error) {
      dispatch({ type: "FINISH_CANCELLED", at: nowIso() });
      return {
        v: 1,
        kind: "submitResult",
        outcome: "error",
        error: error instanceof Error ? error.message : "Round can't be submitted",
      };
    }

    try {
      const result = await submitScorecard(payload);
      dispatch({ type: "SUBMITTED", at: nowIso() });
      sessionPersistence.clearPendingSubmit();
      invalidateRoundQueries(deps.queryClient);
      setTimeout(() => {
        // Same grace the review screen gives its "Submitted!" beat, then
        // the cleared context flips the watch to its home screen.
        const after = getSession();
        if (after && after.id === finishing.id && after.status === "submitted") {
          clearRoundSession();
        }
      }, SUBMIT_GRACE_MS);
      // The differential is computed synchronously server-side; hand it to
      // the watch so its summary card shows it without a second round-trip.
      const summary = submitRoundResultSchema.safeParse(result);
      return {
        v: 1,
        kind: "submitResult",
        outcome: "submitted",
        ...(summary.success
          ? { differential: summary.data.scoreDifferential }
          : {}),
      };
    } catch (error) {
      dispatch({ type: "FINISH_CANCELLED", at: nowIso() });
      if (isTransportError(error)) {
        sessionPersistence.savePendingSubmit({
          v: 1,
          sessionId: finishing.id,
          payload,
          attempts: 1,
          lastAttemptAt: nowIso(),
        });
        return { v: 1, kind: "submitResult", outcome: "parked" };
      }
      return {
        v: 1,
        kind: "submitResult",
        outcome: "error",
        error: error instanceof Error ? error.message : "Failed to submit the round",
      };
    }
  };

  // ------------------------------------------------------------------
  // Wiring
  // ------------------------------------------------------------------

  const onFrame = async (json: string, replyId: string | null) => {
    let raw: unknown;
    try {
      raw = JSON.parse(json);
    } catch {
      return;
    }
    const frame = decodeWatchFrame(raw);
    if (!frame) return;
    const reply = (payload: object) => {
      if (replyId) WatchBridge.reply(replyId, JSON.stringify(payload));
    };

    switch (frame.kind) {
      case "event": {
        const owned = ownedSession(deps.getUserId());
        if (!owned) {
          reply({ v: 1, kind: "eventAck", seq: -1 } satisfies EventAck);
          return;
        }
        // The zod-parsed watch event is exactly a SessionEvent (SUBMITTED is
        // not relayable by schema); the reducer re-validates everything.
        const next = dispatch(frame.event as SessionEvent);
        reply({
          v: 1,
          kind: "eventAck",
          seq: next?.eventSeq ?? -1,
        } satisfies EventAck);
        return;
      }
      case "catalogRequest":
        reply(buildCatalog());
        return;
      case "searchRequest":
        reply(await handleSearch(frame.query));
        return;
      case "teesRequest":
        reply(await handleTees(frame.courseId));
        return;
      case "startRequest":
        reply(await handleStart(frame));
        return;
      case "submitRequest":
        reply(await handleSubmit());
        return;
      case "syncRequest":
        // Watch app launch: hand back the last-known frame immediately,
        // then follow up with fresh stats.
        publish();
        void refreshStats();
        return;
    }
  };

  const frameSub = WatchBridge.onWatchFrame(({ json, replyId }) => {
    void onFrame(json, replyId);
  });
  // Republish whenever the watch (re)connects — applicationContext already
  // has last-value semantics, this just tightens first-sync latency.
  const reachSub = WatchBridge.onReachability(({ reachable }) => {
    if (reachable) {
      publish();
      void refreshStats();
    }
  });
  // Track submits regardless of where they were initiated (phone review
  // screen or watch submitRequest) — any owned session reaching
  // "submitted" kicks off the index-recalculation watch.
  let recalcSeenSessionId: string | null = null;
  const storeUnsub = subscribe(() => {
    publish();
    const owned = ownedSession(deps.getUserId());
    if (owned?.status === "submitted" && owned.id !== recalcSeenSessionId) {
      recalcSeenSessionId = owned.id;
      beginRecalcWatch();
    }
  });

  publish();
  void refreshStats();

  return () => {
    disposed = true;
    stopRecalcWatch();
    frameSub?.remove();
    reachSub?.remove();
    storeUnsub();
  };
}
