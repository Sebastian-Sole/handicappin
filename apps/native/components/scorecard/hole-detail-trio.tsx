/**
 * The Putts / Fairway / Penalties trio (plan 013 D7) — native mirror of
 * apps/web/components/scorecard/hole-detail-trio.tsx. Two modes:
 *  - "editable": steppers + segmented fairway, for the one-hole-at-a-time
 *    logging UI (post-round and live).
 *  - "static": read-only chips, for the saved-round viewer accordion.
 */
import { Minus, Plus } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";

import { tokens } from "@handicappin/tokens/tokens";

import { useColorMode } from "@/lib/color-mode";
import {
  fairwayGlyph,
  fairwayLabel,
  maxPenaltiesForStrokes,
  maxPuttsForStrokes,
  stepDetailCount,
  toggleFairway,
  type HoleDetailValue,
} from "@/lib/hole-detail";
import { cn } from "@/lib/utils";

export type { HoleDetailValue };

interface HoleDetailTrioProps {
  mode: "editable" | "static";
  holeNumber: number;
  par: number;
  value: HoleDetailValue;
  /**
   * Editable mode: the hole's current strokes — caps the steppers so
   * putts + penalties never exceed strokes − 1 (null/unset = uncapped).
   */
  strokes?: number | null;
  disabled?: boolean;
  /** Editable mode: emits a patch for the changed field (undefined clears). */
  onChange?: (detail: HoleDetailValue) => void;
}

const STEP_ICON_SIZE = 16; // allow-hardcoded lucide icon prop inside the 44px stepper buttons

function CountStepper({
  label,
  fieldLabel,
  testIdBase,
  holeNumber,
  value,
  max,
  disabled,
  onStep,
}: {
  label: string;
  fieldLabel: string;
  testIdBase: string;
  holeNumber: number;
  value: number | null | undefined;
  max: number;
  disabled?: boolean;
  onStep: (next: number | undefined) => void;
}) {
  const mode = useColorMode();
  const foreground = tokens.colors[mode].foreground;
  const minusDisabled = disabled || value == null;
  const plusDisabled = disabled || (value ?? 0) >= max;
  return (
    <View className="flex-row items-center overflow-hidden rounded-md border border-border">
      <Pressable
        testID={`${testIdBase}-minus-${holeNumber}`}
        accessibilityRole="button"
        accessibilityLabel={`One less ${fieldLabel} for hole ${holeNumber}`}
        disabled={minusDisabled}
        onPress={() => onStep(stepDetailCount(value, -1, max))}
        className={cn(
          "h-10 w-11 items-center justify-center bg-muted active:opacity-80",
          minusDisabled && "opacity-40",
        )}
      >
        <Minus size={STEP_ICON_SIZE} color={foreground} />
      </Pressable>
      <Text
        testID={`${testIdBase}-value-${holeNumber}`}
        accessibilityLabel={`${label} for hole ${holeNumber}: ${value ?? "not set"}`}
        className="flex-1 text-center text-body font-medium text-foreground"
      >
        {value ?? "–"}
      </Text>
      <Pressable
        testID={`${testIdBase}-plus-${holeNumber}`}
        accessibilityRole="button"
        accessibilityLabel={`One more ${fieldLabel} for hole ${holeNumber}`}
        disabled={plusDisabled}
        onPress={() => onStep(stepDetailCount(value, 1, max))}
        className={cn(
          "h-10 w-11 items-center justify-center bg-muted active:opacity-80",
          plusDisabled && "opacity-40",
        )}
      >
        <Plus size={STEP_ICON_SIZE} color={foreground} />
      </Pressable>
    </View>
  );
}

