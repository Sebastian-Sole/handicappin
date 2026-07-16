/**
 * Horizontal paged FlatList — one page per displayed hole. Swipe moves
 * between holes; the screen can drive it imperatively (auto-advance, strip
 * jumps) via the exposed ref. getItemLayout gives O(1) jumps to any hole.
 *
 * Perf: pages are memoized and the window is kept tight — a score/detail
 * dispatch re-renders ONLY the edited hole's card, not all 18 (the reducer
 * reuses untouched entry/hole references, so HoleCard's shallow memo
 * holds; callbacks must stay referentially stable for the same reason).
 */
import { forwardRef, useCallback } from "react";
import { FlatList, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";

import type { Hole } from "@handicappin/handicap-core";

import { HoleCard } from "@/components/live-round/hole-card";
import type { HoleDetailValue } from "@/lib/hole-detail";
import type { DistanceProvider } from "@/lib/round-session/geo";
import type { HoleEntry } from "@/lib/round-session/types";

/** Stable fallback so a missing entry doesn't defeat HoleCard's memo. */
const EMPTY_ENTRY: HoleEntry = { strokes: null, updatedAt: "" };

interface HolePagerProps {
  holes: Hole[];
  entries: HoleEntry[];
  width: number;
  distanceUnit: "m" | "yd";
  distanceProvider: DistanceProvider;
  /** Detail tracking for this round (session.detailed). */
  detailed: boolean;
  onCommit: (holeIndex: number, strokes: number) => void;
  onDetail: (holeIndex: number, detail: HoleDetailValue) => void;
  /** Fired when a swipe settles on a page (index derived from offset). */
  onPageSettled: (holeIndex: number) => void;
  /** Page to open on mount — resume lands on the hole the player left. */
  initialIndex: number;
  disabled?: boolean;
}

export const HolePager = forwardRef<FlatList<Hole>, HolePagerProps>(
  function HolePager(
    {
      holes,
      entries,
      width,
      distanceUnit,
      distanceProvider,
      detailed,
      onCommit,
      onDetail,
      onPageSettled,
      initialIndex,
      disabled,
    },
    ref,
  ) {
    const handleMomentumEnd = useCallback(
      (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        const index = Math.round(
          event.nativeEvent.contentOffset.x / Math.max(1, width),
        );
        if (index >= 0 && index < holes.length) onPageSettled(index);
      },
      [width, holes.length, onPageSettled],
    );

    return (
      <FlatList
        ref={ref}
        testID="live-hole-pager"
        data={holes}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(hole) => String(hole.holeNumber)}
        initialScrollIndex={initialIndex}
        // Keep the mounted window small: full-screen pages with the default
        // windowSize (21) mount every hole, so each tap re-rendered 18
        // cards. getItemLayout keeps far jumps O(1) regardless.
        initialNumToRender={1}
        maxToRenderPerBatch={2}
        windowSize={5}
        getItemLayout={(_, index) => ({
          length: width,
          offset: width * index,
          index,
        })}
        onMomentumScrollEnd={handleMomentumEnd}
        // Android can drop momentum-end events (RN long-standing issue);
        // the drag-end fallback computes the same offset-derived index.
        // Full Android hardening is deferred with the platform pass.
        onScrollEndDrag={handleMomentumEnd}
        renderItem={({ item, index }) => (
          <HoleCard
            hole={item}
            holeIndex={index}
            entry={entries[index] ?? EMPTY_ENTRY}
            distanceUnit={distanceUnit}
            distanceProvider={distanceProvider}
            detailed={detailed}
            onCommit={onCommit}
            onDetail={onDetail}
            disabled={disabled}
            width={width}
          />
        )}
      />
    );
  },
);
