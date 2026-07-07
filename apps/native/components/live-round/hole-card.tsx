/** One hole's page in the live pager: hole info, score readout, quick-pick. */
import { Pressable, Text, View } from "react-native";

import type { Hole } from "@handicappin/handicap-core";

import { DistanceToHole } from "@/components/live-round/distance-to-hole";
import {
  scoreDiffLabel,
  scoreDiffTextClass,
} from "@/components/live-round/score-colors";
import { ScoreQuickPick } from "@/components/live-round/score-quick-pick";
import type { DistanceProvider } from "@/lib/round-session/geo";
import type { HoleEntry } from "@/lib/round-session/types";
import { cn } from "@/lib/utils";

interface HoleCardProps {
  hole: Hole;
  entry: HoleEntry;
  distanceUnit: "m" | "yd";
  distanceProvider: DistanceProvider;
  onPick: (strokes: number) => void;
  /** Open the stepper (readout tap or "Other" button). */
  onOther: () => void;
  disabled?: boolean;
  width: number;
}

export function HoleCard({
  hole,
  entry,
  distanceUnit,
  distanceProvider,
  onPick,
  onOther,
  disabled,
  width,
}: HoleCardProps) {
  const diff = entry.strokes === null ? null : entry.strokes - hole.par;

  return (
    <View style={{ width }} className="px-md justify-center gap-lg">
      <View className="items-center gap-xs">
        <Text className="text-label-sm text-muted-foreground">HOLE</Text>
        <Text className="text-display text-foreground">
          {hole.holeNumber}
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

      <Pressable
        testID={`live-score-readout-${hole.holeNumber}`}
        accessibilityRole="button"
        accessibilityLabel={
          entry.strokes === null
            ? "No score yet, opens manual entry"
            : `Score ${entry.strokes}, opens manual entry`
        }
        disabled={disabled}
        onPress={onOther}
        className="items-center gap-xs active:opacity-80"
      >
        <Text
          className={cn(
            "text-figure-3xl",
            diff === null ? "text-muted-foreground" : scoreDiffTextClass(diff),
          )}
        >
          {entry.strokes ?? "—"}
        </Text>
        {diff !== null ? (
          <Text className={cn("text-label-sm", scoreDiffTextClass(diff))}>
            {scoreDiffLabel(diff)}
          </Text>
        ) : (
          <Text className="text-label-sm text-muted-foreground">
            Tap a score below
          </Text>
        )}
      </Pressable>

      <ScoreQuickPick
        par={hole.par}
        selected={entry.strokes}
        onPick={onPick}
        onOther={onOther}
        disabled={disabled}
      />
    </View>
  );
}
