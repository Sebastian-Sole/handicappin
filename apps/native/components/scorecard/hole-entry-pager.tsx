/**
 * One-hole-at-a-time scorecard entry (plan 013 D1) — native mirror of
 * apps/web/components/scorecard/hole-entry-pager.tsx. THE phone logging UI:
 * hole meta, a prominent score stepper, and (when the round is detailed)
 * the shared Putts / Fairway / Penalties trio, paged with Prev / Next.
 */
import { Minus, Plus } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";

import { tokens } from "@handicappin/tokens/tokens";

import { HoleDetailTrio } from "@/components/scorecard/hole-detail-trio";
import {
  HOLE_IN_ONE_CELEBRATION_MS,
  HoleInOneCelebration,
} from "@/components/scorecard/hole-in-one-celebration";
import { Button } from "@/components/ui/button";
import { useColorMode } from "@/lib/color-mode";
import type { HoleDetailValue } from "@/lib/hole-detail";
import type { Hole, ScoreInput, Tee } from "@/lib/scorecard";
import { cn } from "@/lib/utils";

export const MIN_ENTRY_STROKES = 1;
export const MAX_ENTRY_STROKES = 30;

/**
 * Step a hole's strokes with the big stepper. Unset (0) seeds par on the
 * first interaction — one tap logs the most common score — then adjusts.
 */
export function stepStrokes(
  current: number,
  delta: 1 | -1,
  par: number,
): number {
  if (current <= 0) return par;
  return Math.min(
    MAX_ENTRY_STROKES,
    Math.max(MIN_ENTRY_STROKES, current + delta),
  );
}

const STEP_ICON_SIZE = 20; // allow-hardcoded lucide icon prop inside the 48px stepper buttons

interface HoleEntryPagerProps {
  selectedTee: Tee | undefined;
  displayedHoles: Hole[];
  holeCount: number;
  scores: ScoreInput[];
  onScoreChange: (holeIndex: number, strokes: number) => void;
  disabled: boolean;
  detailedScoring?: boolean;
  onScoreDetailChange?: (holeIndex: number, detail: HoleDetailValue) => void;
}

