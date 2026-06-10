/**
 * Frivolities tab — native mirror of apps/web/components/statistics/
 * frivolities/frivolities-section.tsx (Golf Odyssey cards, score
 * distribution, par-type breakdown, front/back nine, lunar performance).
 */
import { Text, View } from "react-native";

import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  formatDifferential,
  formatGolfAge,
  formatNumber,
  formatStrokesPerHole,
} from "@/lib/statistics/format-utils";
import type { FunStats } from "@/lib/statistics/types";
import { cn } from "@/lib/utils";

import { StatCard, StatisticsSection } from "./shared";

const WORLD_GOLF_COURSES = 38000;

interface FrivolitiesTabProps {
  stats: FunStats;
}

const DISTRIBUTION_ROWS: {
  key: keyof FunStats["scoreDistribution"];
  label: string;
  emoji: string;
  tone: string;
}[] = [
  { key: "eagle", label: "Eagles or better", emoji: "🦅", tone: "text-score-eagle" },
  { key: "birdie", label: "Birdies", emoji: "🐦", tone: "text-score-birdie" },
  { key: "par", label: "Pars", emoji: "✅", tone: "text-score-par" },
  { key: "bogey", label: "Bogeys", emoji: "😬", tone: "text-score-bogey" },
  { key: "doubleBogey", label: "Double bogeys", emoji: "😬", tone: "text-score-double" },
  { key: "triplePlus", label: "Triple bogey+", emoji: "😅", tone: "text-score-triple" },
];

