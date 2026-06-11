/**
 * Native TeeFormSection — mirror of apps/web/components/scorecard/
 * tee-form-content.tsx minus the AI scorecard upload (still deferred):
 * tee info, course/slope ratings with the same auto-sum behavior, the
 * 18-hole par/hcp/distance entry (transposed to vertical rows — the
 * native table idiom, web scrolls the same data horizontally), and the
 * validity badge + grouped issue list.
 */
import { TriangleAlert } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";

import type { Tee } from "@handicappin/handicap-core";
import { tokens } from "@handicappin/tokens/tokens";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getTeeValidationErrors } from "@/lib/scorecard-form";
import { useColorMode } from "@/lib/color-mode";
import { cn } from "@/lib/utils";

const ICON_SIZE = 16; // allow-hardcoded lucide icon prop mirrors web's fixed h-4 w-4 icon box

interface TeeFormSectionProps {
  tee: Tee;
  onTeeChange: (updated: Tee) => void;
}

/**
 * Numeric input that buffers its text locally so partial entries ("39.")
 * survive the re-render, emitting parsed numbers upward. Resyncs from the
 * prop when an auto-sum writes a different value externally.
 */
function NumericField({
  value,
  onValue,
  decimal,
  placeholder,
  testID,
  className,
}: {
  value: number;
  onValue: (next: number) => void;
  decimal?: boolean;
  placeholder?: string;
  testID?: string;
  className?: string;
}) {
  const [draft, setDraft] = useState(value === 0 ? "" : String(value));

  useEffect(() => {
    const parsed = decimal ? parseFloat(draft) : parseInt(draft, 10);
    const drafted = Number.isNaN(parsed) ? 0 : parsed;
    if (drafted !== value) {
      setDraft(value === 0 ? "" : String(value));
    }
    // Resync only when the upstream value diverges from the draft.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <Input
      testID={testID}
      keyboardType={decimal ? "decimal-pad" : "number-pad"}
      placeholder={placeholder}
      className={cn("h-9", className)}
      textAlign="center"
      value={draft}
      onChangeText={(text) => {
        setDraft(text);
        const parsed = decimal ? parseFloat(text) : parseInt(text, 10);
        onValue(Number.isNaN(parsed) ? 0 : parsed);
      }}
    />
  );
}

function SegmentedPair<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <View className="flex-row gap-sm">
      {options.map((option) => (
        <Button
          key={option.value}
          variant={value === option.value ? "default" : "outline"}
          size="sm"
          className="flex-1"
          onPress={() => onChange(option.value)}
        >
          {option.label}
        </Button>
      ))}
    </View>
  );
}

const normalizedHoles = (tee: Tee) => {
  const existing = tee.holes ?? [];
  if (existing.length === 18) return existing;
  return Array.from({ length: 18 }, (_, index) => ({
    id: existing[index]?.id,
    teeId: existing[index]?.teeId,
    holeNumber: index + 1,
    par: existing[index]?.par ?? 0,
    hcp: existing[index]?.hcp ?? 0,
    distance: existing[index]?.distance ?? 0,
  }));
};

