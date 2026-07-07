/**
 * At-a-glance scorecard + jump navigation: one mini-cell per hole, score
 * color-coded vs par, current hole ringed. Tap any cell to jump the pager.
 */
import { useEffect, useRef } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import type { Hole } from "@handicappin/handicap-core";

import {
  scoreDiffTextClass,
  scoreDiffTintClass,
} from "@/components/live-round/score-colors";
import type { HoleEntry } from "@/lib/round-session/types";
import { cn } from "@/lib/utils";

interface HoleStripProps {
  holes: Hole[];
  entries: HoleEntry[];
  currentIndex: number;
  onSelect: (holeIndex: number) => void;
  disabled?: boolean;
}

// Cell width + gap for the auto-centering scroll math.
const CELL_WIDTH = 44; // allow-hardcoded scroll-offset math must match the fixed cell size below
const CELL_GAP = 8; // allow-hardcoded gap-sm equivalent used in the same math

export function HoleStrip({
  holes,
  entries,
  currentIndex,
  onSelect,
  disabled,
}: HoleStripProps) {
  const scrollRef = useRef<ScrollView>(null);

  // Keep the current hole roughly centered as the player advances.
  useEffect(() => {
    scrollRef.current?.scrollTo({
      x: Math.max(0, (CELL_WIDTH + CELL_GAP) * (currentIndex - 3)),
      animated: true,
    });
  }, [currentIndex]);

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: CELL_GAP, paddingHorizontal: CELL_GAP }}
    >
      {holes.map((hole, index) => {
        const strokes = entries[index]?.strokes ?? null;
        const diff = strokes === null ? null : strokes - hole.par;
        const isCurrent = index === currentIndex;
        return (
          <Pressable
            key={hole.holeNumber}
            testID={`live-hole-strip-${hole.holeNumber}`}
            accessibilityRole="button"
            accessibilityLabel={
              strokes === null
                ? `Hole ${hole.holeNumber}, not scored`
                : `Hole ${hole.holeNumber}, ${strokes} strokes`
            }
            accessibilityState={{ selected: isCurrent, disabled }}
            disabled={disabled}
            onPress={() => onSelect(index)}
            style={{ width: CELL_WIDTH, height: CELL_WIDTH }}
            className={cn(
              "items-center justify-center rounded-md active:opacity-80",
              diff !== null ? scoreDiffTintClass(diff) : "bg-muted",
              isCurrent && "border-2 border-ring",
            )}
          >
            <Text className="text-label-sm text-muted-foreground">
              {hole.holeNumber}
            </Text>
            <Text
              className={cn(
                "text-figure-sm",
                diff === null
                  ? "text-muted-foreground"
                  : scoreDiffTextClass(diff),
              )}
            >
              {strokes ?? "·"}
            </Text>
          </Pressable>
        );
      })}
      <View style={{ width: CELL_GAP }} />
    </ScrollView>
  );
}
