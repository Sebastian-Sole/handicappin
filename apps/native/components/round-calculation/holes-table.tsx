/**
 * Native HolesTable — mirror of apps/web/components/round/calculation/
 * holesTable.tsx (Hole/Par/Strokes/HCP/Adj columns, unplayed holes muted,
 * totals row on secondary). Web's Adj tooltip becomes a caption line.
 */
import { Text, View } from "react-native";

import {
  calculateHoleAdjustedScore,
  type Hole,
  type Score,
} from "@handicappin/handicap-core";

import type { ScorecardWithRound } from "@/lib/api/schemas/scorecard";
import { cn } from "@/lib/utils";

interface HolesTableProps {
  scorecard: ScorecardWithRound;
  hasEstablishedHandicap: boolean;
  isNineHoles: boolean;
  nineHoleSection: "front" | "back";
}

const CELL = "flex-1 py-sm px-sm";

function Row({
  cells,
  muted,
  header,
  totals,
}: {
  cells: (string | number)[];
  muted?: boolean;
  header?: boolean;
  totals?: boolean;
}) {
  return (
    <View
      className={cn(
        "flex-row border-t border-border",
        header && "border-t-0",
        totals && "bg-secondary",
      )}
    >
      {cells.map((cell, i) => (
        <Text
          key={i}
          className={cn(
            CELL,
            "text-body-sm",
            header
              ? "text-label-sm text-foreground"
              : muted
                ? "text-muted-foreground"
                : "text-foreground",
            totals && "font-medium text-secondary-foreground",
          )}
        >
          {cell}
        </Text>
      ))}
    </View>
  );
}

export function HolesTable({
  scorecard,
  hasEstablishedHandicap,
  isNineHoles,
  nineHoleSection,
}: HolesTableProps) {
  const allHoles = (scorecard.teePlayed.holes ?? []) as Hole[];
  const scores = scorecard.scores as Score[];

  const scoresByHoleId = new Map<number, Score>();
  for (const s of scores) {
    if (s.holeId !== undefined) scoresByHoleId.set(s.holeId, s);
  }
  // Legacy rows may lack holeIds — fall back to positional pairing.
  const usePositional = scoresByHoleId.size === 0;

  const scoreForHole = (hole: Hole, index: number): Score | undefined => {
    if (usePositional) return scores[index];
    return hole.id !== undefined ? scoresByHoleId.get(hole.id) : undefined;
  };

  const playedEntries = allHoles
    .map((hole, index) => ({ hole, score: scoreForHole(hole, index) }))
    .filter((entry): entry is { hole: Hole; score: Score } => !!entry.score);

  const totalsLabel = isNineHoles
    ? nineHoleSection === "back"
      ? "Back 9"
      : "Front 9"
    : "Total";

  return (
    <View
      testID="holes-table"
      className="bg-background rounded-lg border border-border overflow-hidden"
    >
      <Row header cells={["Hole", "Par", "Strokes", "HCP", "Adj."]} />
      {allHoles.map((hole, index) => {
        const score = scoreForHole(hole, index);
        const isPlayed = !!score;
        return (
          <Row
            key={hole.id ?? hole.holeNumber}
            muted={!isPlayed}
            cells={[
              hole.holeNumber,
              isPlayed ? hole.par : "-",
              isPlayed && score ? score.strokes : "-",
              isPlayed && score ? score.hcpStrokes : "-",
              isPlayed && score
                ? calculateHoleAdjustedScore(
                    hole,
                    score,
                    hasEstablishedHandicap,
                  )
                : "-",
            ]}
          />
        );
      })}
      <Row
        totals
        cells={[
          totalsLabel,
          playedEntries.reduce((acc, e) => acc + e.hole.par, 0),
          playedEntries.reduce((acc, e) => acc + e.score.strokes, 0),
          playedEntries.reduce((acc, e) => acc + e.score.hcpStrokes, 0),
          playedEntries.reduce(
            (acc, e) =>
              acc +
              calculateHoleAdjustedScore(
                e.hole,
                e.score,
                hasEstablishedHandicap,
              ),
            0,
          ),
        ]}
      />
      <View className="p-sm border-t border-border">
        <Text className="text-meta text-muted-foreground">
          Adj. max: par + net double bogey (incl. handicap strokes)
        </Text>
      </View>
    </View>
  );
}