export function TeeFormSection({ tee, onTeeChange }: TeeFormSectionProps) {
  const mode = useColorMode();
  const validationErrors = getTeeValidationErrors(tee);
  const isValid = validationErrors.length === 0;
  const holes = normalizedHoles(tee);

  // Rating handlers mirror web's auto-sum semantics exactly.
  const setFront9Rating = (val: number) =>
    onTeeChange({
      ...tee,
      courseRatingFront9: val,
      courseRating18: val + (tee.courseRatingBack9 || 0),
    });
  const setBack9Rating = (val: number) =>
    onTeeChange({
      ...tee,
      courseRatingBack9: val,
      courseRating18: val + (tee.courseRatingFront9 || 0),
    });
  const setTotalRating = (val: number) =>
    onTeeChange({
      ...tee,
      courseRating18: val,
      courseRatingFront9: val / 2,
      courseRatingBack9: val / 2,
    });
  const setFront9Slope = (val: number) =>
    onTeeChange({
      ...tee,
      slopeRatingFront9: val,
      slopeRating18: Math.ceil((val + (tee.slopeRatingBack9 || 0)) / 2),
    });
  const setBack9Slope = (val: number) =>
    onTeeChange({
      ...tee,
      slopeRatingBack9: val,
      slopeRating18: Math.ceil(((tee.slopeRatingFront9 || 0) + val) / 2),
    });
  const setTotalSlope = (val: number) =>
    onTeeChange({
      ...tee,
      slopeRating18: val,
      slopeRatingFront9: val,
      slopeRatingBack9: val,
    });

  const setHole = (
    index: number,
    patch: Partial<{ par: number; hcp: number; distance: number }>,
  ) => {
    const nextHoles = holes.map((hole, i) =>
      i === index ? { ...hole, ...patch, holeNumber: index + 1 } : hole,
    );
    const sum = (
      slice: typeof nextHoles,
      key: "par" | "distance",
    ): number => slice.reduce((acc, hole) => acc + (hole[key] || 0), 0);
    const next: Tee = { ...tee, holes: nextHoles };
    if (patch.distance !== undefined) {
      next.outDistance = sum(nextHoles.slice(0, 9), "distance");
      next.inDistance = sum(nextHoles.slice(9, 18), "distance");
      next.totalDistance = next.outDistance + next.inDistance;
    }
    if (patch.par !== undefined) {
      next.outPar = sum(nextHoles.slice(0, 9), "par");
      next.inPar = sum(nextHoles.slice(9, 18), "par");
      next.totalPar = next.outPar + next.inPar;
    }
    onTeeChange(next);
  };

  return (
    <View className="gap-lg">
      <Alert>
        <View className="flex-row items-center gap-sm mb-xs">
          <TriangleAlert
            size={ICON_SIZE}
            color={tokens.colors[mode].foreground}
          />
          <AlertTitle>Heads up!</AlertTitle>
        </View>
        <AlertDescription>
          Enter 18 hole values for the new tee even if you are adding a tee
          for a 9-hole course. You can choose to enter a 9-hole round on this
          tee when you submit your scorecard. The course pro shop can help
          you find the correct information.
        </AlertDescription>
      </Alert>

      {/* Tee information */}
      <View className="gap-md">
        <Text className="text-body font-semibold text-foreground">
          Tee Information
        </Text>
        <View className="gap-sm">
          <Label>Name</Label>
          <Input
            testID="tee-name-input"
            placeholder="e.g., RED"
            autoCapitalize="characters"
            value={tee.name}
            onChangeText={(text) => onTeeChange({ ...tee, name: text })}
          />
        </View>
        <View className="gap-sm">
          <Label>Distance Measurement</Label>
          <SegmentedPair
            options={
              [
                { value: "meters", label: "meters" },
                { value: "yards", label: "yards" },
              ] as const
            }
            value={tee.distanceMeasurement}
            onChange={(value) =>
              onTeeChange({ ...tee, distanceMeasurement: value })
            }
          />
        </View>
        <View className="gap-sm">
          <Label>Men&apos;s/Ladies</Label>
          <SegmentedPair
            options={
              [
                { value: "mens", label: "mens" },
                { value: "ladies", label: "ladies" },
              ] as const
            }
            value={tee.gender}
            onChange={(value) => onTeeChange({ ...tee, gender: value })}
          />
        </View>
      </View>

      {/* Course rating */}
      <View className="gap-md">
        <Text className="text-body font-semibold text-foreground">
          Course Rating
        </Text>
        <View className="flex-row gap-sm">
          <View className="flex-1 gap-xs">
            <Label className="text-meta">Front 9</Label>
            <NumericField
              testID="rating-front9"
              decimal
              placeholder="39.5"
              value={tee.courseRatingFront9}
              onValue={setFront9Rating}
            />
          </View>
          <View className="flex-1 gap-xs">
            <Label className="text-meta">Back 9</Label>
            <NumericField
              testID="rating-back9"
              decimal
              placeholder="40.3"
              value={tee.courseRatingBack9}
              onValue={setBack9Rating}
            />
          </View>
          <View className="flex-1 gap-xs">
            <Label className="text-meta">Total</Label>
            <NumericField
              testID="rating-total"
              decimal
              placeholder="79.8"
              value={tee.courseRating18}
              onValue={setTotalRating}
            />
          </View>
        </View>

        <Text className="text-body font-semibold text-foreground">
          Slope Rating
        </Text>
        <View className="flex-row gap-sm">
          <View className="flex-1 gap-xs">
            <Label className="text-meta">Front 9</Label>
            <NumericField
              testID="slope-front9"
              placeholder="147"
              value={tee.slopeRatingFront9}
              onValue={setFront9Slope}
            />
          </View>
          <View className="flex-1 gap-xs">
            <Label className="text-meta">Back 9</Label>
            <NumericField
              testID="slope-back9"
              placeholder="149"
              value={tee.slopeRatingBack9}
              onValue={setBack9Slope}
            />
          </View>
          <View className="flex-1 gap-xs">
            <Label className="text-meta">Total</Label>
            <NumericField
              testID="slope-total"
              placeholder="148"
              value={tee.slopeRating18}
              onValue={setTotalSlope}
            />
          </View>
        </View>
      </View>

      {/* Hole information — vertical rows (native table idiom) */}
      <View className="gap-md">
        <Text className="text-body font-semibold text-foreground">
          Hole Information
        </Text>
        <View className="rounded-lg border border-border overflow-hidden">
          <View className="flex-row">
            {["HOLE", "DISTANCE", "PAR", "HCP"].map((label, i) => (
              <View
                key={label}
                className={cn(
                  "bg-accent py-sm items-center justify-center",
                  i === 0 ? "flex-[0.6]" : "flex-1",
                )}
              >
                <Text className="text-label-sm text-secondary-foreground">
                  {label}
                </Text>
              </View>
            ))}
          </View>
          {holes.map((hole, index) => (
            <View key={index} className="flex-row border-t border-border">
              <View className="flex-[0.6] py-sm items-center justify-center bg-accent">
                <Text className="text-body-sm text-secondary-foreground font-medium">
                  {index + 1}
                </Text>
              </View>
              <View className="flex-1 p-xs items-center justify-center">
                <NumericField
                  testID={`hole-distance-${index + 1}`}
                  className="w-full"
                  value={hole.distance}
                  onValue={(val) => setHole(index, { distance: val })}
                />
              </View>
              <View className="flex-1 p-xs items-center justify-center">
                <NumericField
                  testID={`hole-par-${index + 1}`}
                  className="w-full"
                  value={hole.par}
                  onValue={(val) => setHole(index, { par: val })}
                />
              </View>
              <View className="flex-1 p-xs items-center justify-center">
                <NumericField
                  testID={`hole-hcp-${index + 1}`}
                  className="w-full"
                  value={hole.hcp}
                  onValue={(val) => setHole(index, { hcp: val })}
                />
              </View>
            </View>
          ))}
          {(
            [
              ["OUT", tee.outDistance, tee.outPar],
              ["IN", tee.inDistance, tee.inPar],
              ["TOTAL", tee.totalDistance, tee.totalPar],
            ] as const
          ).map(([label, distance, par]) => (
            <View
              key={label}
              className="flex-row border-t border-border bg-accent"
            >
              <View className="flex-[0.6] py-sm items-center justify-center">
                <Text className="text-label-sm text-secondary-foreground">
                  {label}
                </Text>
              </View>
              <View className="flex-1 py-sm items-center justify-center">
                <Text className="text-label-sm text-secondary-foreground">
                  {distance || "—"}
                </Text>
              </View>
              <View className="flex-1 py-sm items-center justify-center">
                <Text className="text-label-sm text-secondary-foreground">
                  {par || "—"}
                </Text>
              </View>
              <View className="flex-1 py-sm items-center justify-center">
                <Text className="text-label-sm text-secondary-foreground">
                  N/A
                </Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* Validity summary */}
      <View className="gap-sm">
        <View className="flex-row items-center gap-sm">
          <Badge variant={isValid ? "default" : "destructive"}>
            {isValid ? "✓ Valid" : "⚠ Incomplete"}
          </Badge>
          {!isValid ? (
            <Text className="text-body-sm text-muted-foreground">
              {validationErrors.length} issue
              {validationErrors.length !== 1 ? "s" : ""} to fix
            </Text>
          ) : null}
        </View>
        {validationErrors.length > 0 ? (
          <Alert variant="destructive">
            <AlertTitle>Validation Issues</AlertTitle>
            <View className="mt-sm gap-xs">
              {validationErrors.map((error, index) => (
                <AlertDescription key={index}>• {error}</AlertDescription>
              ))}
            </View>
          </Alert>
        ) : null}
      </View>
    </View>
  );
}
