/**
 * Native ScorecardTable — mirror of web's MOBILE scorecard layout (the
 * phone reference): tee info banner, the one-hole-at-a-time entry pager
 * (plan 013 D1 — replaces the old HOLE/PAR/HCP/SCORE grid and its inline
 * detail strip), and OUT/IN/TOTAL summary rows.
 */
import { Text, View } from "react-native";

import { HoleEntryPager } from "@/components/scorecard/hole-entry-pager";
import type { HoleDetailValue } from "@/lib/hole-detail";
import type { Hole, ScoreInput, Tee } from "@/lib/scorecard";

/** Shot-level detail fields a hole can edit (plans/010). */
export type ScoreDetail = HoleDetailValue;

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
  const calculateTotal = (start: number, end: number) =>
    scores.slice(start, end).reduce((sum, score) => sum + score.strokes, 0);

  const summaryRow = (label: string, par: number, total: number) => (
    <View className="flex-row border-t border-border bg-accent">
      <View className="flex-1 py-sm items-center">
        <Text className="text-label-sm text-secondary-foreground">{label}</Text>
      </View>
      <View className="flex-1 py-sm items-center">
        <Text className="text-label-sm text-secondary-foreground">
          Par {par}
        </Text>
      </View>
      <View className="flex-1 py-sm items-center">
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

      {/* One-hole-at-a-time entry (plan 013 D1) */}
      <HoleEntryPager
        selectedTee={selectedTee}
        displayedHoles={displayedHoles}
        holeCount={holeCount}
        scores={scores}
        onScoreChange={onScoreChange}
        disabled={disabled}
        detailedScoring={detailedScoring}
        onScoreDetailChange={onScoreDetailChange}
      />

      {/* Score summary */}
      <View className="rounded-lg border border-border overflow-hidden">
        {holeCount === 18 ? (
          <>
            {summaryRow("OUT", outPar, calculateTotal(0, 9))}
            {summaryRow("IN", inPar, calculateTotal(9, 18))}
            {summaryRow("TOTAL", outPar + inPar, calculateTotal(0, 18))}
          </>
        ) : (
          summaryRow("TOTAL", outPar, calculateTotal(0, 9))
        )}
      </View>
    </View>
  );
}
