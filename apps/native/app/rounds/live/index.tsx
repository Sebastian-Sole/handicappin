/**
 * The live hole screen — the god-metric surface: one tap on the quick-pick
 * commits a score and auto-advances to the next unscored hole (a clean 18
 * is 18 taps). Swipe or tap the strip to move between holes. All state
 * flows through the round-session store (SQLite-backed on every event), so
 * signal loss, backgrounding, or an app kill never costs a score.
 */
import { Redirect, router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { useWindowDimensions, View, type FlatList } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { Hole } from "@handicappin/handicap-core";

import { DataSettledMarker } from "@/components/data-settled";
import { FinishBar } from "@/components/live-round/finish-bar";
import { HolePager } from "@/components/live-round/hole-pager";
import { HoleStrip } from "@/components/live-round/hole-strip";
import { LiveHeader } from "@/components/live-round/live-header";
import { ScoreStepper } from "@/components/live-round/score-stepper";
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

const closeModal = () => {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace("/");
  }
};

/** Visual-confirm delay before auto-advancing to the next hole. */
const ADVANCE_DELAY_MS = 300;

export default function LiveRoundScreen() {
  const session = useOwnedRoundSession();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const pagerRef = useRef<FlatList<Hole>>(null);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [stepperFor, setStepperFor] = useState<number | null>(null);

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

  if (!session) return <Redirect href="/rounds/live/setup" />;

  // "finishing" while the review screen submits — freeze inputs here.
  const disabled = session.status !== "active";
  const nowIso = () => new Date().toISOString();

  // Manual navigation (strip tap, swipe) cancels any queued auto-advance —
  // otherwise the 300ms timer fires afterwards and yanks the user away
  // from the hole they deliberately chose.
  const cancelPendingAdvance = () => {
    if (advanceTimer.current) {
      clearTimeout(advanceTimer.current);
      advanceTimer.current = null;
    }
  };

  // Dispatch only — the cursor effect above does the actual scrolling.
  const jumpTo = (holeIndex: number) => {
    cancelPendingAdvance();
    dispatch({ type: "HOLE_SELECTED", holeIndex, at: nowIso() });
  };

  const handlePick = (holeIndex: number, strokes: number) => {
    const before = getSession();
    const wasUnscored = before?.entries[holeIndex]?.strokes === null;
    const next = dispatch({
      type: "SCORE_SET",
      holeIndex,
      strokes,
      at: nowIso(),
    });
    // Auto-advance only on FIRST score for a hole (edits never yank the
    // player away), and never while an advance is already pending — the
    // second half of the double-tap guard (the first is engine idempotence).
    if (!next || !wasUnscored || advanceTimer.current) return;
    const target = nextHoleAfterScore(next, holeIndex);
    if (target === holeIndex) return;
    advanceTimer.current = setTimeout(() => {
      advanceTimer.current = null;
      jumpTo(target);
    }, ADVANCE_DELAY_MS);
  };

  const eligibility = finishEligibility(session);

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

      <View className="flex-1 justify-center">
        <HolePager
          ref={pagerRef}
          holes={session.displayedHoles}
          entries={session.entries}
          width={width}
          distanceUnit={session.tee.distanceMeasurement === "meters" ? "m" : "yd"}
          distanceProvider={nullDistanceProvider}
          onPick={handlePick}
          onOther={setStepperFor}
          onPageSettled={(holeIndex) => {
            // A swipe that lands on a different hole is manual navigation.
            if (holeIndex !== getSession()?.currentHoleIndex) {
              cancelPendingAdvance();
            }
            dispatch({ type: "HOLE_SELECTED", holeIndex, at: nowIso() });
          }}
          initialIndex={session.currentHoleIndex}
          disabled={disabled}
        />
      </View>

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

      <ScoreStepper
        visible={stepperFor !== null}
        par={
          stepperFor !== null
            ? (session.displayedHoles[stepperFor]?.par ?? 4)
            : 4
        }
        initial={
          stepperFor !== null
            ? (session.entries[stepperFor]?.strokes ?? null)
            : null
        }
        onCommit={(strokes) => {
          if (stepperFor !== null) handlePick(stepperFor, strokes);
        }}
        onClose={() => setStepperFor(null)}
      />
    </View>
  );
}
