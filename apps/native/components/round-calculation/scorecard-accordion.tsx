/**
 * Read-only scorecard viewer (plan 013 D2) — native mirror of
 * apps/web/components/round/scorecard-accordion.tsx: separated hole cards
 * that expand in place. Header shows Par · SI · Distance; expanding reveals
 * the static Putts / Fairway / Penalties trio. Holes logged without detail
 * render score-only, non-expandable cards — never empty stat chips.
 */
import { ChevronRight } from "lucide-react-native";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { tokens } from "@handicappin/tokens/tokens";

import { HoleDetailTrio } from "@/components/scorecard/hole-detail-trio";
import type { ScorecardWithRound } from "@/lib/api/schemas/scorecard";
import { useColorMode } from "@/lib/color-mode";
import { holeHasDetail, scoreResultLabel } from "@/lib/hole-detail";
import { cn } from "@/lib/utils";

type ViewerHole = NonNullable<
  ScorecardWithRound["teePlayed"]["holes"]
>[number];
type ViewerScore = ScorecardWithRound["scores"][number];

const CHEVRON_SIZE = 16; // allow-hardcoded lucide icon prop mirrors web's fixed h-4 w-4 icon box

function HoleCard({
  hole,
  score,
  unit,
}: {
  hole: ViewerHole;
  score: ViewerScore;
  unit: "m" | "yd";
}) {
  const [open, setOpen] = useState(false);
  const mode = useColorMode();
  const mutedForeground = tokens.colors[mode]["muted-foreground"];
  const expandable = holeHasDetail(score);
  const diff = score.strokes - hole.par;
  const resultClass =
    diff < 0 ? "text-success" : diff > 0 ? "text-warning" : "text-foreground";

  const header = (
    <>
      <View className="h-8 w-8 items-center justify-center rounded-md border border-border bg-background-alternate">
        <Text className="text-body-sm font-medium text-foreground">
          {hole.holeNumber}
        </Text>
      </View>
      <View className="flex-1">
        <Text className="text-body-sm font-medium text-foreground">
          Par {hole.par}
        </Text>
        <Text className="text-meta text-muted-foreground">
          SI {hole.hcp} · {hole.distance} {unit}
        </Text>
      </View>
      <View className="items-end">
        <Text className={cn("text-body font-bold", resultClass)}>
          {score.strokes}
        </Text>
        <Text className={cn("text-meta", resultClass)}>
          {scoreResultLabel(score.strokes, hole.par)}
        </Text>
      </View>
      {expandable ? (
        <View className={cn(open && "rotate-90")}>
          <ChevronRight size={CHEVRON_SIZE} color={mutedForeground} />
        </View>
      ) : null}
    </>
  );

  if (!expandable) {
    return (
      <View
        testID={`viewer-hole-${hole.holeNumber}`}
        className="flex-row items-center gap-md rounded-lg border border-border bg-background px-md py-sm"
      >
        {header}
      </View>
    );
  }

  return (
    <View className="rounded-lg border border-border bg-background">
      <Pressable
        testID={`viewer-hole-${hole.holeNumber}`}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`Hole ${hole.holeNumber} details`}
        onPress={() => setOpen((v) => !v)}
        className="flex-row items-center gap-md px-md py-sm active:opacity-80"
      >
        {header}
      </Pressable>
      {open ? (
        <View className="border-t border-border px-md py-sm">
          <HoleDetailTrio
            mode="static"
            holeNumber={hole.holeNumber}
            par={hole.par}
            value={{
              putts: score.putts,
              fairwayHit: score.fairwayHit,
              penaltyStrokes: score.penaltyStrokes,
            }}
          />
        </View>
      ) : null}
    </View>
  );
}

/** Strokes / avg-putts / vs-par rollup for a run of played holes. */
function sectionStats(
  holes: ViewerHole[],
  scoreFor: (h: ViewerHole) => ViewerScore | undefined,
) {
  let strokes = 0;
  let par = 0;
  let puttsSum = 0;
  let puttsCount = 0;
  for (const hole of holes) {
    const score = scoreFor(hole);
    if (!score) continue;
    strokes += score.strokes;
    par += hole.par;
    if (score.putts != null) {
      puttsSum += score.putts;
      puttsCount += 1;
    }
  }
  const diff = strokes - par;
  return {
    strokes,
    avgPutts: puttsCount > 0 ? (puttsSum / puttsCount).toFixed(1) : "–",
    toPar: diff === 0 ? "E" : diff > 0 ? `+${diff}` : `${diff}`,
  };
}

/** OUT / IN / TOTAL rollup row rendered after each nine's hole cards. */
function SummaryRow({
  label,
  stats,
}: {
  label: string;
  stats: ReturnType<typeof sectionStats>;
}) {
  return (
    <View
      testID={`viewer-summary-${label.toLowerCase()}`}
      className="flex-row items-center gap-md rounded-lg border border-border bg-background-alternate px-md py-sm"
    >
      <View className="h-8 min-w-8 items-center justify-center">
        <Text className="text-label-sm uppercase text-muted-foreground">
          {label}
        </Text>
      </View>
      {(
        [
          ["Strokes", String(stats.strokes)],
          ["Avg putts", stats.avgPutts],
          ["Score", stats.toPar],
        ] as const
      ).map(([caption, value]) => (
        <View key={caption} className="flex-1 items-center">
          <Text className="text-meta text-muted-foreground">{caption}</Text>
          <Text className="text-body-sm font-bold text-foreground">
            {value}
          </Text>
        </View>
      ))}
    </View>
  );
}

export function ScorecardAccordion({
  scorecard,
}: {
  scorecard: ScorecardWithRound;
}) {
  const allHoles = scorecard.teePlayed.holes ?? [];
  const unit =
    scorecard.teePlayed.distanceMeasurement === "meters" ? "m" : "yd";

  // holeId → score lookup: works for front-9, back-9 and 18-hole rounds
  // alike (same pattern as HolesTable).
  const scoresByHoleId = new Map<number, ViewerScore>();
  for (const s of scorecard.scores) {
    if (s.holeId !== undefined) scoresByHoleId.set(s.holeId, s);
  }
  const playedHoles = allHoles.filter(
    (h) => h.id !== undefined && scoresByHoleId.has(h.id),
  );
  const scoreFor = (h: ViewerHole) => scoresByHoleId.get(h.id ?? -1);

  const front = playedHoles.filter((h) => h.holeNumber <= 9);
  const back = playedHoles.filter((h) => h.holeNumber > 9);
  const bothNines = front.length > 0 && back.length > 0;

  const section = (label: string, summaryLabel: string, holes: ViewerHole[]) =>
    holes.length > 0 ? (
      <View className="gap-sm">
        <View className="px-xs">
          <Text className="text-label-sm uppercase text-muted-foreground">
            {label}
          </Text>
        </View>
        {holes.map((hole) => {
          const score = scoreFor(hole);
          if (!score) return null;
          return (
            <HoleCard
              key={hole.holeNumber}
              hole={hole}
              score={score}
              unit={unit}
            />
          );
        })}
        <SummaryRow
          label={summaryLabel}
          stats={sectionStats(holes, scoreFor)}
        />
      </View>
    ) : null;

  return (
    <View className="gap-md" testID="scorecard-accordion">
      {section("Front 9", "Out", front)}
      {section("Back 9", "In", back)}
      {bothNines ? (
        <SummaryRow label="Total" stats={sectionStats(playedHoles, scoreFor)} />
      ) : null}
    </View>
  );
}
