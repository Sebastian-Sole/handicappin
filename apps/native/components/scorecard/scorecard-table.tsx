/**
 * Native ScorecardTable — mirror of web's MOBILE table variant (the phone
 * reference): tee info banner, then HOLE/PAR/HCP/SCORE rows with numeric
 * inputs, auto-advance, and OUT/IN/TOTAL summary rows. When "Detailed
 * scoring" is on (plans/010), each hole gains a Putts / Fairway / Penalties
 * detail row — same controls as web: numeric putts, tri-state fairway
 * (– → ✓ → ✗, disabled on par 3s), penalties hidden behind a "+".
 */
import { Fragment, useRef } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import { Input } from "@/components/ui/input";
import type { Hole, Tee } from "@/lib/scorecard";
import type { ScoreInput } from "@/lib/scorecard";
import { cn } from "@/lib/utils";

const MAX_SCORE_LENGTH = 2;
const MIN_SCORE = 0;
const MAX_PUTTS = 20;
const MAX_PENALTIES = 10;

/** Shot-level detail fields a hole row can edit (plans/010). */
export type ScoreDetail = Partial<
  Pick<ScoreInput, "putts" | "fairwayHit" | "penaltyStrokes">
>;

interface ScorecardTableProps {
  selectedTee: Tee | undefined;
  displayedHoles: Hole[];
  holeCount: number;
  scores: ScoreInput[];
  onScoreChange: (holeIndex: number, score: number) => void;
  disabled: boolean;
  /** "Detailed scoring" mode: expose putts/fairway/penalties per hole. */
  detailedScoring?: boolean;
  onScoreDetailChange?: (holeIndex: number, detail: ScoreDetail) => void;
}

function HeaderCell({ label, wide }: { label: string; wide?: boolean }) {
  return (
    <View className={cn("bg-accent py-sm items-center", wide ? "flex-[1.5]" : "flex-1")}>
      <Text className="text-label-sm text-secondary-foreground">{label}</Text>
    </View>
  );
}

/** Parse a bounded optional integer from a text input ("" clears it). */
function parseDetailValue(raw: string, max: number): number | undefined {
  if (raw === "") return undefined;
  const parsed = parseInt(raw, 10);
  if (Number.isNaN(parsed)) return undefined;
  return Math.min(Math.max(parsed, 0), max);
}

/**
 * Tri-state fairway control: – (not set) → ✓ (hit) → ✗ (missed) → –.
 * Par-3 holes have no fairway; the control is disabled there.
 */
function FairwayCycle({
  value,
  holeNumber,
  par,
  disabled,
  onChange,
}: {
  value: boolean | null | undefined;
  holeNumber: number;
  par: number;
  disabled: boolean;
  onChange: (next: boolean | undefined) => void;
}) {
  const isPar3 = par === 3;
  const stateLabel =
    value === true ? "hit" : value === false ? "missed" : "not set";
  const next = value === true ? false : value === false ? undefined : true;
  return (
    <Pressable
      testID={`fairway-toggle-${holeNumber}`}
      accessibilityRole="button"
      accessibilityLabel={
        isPar3
          ? `Fairway hole ${holeNumber}: not applicable (par 3)`
          : `Fairway hole ${holeNumber}: ${stateLabel}. Activate to change`
      }
      disabled={disabled || isPar3}
      onPress={() => onChange(next)}
      className={cn(
        "h-9 items-center justify-center rounded-md border border-border bg-background active:opacity-80",
        (disabled || isPar3) && "opacity-50",
      )}
    >
      <Text
        className={cn(
          "text-body-sm text-muted-foreground",
          value === true && "text-success",
          value === false && "text-destructive",
        )}
      >
        {isPar3 ? "·" : value === true ? "✓" : value === false ? "✗" : "–"}
      </Text>
    </Pressable>
  );
}