export function FrivolitiesTab({ stats }: FrivolitiesTabProps) {
  const totalHoles = stats.strokesByParType.reduce(
    (sum, parType) => sum + parType.holeCount,
    0,
  );

  if (stats.totalStrokes === 0) {
    return (
      <Card>
        <CardContent>
          <EmptyState
            title="No stroke data yet"
            description="Play some rounds to unlock fun statistics"
          />
        </CardContent>
      </Card>
    );
  }

  const perfectHolesPercentage =
    totalHoles > 0
      ? ((stats.perfectHoles.total / totalHoles) * 100).toFixed(1)
      : "0";
  const worldCoursesPercentage =
    stats.uniqueCoursesPlayed > 0
      ? ((stats.uniqueCoursesPlayed / WORLD_GOLF_COURSES) * 100).toFixed(4)
      : "0";

  const { frontBackComparison } = stats.holeByHoleStats;
  const bestLunarPhase = stats.lunarPerformance.bestPhase;

  return (
    <View className="gap-xl" testID="frivolities-tab">
      <StatisticsSection
        icon="🎮"
        title="Your Golf Odyssey"
        description="A playful look at your golfing journey"
      >
        <View className="flex-row flex-wrap gap-md">
          <View style={{ flexBasis: "45%", flexGrow: 1 }}>
            <StatCard
              centered
              title="Total Strokes"
              value={formatNumber(stats.totalStrokes)}
              subtitle={`${formatStrokesPerHole(stats.avgStrokesPerHole)} per hole`}
            />
          </View>
          <View style={{ flexBasis: "45%", flexGrow: 1 }}>
            <StatCard
              centered
              title="Golf Age"
              value={formatGolfAge(stats.golfAgeDays)}
              subtitle="since your first logged round"
            />
          </View>
          <View style={{ flexBasis: "45%", flexGrow: 1 }}>
            <StatCard
              centered
              title="World Courses"
              value={`${worldCoursesPercentage}%`}
              subtitle={`${stats.uniqueCoursesPlayed} of ~${formatNumber(WORLD_GOLF_COURSES)} explored`}
            />
          </View>
          <View style={{ flexBasis: "45%", flexGrow: 1 }}>
            <StatCard
              centered
              title="Countries"
              value={stats.countriesPlayed}
              subtitle="golfed in"
            />
          </View>
          <View style={{ flexBasis: "45%", flexGrow: 1 }}>
            <StatCard
              centered
              title="Perfect Holes"
              value={stats.perfectHoles.total}
              subtitle={`${perfectHolesPercentage}% of holes at par or better`}
            />
          </View>
          <View style={{ flexBasis: "45%", flexGrow: 1 }}>
            <StatCard
              centered
              title="Bogey-Free Rounds"
              value={stats.bogeyFreeRounds}
              subtitle="clean scorecards"
            />
          </View>
        </View>
      </StatisticsSection>

      <View className="h-px bg-border" />

      <StatisticsSection
        icon="📊"
        title="Score Distribution"
        description="How your hole scores break down"
      >
        <Card>
          <CardContent className="pt-md gap-sm">
            {DISTRIBUTION_ROWS.map((row) => {
              const bucket = stats.scoreDistribution[row.key];
              const count = bucket.count;
              const pct = Math.round(bucket.percentage);
              return (
                <View
                  key={row.key}
                  className="flex-row items-center justify-between py-xs"
                >
                  <View className="flex-row items-center gap-sm">
                    <Text className="text-body">{row.emoji}</Text>
                    <Text className="text-body-sm text-foreground">
                      {row.label}
                    </Text>
                  </View>
                  <View className="flex-row items-baseline gap-sm">
                    <Text className={cn("text-figure-sm", row.tone)}>
                      {count}
                    </Text>
                    <Text className="text-meta text-muted-foreground">
                      {pct}%
                    </Text>
                  </View>
                </View>
              );
            })}
          </CardContent>
        </Card>
      </StatisticsSection>

      <View className="h-px bg-border" />

      <StatisticsSection
        icon="🎯"
        title="Strokes by Par Type"
        description="Average strokes on par 3s, 4s and 5s"
      >
        <View className="flex-row gap-md">
          {stats.strokesByParType.map((parType) => (
            <View key={parType.parType} className="flex-1">
              <Card>
                <CardContent className="p-md pt-md items-center">
                  <Text className="text-body-sm text-muted-foreground">
                    Par {parType.parType}s
                  </Text>
                  <Text className="text-figure text-foreground">
                    {parType.avgStrokes.toFixed(1)}
                  </Text>
                  <Text className="text-meta text-muted-foreground">
                    avg strokes
                  </Text>
                </CardContent>
              </Card>
            </View>
          ))}
        </View>
      </StatisticsSection>

      <View className="h-px bg-border" />

      <StatisticsSection
        icon="⛳"
        title="Front vs Back Nine"
        description="Which half of the course suits you"
      >
        <Card>
          <CardContent className="pt-md">
            <View className="flex-row items-center justify-center gap-xl py-sm">
              <View className="items-center">
                <Text className="text-figure text-foreground">
                  {frontBackComparison.front9.avgStrokes.toFixed(1)}
                </Text>
                <Text className="text-body-sm text-muted-foreground mt-xs">
                  Front 9 avg
                </Text>
              </View>
              <Text className="text-heading-2 text-muted-foreground">vs</Text>
              <View className="items-center">
                <Text className="text-figure text-foreground">
                  {frontBackComparison.back9.avgStrokes.toFixed(1)}
                </Text>
                <Text className="text-body-sm text-muted-foreground mt-xs">
                  Back 9 avg
                </Text>
              </View>
            </View>
            <Text className="text-meta text-muted-foreground text-center">
              {frontBackComparison.front9.avgStrokes === 0 ||
              frontBackComparison.back9.avgStrokes === 0
                ? "Play full rounds to compare halves"
                : frontBackComparison.front9.avgStrokes <
                    frontBackComparison.back9.avgStrokes
                  ? "You start strong — front nine specialist"
                  : frontBackComparison.front9.avgStrokes >
                      frontBackComparison.back9.avgStrokes
                    ? "You finish strong — back nine specialist"
                    : "Perfectly balanced"}
            </Text>
          </CardContent>
        </Card>
      </StatisticsSection>

      {bestLunarPhase ? (
        <>
          <View className="h-px bg-border" />
          <StatisticsSection
            icon="🌙"
            title="Lunar Performance"
            description="Completely unscientific. Entirely fun."
          >
            <Card className="tint-info">
              <CardContent className="pt-md items-center">
                <Text className="text-figure-lg">{bestLunarPhase.emoji}</Text>
                <Text className="text-body font-semibold text-foreground mt-xs">
                  Best under the {bestLunarPhase.phaseName}
                </Text>
                <Text className="text-meta text-muted-foreground mt-xs">
                  {formatDifferential(bestLunarPhase.avgDifferential)} avg
                  differential over {bestLunarPhase.roundCount} round
                  {bestLunarPhase.roundCount !== 1 ? "s" : ""}
                </Text>
              </CardContent>
            </Card>
          </StatisticsSection>
        </>
      ) : null}
    </View>
  );
}