export function HoleEntryPager({
  selectedTee,
  displayedHoles,
  holeCount,
  scores,
  onScoreChange,
  disabled,
  detailedScoring = false,
  onScoreDetailChange,
}: HoleEntryPagerProps) {
  const mode = useColorMode();
  const foreground = tokens.colors[mode].foreground;
  const [currentIndex, setCurrentIndex] = useState(0);
  // Hole-in-one guard: a score of 1 asks for confirmation on Next (an
  // accidental ace is far more common than a real one), then celebrates.
  const [celebrating, setCelebrating] = useState(false);
  const confirmedAces = useRef<Set<number>>(new Set());
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
    };
  }, []);
  // Hole count can change under a live pager (18 → 9 switch).
  const index = Math.min(currentIndex, holeCount - 1);
  const hole = displayedHoles[index];
  const score = scores[index];
  const strokes = score?.strokes ?? 0;
  const unit = selectedTee?.distanceMeasurement === "meters" ? "m" : "yd";

  if (!hole) return null;

  const diff = strokes > 0 ? strokes - hole.par : null;
  const scoredCount = scores
    .slice(0, holeCount)
    .filter((s) => s.strokes > 0).length;

  const goNext = () => setCurrentIndex((i) => Math.min(holeCount - 1, i + 1));

  const handleNext = () => {
    // Data entry can put a 1 down by accident — confirm before moving on
    // (once per hole; browsing back and forth doesn't nag).
    if (!disabled && strokes === 1 && !confirmedAces.current.has(index)) {
      Alert.alert(
        "Hole in one?",
        `You just logged a hole in one on hole ${index + 1} — was this correct?`,
        [
          { text: "Change", style: "cancel" },
          {
            text: "Continue",
            onPress: () => {
              confirmedAces.current.add(index);
              setCelebrating(true);
              advanceTimer.current = setTimeout(
                goNext,
                HOLE_IN_ONE_CELEBRATION_MS,
              );
            },
          },
        ],
      );
      return;
    }
    goNext();
  };

  const stepButton = (
    delta: 1 | -1,
    stepDisabled: boolean,
    label: string,
    testID: string,
  ) => (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={stepDisabled}
      onPress={() => onScoreChange(index, stepStrokes(strokes, delta, hole.par))}
      className={cn(
        "h-12 w-12 items-center justify-center rounded-full border border-border bg-background active:opacity-80",
        stepDisabled && "opacity-40",
      )}
    >
      {delta === 1 ? (
        <Plus size={STEP_ICON_SIZE} color={foreground} />
      ) : (
        <Minus size={STEP_ICON_SIZE} color={foreground} />
      )}
    </Pressable>
  );

  return (
    <View
      testID="hole-entry-pager"
      className="rounded-lg border border-border bg-background p-md gap-md"
    >
      <View className="flex-row items-baseline justify-between">
        <Text className="text-label-sm text-muted-foreground">
          Hole {index + 1} of {holeCount}
        </Text>
        <Text className="text-meta text-muted-foreground">
          {scoredCount} scored
        </Text>
      </View>

      {/* Progress: one segment per hole (done / current / todo). */}
      <View className="flex-row gap-xs">
        {displayedHoles.map((_, i) => (
          <View
            key={i}
            className={cn(
              "h-1 flex-1 rounded-full",
              i === index
                ? "bg-primary"
                : (scores[i]?.strokes ?? 0) > 0
                  ? "bg-success"
                  : "bg-muted",
            )}
          />
        ))}
      </View>

      <View className="items-center gap-xs">
        <Text className="text-body-sm text-muted-foreground">
          Hole {index + 1} · Par {hole.par} · {hole.distance} {unit} · SI{" "}
          {hole.hcp}
        </Text>
        <View className="flex-row items-center justify-center gap-lg">
          {stepButton(
            -1,
            disabled || (strokes > 0 && strokes <= MIN_ENTRY_STROKES),
            `One stroke less on hole ${index + 1}`,
            "entry-score-minus",
          )}
          <View className="min-w-20 items-center">
            <Text
              testID="entry-score-value"
              accessibilityLabel={`Score for hole ${index + 1}: ${
                strokes > 0 ? strokes : "not set"
              }`}
              className={cn(
                "text-figure text-foreground",
                strokes === 0 && "text-muted-foreground",
              )}
            >
              {strokes > 0 ? strokes : "—"}
            </Text>
            <Text className="text-meta text-muted-foreground">
              {/* Read-only surfaces (live review) disable the steppers —
                  don't instruct the user to tap a dead control. */}
              {diff === null
                ? disabled
                  ? "Not scored"
                  : "Tap + to score"
                : diff === 0
                  ? "Par"
                  : diff > 0
                    ? `+${diff}`
                    : `${diff}`}
            </Text>
          </View>
          {stepButton(
            1,
            disabled || strokes >= MAX_ENTRY_STROKES,
            `One stroke more on hole ${index + 1}`,
            "entry-score-plus",
          )}
        </View>
      </View>

      {detailedScoring ? (
        <HoleDetailTrio
          mode="editable"
          holeNumber={index + 1}
          par={hole.par}
          value={{
            putts: score?.putts,
            fairwayHit: score?.fairwayHit,
            penaltyStrokes: score?.penaltyStrokes,
          }}
          strokes={strokes > 0 ? strokes : null}
          disabled={disabled}
          onChange={(detail) => onScoreDetailChange?.(index, detail)}
        />
      ) : null}

      {/* Paging stays available while inputs are disabled — browsing a
          read-only scorecard is navigation, not data entry. */}
      <View className="flex-row gap-sm">
        <Button
          testID="entry-prev-hole"
          variant="outline"
          className="flex-1"
          disabled={index === 0}
          onPress={() => setCurrentIndex(Math.max(0, index - 1))}
        >
          ← Prev
        </Button>
        <Button
          testID="entry-next-hole"
          className="flex-1"
          disabled={index >= holeCount - 1}
          onPress={handleNext}
        >
          Next →
        </Button>
      </View>

      <HoleInOneCelebration
        visible={celebrating}
        onDone={() => setCelebrating(false)}
      />
    </View>
  );
}
