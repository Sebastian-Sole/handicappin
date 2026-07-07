/**
 * The one-tap score entry: a grid of par-relative numbers (par−3 … par+4,
 * floored at 1). Tapping a number commits the score — no confirm step.
 * Par is visually pre-emphasized as the statistical default, but NO score
 * exists until a tap (silently defaulting to par would fabricate data).
 */
import { Pressable, Text, View } from "react-native";

import { cn } from "@/lib/utils";
import {
  scoreDiffLabel,
  scoreDiffTextClass,
  scoreDiffTintClass,
} from "@/components/live-round/score-colors";

interface ScoreQuickPickProps {
  par: number;
  /** Currently entered strokes for this hole (null = unscored). */
  selected: number | null;
  onPick: (strokes: number) => void;
  /** Opens the stepper for outlier scores (> par+4). */
  onOther: () => void;
  disabled?: boolean;
}

export function ScoreQuickPick({
  par,
  selected,
  onPick,
  onOther,
  disabled,
}: ScoreQuickPickProps) {
  const min = Math.max(1, par - 3);
  const values: number[] = [];
  for (let v = min; v <= par + 4; v += 1) values.push(v);

  return (
    <View className="flex-row flex-wrap gap-sm">
      {values.map((value) => {
        const diff = value - par;
        const isSelected = selected === value;
        const isPar = diff === 0;
        return (
          <Pressable
            key={value}
            testID={`live-quickpick-${value}`}
            accessibilityRole="button"
            accessibilityLabel={`${value} strokes (${scoreDiffLabel(diff)})`}
            accessibilityState={{ selected: isSelected, disabled }}
            disabled={disabled}
            onPress={() => onPick(value)}
            // 4-column grid: (100% − 3 gaps) / 4 ≈ 23%.
            style={{ flexBasis: "23%", flexGrow: 1 }}
            className={cn(
              "items-center justify-center rounded-lg py-md active:opacity-80",
              isSelected
                ? scoreDiffTintClass(diff)
                : isPar
                  ? "border-2 border-primary bg-card"
                  : "border border-border bg-card",
            )}
          >
            <Text
              className={cn(
                "text-figure-lg",
                isSelected ? scoreDiffTextClass(diff) : "text-foreground",
              )}
            >
              {value}
            </Text>
            <Text
              className={cn(
                "text-label-sm",
                isSelected
                  ? scoreDiffTextClass(diff)
                  : "text-muted-foreground",
              )}
            >
              {scoreDiffLabel(diff)}
            </Text>
          </Pressable>
        );
      })}
      <Pressable
        testID="live-quickpick-other"
        accessibilityRole="button"
        accessibilityLabel="Other score"
        disabled={disabled}
        onPress={onOther}
        style={{ flexBasis: "23%", flexGrow: 1 }}
        className={cn(
          "items-center justify-center rounded-lg py-md active:opacity-80",
          "border border-dashed border-border bg-card",
          selected !== null && selected > par + 4
            ? scoreDiffTintClass(selected - par)
            : undefined,
        )}
      >
        <Text className="text-figure-lg text-muted-foreground">
          {selected !== null && selected > par + 4 ? selected : "9+"}
        </Text>
        <Text className="text-label-sm text-muted-foreground">Other</Text>
      </Pressable>
    </View>
  );
}
