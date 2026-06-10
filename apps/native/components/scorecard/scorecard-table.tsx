/**
 * Native ScorecardTable — mirror of web's MOBILE table variant (the phone
 * reference): tee info banner, then HOLE/PAR/HCP/SCORE rows with numeric
 * inputs, auto-advance, and OUT/IN/TOTAL summary rows.
 */
import { useRef } from "react";
import { Text, TextInput, View } from "react-native";

import { Input } from "@/components/ui/input";
import type { Hole, Score, Tee } from "@/lib/scorecard";
import { cn } from "@/lib/utils";

const MAX_SCORE_LENGTH = 2;
const MIN_SCORE = 0;

interface ScorecardTableProps {
  selectedTee: Tee | undefined;
  displayedHoles: Hole[];
  holeCount: number;
  scores: Score[];
  onScoreChange: (holeIndex: number, score: number) => void;
  disabled: boolean;
}

function HeaderCell({ label, wide }: { label: string; wide?: boolean }) {
  return (
    <View className={cn("bg-accent py-sm items-center", wide ? "flex-[1.5]" : "flex-1")}>
      <Text className="text-label-sm text-secondary-foreground">{label}</Text>
    </View>
  );
}

export function ScorecardTable({
  selectedTee,
  displayedHoles,
  holeCount,
  scores,
  onScoreChange,
  disabled,
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
          <View key={i} className="flex-row border-t border-border items-center">
            <View className="flex-1 py-sm items-center bg-accent">
              <Text className="text-body-sm text-secondary-foreground font-medium">
                {i + 1}
              </Text>
            </View>
            <View className="flex-1 py-sm items-center">
              <Text className="text-body-sm text-foreground">{hole.par}</Text>
            </View>
            <View className="flex-1 py-sm items-center">
              <Text className="text-body-sm text-foreground">{hole.hcp}</Text>
            </View>
            <View className="flex-[1.5] p-xs items-center">
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
