/**
 * Horizontal paged FlatList — one page per displayed hole. Swipe moves
 * between holes; the screen can drive it imperatively (auto-advance, strip
 * jumps) via the exposed ref. getItemLayout gives O(1) jumps to any hole.
 */
import { forwardRef, useCallback } from "react";
import { FlatList, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";

import type { Hole } from "@handicappin/handicap-core";

import { HoleCard } from "@/components/live-round/hole-card";
import type { DistanceProvider } from "@/lib/round-session/geo";
import type { HoleEntry } from "@/lib/round-session/types";

interface HolePagerProps {
  holes: Hole[];
  entries: HoleEntry[];
  width: number;
  distanceUnit: "m" | "yd";
  distanceProvider: DistanceProvider;
  onPick: (holeIndex: number, strokes: number) => void;
  onOther: (holeIndex: number) => void;
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
      onPick,
      onOther,
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
        getItemLayout={(_, index) => ({
          length: width,
          offset: width * index,
          index,
        })}
        onMomentumScrollEnd={handleMomentumEnd}
        renderItem={({ item, index }) => (
          <HoleCard
            hole={item}
            entry={entries[index] ?? { strokes: null, updatedAt: "" }}
            distanceUnit={distanceUnit}
            distanceProvider={distanceProvider}
            onPick={(strokes) => onPick(index, strokes)}
            onOther={() => onOther(index)}
            disabled={disabled}
            width={width}
          />
        )}
      />
    );
  },
);
