/**
 * The live hole screen — one logging UI (plan 013 D1): the same score
 * stepper + detail trio as post-round entry, captured in one moment at
 * hole-out (D4), plus a Play face reserved for distance-to-pin (D5 seam).
 * All state flows through the round-session store (SQLite-backed on every
 * event), so signal loss, backgrounding, or an app kill never costs a
 * score.
 */
import { Redirect, router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, Text, useWindowDimensions, View, type FlatList } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { Hole } from "@handicappin/handicap-core";

import { DataSettledMarker } from "@/components/data-settled";
import { FinishBar } from "@/components/live-round/finish-bar";
import { HolePager } from "@/components/live-round/hole-pager";
import { HoleStrip } from "@/components/live-round/hole-strip";
import { LiveHeader } from "@/components/live-round/live-header";
import {
  HOLE_IN_ONE_CELEBRATION_MS,
  HoleInOneCelebration,
} from "@/components/scorecard/hole-in-one-celebration";
import type { HoleDetailValue } from "@/lib/hole-detail";
import { nextHoleAfterScore } from "@/lib/round-session/engine";
import { nullDistanceProvider } from "@/lib/round-session/geo";
import {
  finishEligibility,
  scoredCount,
  totalStrokes,
  vsPar,
} from "@/lib/round-session/selectors";
import {
  discardRoundSession,
  dispatch,
  getSession,
} from "@/lib/round-session/store";
import { useOwnedRoundSession } from "@/lib/round-session/use-owned-session";
import { cn } from "@/lib/utils";

const closeModal = () => {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace("/");
  }
};

/** Visual-confirm delay before auto-advancing to the next hole. */
const ADVANCE_DELAY_MS = 300;

const nowIso = () => new Date().toISOString();