function FairwaySegment({
  holeNumber,
  par,
  value,
  disabled,
  onChange,
}: {
  holeNumber: number;
  par: number;
  value: boolean | null | undefined;
  disabled?: boolean;
  onChange: (next: boolean | undefined) => void;
}) {
  if (par === 3) {
    return (
      <View
        accessibilityLabel={`Fairway hole ${holeNumber}: not applicable (par 3)`}
        className="h-10 items-center justify-center rounded-md border border-dashed border-border"
      >
        <Text className="text-body-sm text-muted-foreground">N/A (par 3)</Text>
      </View>
    );
  }
  return (
    <View className="flex-row gap-sm">
      <Pressable
        testID={`fairway-hit-${holeNumber}`}
        accessibilityRole="button"
        accessibilityState={{ selected: value === true }}
        accessibilityLabel={`Fairway hit, hole ${holeNumber}: ${fairwayLabel(value, false)}`}
        disabled={disabled}
        onPress={() => onChange(toggleFairway(value, "hit"))}
        className={cn(
          "h-10 flex-1 items-center justify-center rounded-md border border-border active:opacity-80",
          value === true && "border-success bg-success",
          disabled && "opacity-40",
        )}
      >
        <Text
          className={cn(
            "text-label-sm",
            value === true ? "text-success-foreground" : "text-muted-foreground",
          )}
        >
          Hit
        </Text>
      </Pressable>
      <Pressable
        testID={`fairway-miss-${holeNumber}`}
        accessibilityRole="button"
        accessibilityState={{ selected: value === false }}
        accessibilityLabel={`Fairway missed, hole ${holeNumber}: ${fairwayLabel(value, false)}`}
        disabled={disabled}
        onPress={() => onChange(toggleFairway(value, "miss"))}
        className={cn(
          "h-10 flex-1 items-center justify-center rounded-md border border-border active:opacity-80",
          value === false && "border-destructive bg-destructive",
          disabled && "opacity-40",
        )}
      >
        <Text
          className={cn(
            "text-label-sm",
            value === false
              ? "text-destructive-foreground"
              : "text-muted-foreground",
          )}
        >
          Miss
        </Text>
      </Pressable>
    </View>
  );
}

function StaticChip({
  label,
  valueText,
  valueClass,
}: {
  label: string;
  valueText: string;
  valueClass?: string;
}) {
  return (
    <View className="flex-1 items-center rounded-md border border-border bg-background-alternate px-sm py-sm">
      <Text className="text-meta text-muted-foreground">{label}</Text>
      <Text className={cn("text-body font-medium text-foreground", valueClass)}>
        {valueText}
      </Text>
    </View>
  );
}

export function HoleDetailTrio({
  mode,
  holeNumber,
  par,
  value,
  strokes,
  disabled,
  onChange,
}: HoleDetailTrioProps) {
  if (mode === "static") {
    const penalties = value.penaltyStrokes;
    return (
      <View className="flex-row gap-sm" testID={`hole-detail-static-${holeNumber}`}>
        <StaticChip label="Putts" valueText={String(value.putts ?? "–")} />
        <StaticChip
          label="Fairway"
          valueText={fairwayGlyph(value.fairwayHit, par === 3)}
          valueClass={cn(
            par === 3 || value.fairwayHit == null
              ? "text-muted-foreground"
              : value.fairwayHit
                ? "text-success"
                : "text-destructive",
          )}
        />
        <StaticChip
          label="Penalties"
          valueText={String(penalties ?? "–")}
          valueClass={cn(penalties != null && penalties > 0 && "text-warning")}
        />
      </View>
    );
  }

  return (
    <View className="gap-sm" testID={`hole-detail-editable-${holeNumber}`}>
      <View className="flex-row items-center gap-sm">
        <Text className="w-20 text-label-sm text-muted-foreground">Putts</Text>
        <View className="flex-1">
          <CountStepper
            label="Putts"
            fieldLabel="putt"
            testIdBase="putts"
            holeNumber={holeNumber}
            value={value.putts}
            max={maxPuttsForStrokes(strokes, value.penaltyStrokes)}
            disabled={disabled}
            onStep={(putts) => onChange?.({ putts })}
          />
        </View>
      </View>
      <View className="flex-row items-center gap-sm">
        <Text className="w-20 text-label-sm text-muted-foreground">Fairway</Text>
        <View className="flex-1">
          <FairwaySegment
            holeNumber={holeNumber}
            par={par}
            value={value.fairwayHit}
            disabled={disabled}
            onChange={(fairwayHit) => onChange?.({ fairwayHit })}
          />
        </View>
      </View>
      <View className="flex-row items-center gap-sm">
        <Text className="w-20 text-label-sm text-muted-foreground">
          Penalties
        </Text>
        <View className="flex-1">
          <CountStepper
            label="Penalties"
            fieldLabel="penalty stroke"
            testIdBase="penalty"
            holeNumber={holeNumber}
            value={value.penaltyStrokes}
            max={maxPenaltiesForStrokes(strokes, value.putts)}
            disabled={disabled}
            onStep={(penaltyStrokes) => onChange?.({ penaltyStrokes })}
          />
        </View>
      </View>
    </View>
  );
}