/** Penalties stay hidden behind a "+" until the golfer had any (default 0). */
function PenaltyControl({
  value,
  holeNumber,
  disabled,
  onChange,
}: {
  value: number | null | undefined;
  holeNumber: number;
  disabled: boolean;
  onChange: (next: number | undefined) => void;
}) {
  if (value == null) {
    return (
      <Pressable
        testID={`penalty-add-${holeNumber}`}
        accessibilityRole="button"
        accessibilityLabel={`Add penalty strokes for hole ${holeNumber}`}
        disabled={disabled}
        onPress={() => onChange(0)}
        className={cn(
          "h-9 items-center justify-center rounded-md active:opacity-80",
          disabled && "opacity-50",
        )}
      >
        <Text className="text-body-sm text-muted-foreground">+</Text>
      </Pressable>
    );
  }
  return (
    <Input
      testID={`penalty-input-${holeNumber}`}
      accessibilityLabel={`Penalty strokes for hole ${holeNumber}`}
      keyboardType="number-pad"
      editable={!disabled}
      textAlign="center"
      className="h-9 w-full"
      value={String(value)}
      onChangeText={(raw) => onChange(parseDetailValue(raw, MAX_PENALTIES) ?? 0)}
    />
  );
}

export function ScorecardTable({
  selectedTee,
  displayedHoles,
  holeCount,
  scores,
  onScoreChange,
  disabled,
  detailedScoring = false,
  onScoreDetailChange,
}: ScorecardTableProps) {
  const inputRefs = useRef<(TextInput | null)[]>([]);

  const calculateTotal = (start: number, end: number) =>
    scores.slice(start, end).reduce((sum, score) => sum + score.strokes, 0);

  const handleScoreInput = (value: string, holeIndex: number) => {
    if (value.length > MAX_SCORE_LENGTH) return;
    let parsed = parseInt(value, 10) || 0;
    if (parsed < MIN_SCORE) parsed = MIN_SCORE;
    onScoreChange(holeIndex, parsed);

    const shouldAutoAdvance =
      (value.length === 1 && parsed >= 2 && parsed <= 9) || value.length === 2;
    if (shouldAutoAdvance && holeIndex < displayedHoles.length - 1) {
      inputRefs.current[holeIndex + 1]?.focus();
    }
  };

  const handleDetailChange = (holeIndex: number, detail: ScoreDetail) => {
    onScoreDetailChange?.(holeIndex, detail);
  };

  const summaryRow = (label: string, par: number, total: number) => (
    <View className="flex-row border-t border-border bg-accent">
      <View className="flex-1 py-sm items-center">
        <Text className="text-label-sm text-secondary-foreground">{label}</Text>
      </View>
      <View className="flex-1 py-sm items-center">
        <Text className="text-label-sm text-secondary-foreground">{par}</Text>
      </View>
      <View className="flex-1 py-sm items-center">
        <Text className="text-label-sm text-secondary-foreground"> </Text>
      </View>
      <View className="flex-[1.5] py-sm items-center">
        <Text className="text-label-sm text-secondary-foreground">
          {total > 0 ? total : "—"}
        </Text>
      </View>
    </View>
  );

  const outPar = displayedHoles
    .slice(0, 9)
    .reduce((sum, hole) => sum + hole.par, 0);
  const inPar = displayedHoles
    .slice(9, 18)
    .reduce((sum, hole) => sum + hole.par, 0);

  return (
    <View className="gap-sm" testID="scorecard-table">
      {/* Tee info banner */}
      <View className="rounded-lg bg-accent p-sm border border-border">
        <Text className="text-label-sm text-secondary-foreground mb-sm">
          {selectedTee?.name.toUpperCase()} TEE
        </Text>
        <View className="flex-row justify-between">
          <View className="flex-row gap-sm">
            <Text className="text-body-sm text-secondary-foreground">
              Total Distance:
            </Text>
            <Text className="text-body-sm text-foreground font-medium">
              {holeCount === 18
                ? selectedTee?.totalDistance
                : selectedTee?.outDistance}
            </Text>
          </View>
          <View className="flex-row gap-sm">
            <Text className="text-body-sm text-secondary-foreground">
              Total Par:
            </Text>
            <Text className="text-body-sm text-foreground font-medium">
              {holeCount === 18 ? selectedTee?.totalPar : selectedTee?.outPar}
            </Text>
          </View>
        </View>
      </View>

      {/* Score rows */}
      <View className="rounded-lg border border-border overflow-hidden">
        <View className="flex-row">
          <HeaderCell label="HOLE" />
          <HeaderCell label="PAR" />
          <HeaderCell label="HCP" />
          <HeaderCell label="SCORE" wide />
        </View>
        {displayedHoles.map((hole, i) => (
          // Cells stretch to the row height (the SCORE input is the tallest)
          // and center their own content — items-center on the ROW would
          // shrink-wrap each cell and leave background gaps in the HOLE strip.
          <Fragment key={i}>
            <View className="flex-row border-t border-border">
              <View className="flex-1 py-sm items-center justify-center bg-accent">
                <Text className="text-body-sm text-secondary-foreground font-medium">
                  {i + 1}
                </Text>
              </View>
              <View className="flex-1 py-sm items-center justify-center">
                <Text className="text-body-sm text-foreground">{hole.par}</Text>
              </View>
              <View className="flex-1 py-sm items-center justify-center">
                <Text className="text-body-sm text-foreground">{hole.hcp}</Text>
              </View>
              <View className="flex-[1.5] p-xs items-center justify-center">
                <Input
                  ref={(el) => {
                    inputRefs.current[i] = el;
                  }}
                  testID={`score-input-${i + 1}`}
                  accessibilityLabel={`Score for hole ${i + 1}`}
                  keyboardType="number-pad"
                  editable={!disabled}
                  textAlign="center"
                  className="h-9 w-16"
                  value={
                    scores[i] && scores[i].strokes > 0
                      ? String(scores[i].strokes)
                      : ""
                  }
                  onChangeText={(value) => handleScoreInput(value, i)}
                />
              </View>
            </View>
            {/* Detailed scoring row (plans/010) */}
            {detailedScoring ? (
              <View className="flex-row border-t border-border bg-background p-sm gap-sm">
                <View className="flex-1 gap-xs">
                  <Text className="text-meta text-muted-foreground text-center">
                    Putts
                  </Text>
                  <Input
                    testID={`putts-input-${i + 1}`}
                    accessibilityLabel={`Putts for hole ${i + 1}`}
                    keyboardType="number-pad"
                    editable={!disabled}
                    textAlign="center"
                    className="h-9 w-full"
                    value={scores[i]?.putts != null ? String(scores[i].putts) : ""}
                    onChangeText={(raw) =>
                      handleDetailChange(i, {
                        putts: parseDetailValue(raw, MAX_PUTTS),
                      })
                    }
                  />
                </View>
                <View className="flex-1 gap-xs">
                  <Text className="text-meta text-muted-foreground text-center">
                    Fairway
                  </Text>
                  <FairwayCycle
                    value={scores[i]?.fairwayHit}
                    holeNumber={i + 1}
                    par={hole.par}
                    disabled={disabled}
                    onChange={(next) =>
                      handleDetailChange(i, { fairwayHit: next })
                    }
                  />
                </View>
                <View className="flex-1 gap-xs">
                  <Text className="text-meta text-muted-foreground text-center">
                    Penalties
                  </Text>
                  <PenaltyControl
                    value={scores[i]?.penaltyStrokes}
                    holeNumber={i + 1}
                    disabled={disabled}
                    onChange={(next) =>
                      handleDetailChange(i, { penaltyStrokes: next })
                    }
                  />
                </View>
              </View>
            ) : null}
          </Fragment>
        ))}
        {holeCount === 18 ? (
          <>
            {summaryRow("OUT", outPar, calculateTotal(0, 9))}
            {summaryRow("IN", inPar, calculateTotal(9, 18))}
            {summaryRow(
              "TOTAL",
              outPar + inPar,
              calculateTotal(0, 18),
            )}
          </>
        ) : (
          summaryRow("TOTAL", outPar, calculateTotal(0, 9))
        )}
      </View>
    </View>
  );
}
