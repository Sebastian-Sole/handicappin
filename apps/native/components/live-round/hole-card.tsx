/**
 * One hole's page in the live pager: hole meta, the one-tap score grid
 * (par-relative boxes — the fast path), an inline stepper for outlier
 * scores ("Other"), the shared detail trio (when the round is detailed),
 * and one Save action — hole-out capture in a single moment (plan 013 D4).
 * A score of 1 asks for confirmation before committing (an accidental
 * hole-in-one is far more common than a real one).
 */
import { Minus, Plus } from "lucide-react-native";
import { memo, useEffect, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";

import type { Hole } from "@handicappin/handicap-core";

import { tokens } from "@handicappin/tokens/tokens";

import { DistanceToHole } from "@/components/live-round/distance-to-hole";
import {
  scoreDiffLabel,
  scoreDiffTextClass,
} from "@/components/live-round/score-colors";
import { ScoreQuickPick } from "@/components/live-round/score-quick-pick";
import { HoleDetailTrio } from "@/components/scorecard/hole-detail-trio";
import { useColorMode } from "@/lib/color-mode";
import type { HoleDetailValue } from "@/lib/hole-detail";
import type { DistanceProvider } from "@/lib/round-session/geo";
import { MAX_STROKES, MIN_STROKES } from "@/lib/round-session/engine";
import type { HoleEntry } from "@/lib/round-session/types";
import { cn } from "@/lib/utils";

const STEP_ICON_SIZE = 20; // allow-hardcoded lucide icon prop inside the 48px stepper buttons

interface HoleCardProps {
  hole: Hole;
  /** This card's index in the pager — passed back through the callbacks. */
  holeIndex: number;
  entry: HoleEntry;
  distanceUnit: "m" | "yd";
  distanceProvider: DistanceProvider;
  /** Detail tracking for this round (session.detailed). */
  detailed: boolean;
  /** Commit the pending strokes for this hole (SCORE_SET). */
  onCommit: (holeIndex: number, strokes: number) => void;
  /** Patch this hole's detail (HOLE_DETAIL_SET). */
  onDetail: (holeIndex: number, detail: HoleDetailValue) => void;
  disabled?: boolean;
  width: number;
}

/**
 * memo'd: the reducer reuses untouched hole/entry references and the screen
 * keeps the callbacks stable, so a dispatch re-renders only the edited page.
 */
export const HoleCard = memo(function HoleCard({
  hole,
  holeIndex,
  entry,
  distanceUnit,
  distanceProvider,
  detailed,
  onCommit,
  onDetail,
  disabled,
  width,
}: HoleCardProps) {
  const mode = useColorMode();
  const foreground = tokens.colors[mode].foreground;
  // Pending (uncommitted) strokes; null = untouched, display falls back to
  // the committed score. NO silent par default — a score exists only after
  // a deliberate tap (defaulting would fabricate data).
  const [pending, setPending] = useState<number | null>(null);
  // The stepper row for scores outside the quick-pick grid ("Other").
  const [stepperOpen, setStepperOpen] = useState(false);
  const committed = entry.strokes;

  // A committed-score change from elsewhere (watch, strip edit) re-seeds.
  useEffect(() => {
    setPending(null);
  }, [committed]);

  const displayed = pending ?? committed;
  const diff = displayed === null ? null : displayed - hole.par;
  const saveLabel =
    committed === null
      ? "Save hole"
      : displayed === committed
        ? "Saved ✓"
        : "Update score";
  const saveDisabled =
    disabled || displayed === null || displayed === committed;

  const commitDisplayed = () => {
    if (displayed === null) return;
    if (displayed === 1) {
      // Confirm before an ace lands — the celebration + auto-advance follow
      // from the screen once the commit goes through.
      Alert.alert(
        "Hole in one?",
        "You just logged a hole in one — was this correct?",
        [
          { text: "Change", style: "cancel" },
          { text: "Continue", onPress: () => onCommit(holeIndex, 1) },
        ],
      );
      return;
    }
    onCommit(holeIndex, displayed);
  };

  const stepButton = (delta: 1 | -1) => {
    const base = displayed ?? hole.par;
    const stepDisabled =
      disabled ||
      (delta === -1 ? base <= MIN_STROKES : base >= MAX_STROKES);
    return (
      <Pressable
        testID={`live-score-${delta === 1 ? "plus" : "minus"}-${hole.holeNumber}`}
        accessibilityRole="button"
        accessibilityLabel={
          delta === 1
            ? `One stroke more on hole ${hole.holeNumber}`
            : `One stroke less on hole ${hole.holeNumber}`
        }
        disabled={stepDisabled}
        onPress={() =>
          setPending(
            displayed === null
              ? hole.par
              : Math.min(MAX_STROKES, Math.max(MIN_STROKES, displayed + delta)),
          )
        }
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
  };

  return (
    <View style={{ width }} className="px-md justify-center gap-md">
      <View className="items-center gap-xs">
        <Text className="text-label-sm text-muted-foreground">
          HOLE {hole.holeNumber}
        </Text>
        <Text className="text-body text-muted-foreground">
          Par {hole.par} · {hole.distance} {distanceUnit} · SI {hole.hcp}
        </Text>
        {/* Reserved GPS region — renders nothing until a real provider. */}
        <DistanceToHole
          provider={distanceProvider}
          holeNumber={hole.holeNumber}
        />
      </View>

      {/* One-tap score grid (par−3 … par+4); "Other" opens the stepper. */}
      <ScoreQuickPick
        par={hole.par}
        selected={displayed}
        onPick={(strokes) => {
          setStepperOpen(false);
          setPending(strokes);
        }}
        onOther={() => setStepperOpen(true)}
        disabled={disabled}
      />

      {stepperOpen || (displayed !== null && displayed > hole.par + 4) ? (
        <View className="flex-row items-center justify-center gap-lg">
          {stepButton(-1)}
          <View className="min-w-20 items-center">
            <Text
              testID={`live-score-value-${hole.holeNumber}`}
              accessibilityLabel={`Score for hole ${hole.holeNumber}: ${
                displayed ?? "not set"
              }${committed === null ? " (not saved yet)" : ""}`}
              className={cn(
                "text-figure-3xl",
                diff === null
                  ? "text-muted-foreground"
                  : scoreDiffTextClass(diff),
              )}
            >
              {displayed ?? "—"}
            </Text>
            <Text
              className={cn(
                "text-label-sm",
                diff === null
                  ? "text-muted-foreground"
                  : scoreDiffTextClass(diff),
              )}
            >
              {diff === null ? "Tap a score" : scoreDiffLabel(diff)}
            </Text>
          </View>
          {stepButton(1)}
        </View>
      ) : null}

      {detailed ? (
        <HoleDetailTrio
          mode="editable"
          holeNumber={hole.holeNumber}
          par={hole.par}
          value={{
            putts: entry.putts,
            fairwayHit: entry.fairwayHit,
            penaltyStrokes: entry.penaltyStrokes,
          }}
          strokes={displayed}
          disabled={disabled}
          onChange={(detail) => onDetail(holeIndex, detail)}
        />
      ) : null}

      <Pressable
        testID={`live-save-hole-${hole.holeNumber}`}
        accessibilityRole="button"
        accessibilityLabel={saveLabel}
        disabled={saveDisabled}
        onPress={commitDisplayed}
        className={cn(
          "h-12 items-center justify-center rounded-lg bg-primary active:opacity-90",
          saveDisabled && "opacity-60",
        )}
      >
        <Text className="text-label-sm text-primary-foreground">
          {saveLabel}
        </Text>
      </Pressable>
    </View>
  );
});