export default function LiveRoundScreen() {
  const session = useOwnedRoundSession();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const pagerRef = useRef<FlatList<Hole>>(null);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Play face (reserved distance slot) vs Score face (the logging UI).
  const [face, setFace] = useState<"play" | "score">("score");
  // Hole-in-one celebration overlay: shows on an ace commit and holds the
  // auto-advance until it finishes.
  const [celebrating, setCelebrating] = useState(false);

  useEffect(() => {
    return () => {
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
    };
  }, []);

  // The store cursor is the single source of truth for which hole is shown;
  // every navigation (auto-advance, strip tap, review's missing-hole chips)
  // dispatches HOLE_SELECTED and this effect moves the pager. Swipes settle
  // to their own index, so the follow-up scroll is a visual no-op.
  const currentHoleIndex = session?.currentHoleIndex;
  useEffect(() => {
    if (currentHoleIndex !== undefined) {
      pagerRef.current?.scrollToIndex({
        index: currentHoleIndex,
        animated: true,
      });
    }
  }, [currentHoleIndex]);

  // Callbacks are useCallback'd (and therefore declared before the early
  // return) so the pager's memoized HoleCards only re-render when their own
  // hole changes — a dispatch used to re-render every mounted page.

  // Manual navigation (strip tap, swipe) cancels any queued auto-advance —
  // otherwise the 300ms timer fires afterwards and yanks the user away
  // from the hole they deliberately chose.
  const cancelPendingAdvance = useCallback(() => {
    if (advanceTimer.current) {
      clearTimeout(advanceTimer.current);
      advanceTimer.current = null;
    }
  }, []);

  // Dispatch only — the cursor effect above does the actual scrolling.
  const jumpTo = useCallback(
    (holeIndex: number) => {
      cancelPendingAdvance();
      dispatch({ type: "HOLE_SELECTED", holeIndex, at: nowIso() });
    },
    [cancelPendingAdvance],
  );

  const handleCommit = useCallback(
    (holeIndex: number, strokes: number) => {
      const before = getSession();
      const wasUnscored = before?.entries[holeIndex]?.strokes === null;
      const next = dispatch({
        type: "SCORE_SET",
        holeIndex,
        strokes,
        at: nowIso(),
      });
      // An ace (already confirmed in the hole card) gets its moment — commit
      // first (data safety), celebrate over the top, advance after.
      const isAce = next !== null && strokes === 1;
      if (isAce) setCelebrating(true);
      // Auto-advance only on FIRST score for a hole (edits never yank the
      // player away), and never while an advance is already pending — the
      // second half of the double-tap guard (the first is engine idempotence).
      if (!next || !wasUnscored || advanceTimer.current) return;
      const target = nextHoleAfterScore(next, holeIndex);
      if (target === holeIndex) return;
      advanceTimer.current = setTimeout(
        () => {
          advanceTimer.current = null;
          jumpTo(target);
        },
        isAce ? HOLE_IN_ONE_CELEBRATION_MS : ADVANCE_DELAY_MS,
      );
    },
    [jumpTo],
  );

  // Hole-out detail patch: persisted per interaction (an app kill between
  // taps never loses a value). undefined from the trio means "cleared" —
  // sent as an explicit null so the patch survives JSON (absent = leave
  // unchanged in the event contract).
  const handleDetail = useCallback(
    (holeIndex: number, detail: HoleDetailValue) => {
      dispatch({
        type: "HOLE_DETAIL_SET",
        holeIndex,
        ...("putts" in detail ? { putts: detail.putts ?? null } : {}),
        ...("fairwayHit" in detail
          ? { fairwayHit: detail.fairwayHit ?? null }
          : {}),
        ...("penaltyStrokes" in detail
          ? { penaltyStrokes: detail.penaltyStrokes ?? null }
          : {}),
        at: nowIso(),
      });
    },
    [],
  );

  // A swipe that lands on a different hole is manual navigation.
  const handlePageSettled = useCallback(
    (holeIndex: number) => {
      if (holeIndex !== getSession()?.currentHoleIndex) {
        cancelPendingAdvance();
      }
      dispatch({ type: "HOLE_SELECTED", holeIndex, at: nowIso() });
    },
    [cancelPendingAdvance],
  );

  if (!session) return <Redirect href="/rounds/live/setup" />;

  // "finishing" while the review screen submits — freeze inputs here.
  const disabled = session.status !== "active";

  const eligibility = finishEligibility(session);
  const currentHole = session.displayedHoles[session.currentHoleIndex];
  const distanceUnit =
    session.tee.distanceMeasurement === "meters" ? "m" : "yd";

  return (
    <View
      testID="live-round-screen"
      className="flex-1 bg-background"
      style={{
        paddingTop: insets.top,
        paddingBottom: insets.bottom,
      }}
    >
      {/* No async data on this screen — vacuously settled. */}
      <DataSettledMarker settled />
      <HoleInOneCelebration
        visible={celebrating}
        onDone={() => setCelebrating(false)}
      />
      <LiveHeader
        courseName={session.course.name}
        scored={scoredCount(session)}
        holeCount={session.holeCount}
        totalStrokes={totalStrokes(session)}
        vsPar={vsPar(session)}
        onLeave={closeModal}
        onAbandon={() => {
          // discard (not clear): also drops a pendingSubmit parked by this
          // session, so an abandoned round can't auto-submit later.
          discardRoundSession();
          closeModal();
        }}
      />

      {/* Play / Score face switch (plan 013 D5 seam): Play is the reserved
          distance face; Score is the logging UI. */}
      <View className="mx-md mt-sm flex-row rounded-lg border border-border bg-background-alternate p-xs">
        {(
          [
            { key: "play", label: "⚑ Play" },
            { key: "score", label: "✎ Score" },
          ] as const
        ).map(({ key, label }) => (
          <Pressable
            key={key}
            testID={`live-face-${key}`}
            accessibilityRole="tab"
            accessibilityState={{ selected: face === key }}
            onPress={() => setFace(key)}
            className={cn(
              "h-9 flex-1 items-center justify-center rounded-md",
              face === key && "bg-background",
            )}
          >
            <Text
              className={cn(
                "text-label-sm",
                face === key ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </View>

      {face === "play" ? (
        <View className="flex-1 justify-center px-md gap-lg">
          <View className="items-center gap-xs">
            <Text className="text-label-sm text-muted-foreground">HOLE</Text>
            <Text className="text-display text-foreground">
              {currentHole?.holeNumber ?? "—"}
            </Text>
            <Text className="text-body text-muted-foreground">
              Par {currentHole?.par ?? "—"} · {currentHole?.distance ?? "—"}{" "}
              {distanceUnit} · SI {currentHole?.hcp ?? "—"}
            </Text>
          </View>
          {/* Reserved distance-to-pin slot — total distance until GPS /
              course-map data exists (plan 013 scope: reserved only). */}
          <View className="items-center gap-xs rounded-lg border border-dashed border-border p-lg">
            <Text className="text-meta text-warning uppercase">
              Distance to pin
            </Text>
            <Text className="text-figure-3xl text-foreground">
              {currentHole?.distance ?? "—"}
            </Text>
            <Text className="text-body-sm text-muted-foreground">
              {distanceUnit === "m" ? "meters" : "yards"} · full hole
            </Text>
            <Text className="text-meta text-muted-foreground">
              Reserved — arrives with GPS / course maps
            </Text>
          </View>
          <Pressable
            testID="live-log-this-hole"
            accessibilityRole="button"
            accessibilityLabel="Log this hole"
            onPress={() => setFace("score")}
            className="h-12 items-center justify-center rounded-lg bg-primary active:opacity-90"
          >
            <Text className="text-label-sm text-primary-foreground">
              Log this hole →
            </Text>
          </Pressable>
        </View>
      ) : (
        <View className="flex-1 justify-center">
          <HolePager
            ref={pagerRef}
            holes={session.displayedHoles}
            entries={session.entries}
            width={width}
            distanceUnit={distanceUnit}
            distanceProvider={nullDistanceProvider}
            detailed={session.detailed === true}
            onCommit={handleCommit}
            onDetail={handleDetail}
            onPageSettled={handlePageSettled}
            initialIndex={session.currentHoleIndex}
            disabled={disabled}
          />
        </View>
      )}

      <View className="gap-md pb-sm">
        <HoleStrip
          holes={session.displayedHoles}
          entries={session.entries}
          currentIndex={session.currentHoleIndex}
          onSelect={jumpTo}
          disabled={disabled}
        />
        <FinishBar
          eligibility={eligibility}
          scored={scoredCount(session)}
          holeCount={session.holeCount}
          onFinish={() => router.push("/rounds/live/review")}
        />
      </View>
    </View>
  );
}
