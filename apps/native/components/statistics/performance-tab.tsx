/**
 * Performance tab — native mirror of apps/web/components/statistics/
 * overview/overview-section.tsx (Highlights, Overview Stats, Best Month,
 * Exceptional Rounds).
 */
import { router } from "expo-router";
import type { Href } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StatDelta } from "@/components/ui/stat-delta";
import {
  formatDecimal,
  formatDifferential,
  formatPercentage,
  formatScore,
  formatWithSign,
  isValidNumber,
} from "@/lib/statistics/format-utils";
import type {
  CoursePerformance,
  OverviewStats,
  PerformanceExtendedStats,
  ShotLevelStats,
  ShotStat,
} from "@/lib/statistics/types";
import { cn } from "@/lib/utils";

import { StatCard, StatisticsSection } from "./shared";

interface PerformanceTabProps {
  stats: OverviewStats;
  extendedStats: PerformanceExtendedStats;
  shotLevelStats: ShotLevelStats;
  bestCourse?: CoursePerformance;
}

/** "based on N rounds" subtitle for a shot-level stat card. */
const basedOn = (stat: ShotStat): string =>
  stat.sampleSize === 0
    ? "no data yet"
    : `based on ${stat.sampleSize} round${stat.sampleSize !== 1 ? "s" : ""}`;

export function PerformanceTab({
  stats,
  extendedStats,
  shotLevelStats,
  bestCourse,
}: PerformanceTabProps) {
  const getImprovementMessage = (): string => {
    if (!isValidNumber(stats.improvementRate) || stats.improvementRate === 0) {
      return "Keep playing to track improvement";
    }
    if (stats.improvementRate > 0) {
      return `${stats.improvementRate.toFixed(1)}% improvement - keep it up!`;
    }
    return "Room for improvement";
  };

  const getAvgScoreContext = (): string => {
    if (stats.totalRounds === 0 || !isValidNumber(stats.avgScore)) {
      return "No data yet";
    }
    if (!isValidNumber(stats.avgPar)) {
      return `across ${stats.totalRounds} round${stats.totalRounds !== 1 ? "s" : ""}`;
    }
    const overPar = Math.round(stats.avgScore) - Math.round(stats.avgPar);
    if (overPar === 0) return "Right at par!";
    if (overPar > 0) return `Typically ${overPar} over par`;
    return `Typically ${Math.abs(overPar)} under par`;
  };

  const getHandicapChangeMessage = (): string => {
    if (stats.totalRounds === 0 || !isValidNumber(stats.handicapChange)) {
      return "No data yet";
    }
    if (stats.handicapChange < 0) return "Getting better!";
    if (stats.handicapChange > 0) return "Room to improve";
    return "Holding steady";
  };

  const getConsistencyLabel = (rating: number): string => {
    if (rating >= 80) return "Very Consistent";
    if (rating >= 60) return "Consistent";
    if (rating >= 40) return "Moderate";
    if (rating >= 20) return "Variable";
    return "Unpredictable";
  };

  const strokeSpread =
    isValidNumber(stats.worstDifferential) &&
    isValidNumber(stats.bestDifferential)
      ? (stats.worstDifferential - stats.bestDifferential).toFixed(1)
      : "--";

  return (
    <View className="gap-xl" testID="performance-tab">
      <StatisticsSection
        icon="🏆"
        title="Highlights"
        description="Your standout performance metrics"
      >
        <View className="gap-md">
          <Card className="tint-score-eagle">
            <CardHeader className="pb-sm">
              <Text className="text-body-sm text-muted-foreground">
                🏆 Best Round
              </Text>
            </CardHeader>
            <CardContent>
              <Text className="text-figure-lg text-foreground">
                {formatDifferential(stats.bestDifferential)}
              </Text>
              <Text className="text-body-sm text-muted-foreground">
                differential
              </Text>
              {bestCourse ? (
                <Text className="text-meta text-muted-foreground mt-xs">
                  at {bestCourse.courseName}
                </Text>
              ) : null}
              <Text className="text-meta-strong text-success mt-sm">
                Your career best!
              </Text>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-sm">
              <Text className="text-body-sm text-muted-foreground">
                📊 Score Range
              </Text>
            </CardHeader>
            <CardContent>
              <View className="flex-row items-baseline gap-sm">
                <Text className="text-figure-lg text-success">
                  {formatDifferential(stats.bestDifferential)}
                </Text>
                <Text className="text-body text-muted-foreground">to</Text>
                <Text className="text-figure-lg text-destructive">
                  {formatDifferential(stats.worstDifferential)}
                </Text>
              </View>
              <Text className="text-body-sm text-muted-foreground">
                differential range
              </Text>
              <Text className="text-meta text-muted-foreground mt-sm">
                {strokeSpread} stroke spread
              </Text>
            </CardContent>
          </Card>

          <Card
            className={cn(
              isValidNumber(stats.improvementRate) &&
                stats.improvementRate > 0 &&
                "tint-success",
            )}
          >
            <CardHeader className="pb-sm">
              <Text className="text-body-sm text-muted-foreground">
                {!isValidNumber(stats.improvementRate) ||
                stats.improvementRate === 0
                  ? "📊"
                  : stats.improvementRate > 0
                    ? "📈"
                    : "📉"}{" "}
                Improvement
              </Text>
            </CardHeader>
            <CardContent>
              <Text
                className={cn(
                  "text-figure-lg",
                  isValidNumber(stats.improvementRate) &&
                    stats.improvementRate > 0
                    ? "text-success"
                    : "text-muted-foreground",
                )}
              >
                {isValidNumber(stats.improvementRate)
                  ? `${stats.improvementRate > 0 ? "+" : ""}${stats.improvementRate.toFixed(1)}%`
                  : "--"}
              </Text>
              <Text className="text-body-sm text-muted-foreground">
                since starting
              </Text>
              <Text
                className={cn(
                  "text-meta mt-sm",
                  isValidNumber(stats.improvementRate) &&
                    stats.improvementRate > 0
                    ? "text-success font-medium"
                    : "text-muted-foreground",
                )}
              >
                {getImprovementMessage()}
              </Text>
            </CardContent>
          </Card>
        </View>
      </StatisticsSection>

      <View className="h-px bg-border" />

      <StatisticsSection
        icon="📈"
        title="Overview Stats"
        description="Key metrics at a glance"
      >
        <View className="flex-row flex-wrap gap-md">
          <View style={{ flexBasis: "45%", flexGrow: 1 }}>
            <StatCard
              title="Average Score"
              value={formatScore(stats.avgScore)}
              subtitle={getAvgScoreContext()}
            />
          </View>
          <View style={{ flexBasis: "45%", flexGrow: 1 }}>
            <Card>
              <CardContent className="p-md pt-md">
                <Text className="text-body-sm text-muted-foreground">
                  Handicap Change
                </Text>
                <View className="flex-row items-baseline gap-sm">
                  <Text className="text-figure text-foreground">
                    {formatWithSign(stats.handicapChange)}
                  </Text>
                  {isValidNumber(stats.handicapChange) &&
                  stats.handicapChange !== 0 ? (
                    <StatDelta value={stats.handicapChange} invert iconOnly />
                  ) : null}
                </View>
                <Text className="text-meta text-muted-foreground">
                  {getHandicapChangeMessage()}
                </Text>
              </CardContent>
            </Card>
          </View>
          <View style={{ flexBasis: "45%", flexGrow: 1 }}>
            <StatCard
              title="Consistency"
              value={
                extendedStats.consistencyRating > 0
                  ? `${extendedStats.consistencyRating}%`
                  : "--"
              }
              subtitle={
                extendedStats.consistencyRating > 0
                  ? getConsistencyLabel(extendedStats.consistencyRating)
                  : "Need more rounds"
              }
            />
          </View>
          <View style={{ flexBasis: "45%", flexGrow: 1 }}>
            <StatCard
              title="Courses Played"
              value={extendedStats.uniqueCourses}
              subtitle={`unique course${extendedStats.uniqueCourses !== 1 ? "s" : ""}`}
            />
          </View>
        </View>
      </StatisticsSection>

      <View className="h-px bg-border" />

      {/* Shot-Level Stats Section (plans/010) — mirror of web's */}
      <StatisticsSection
        icon="🎯"
        title="Shot-Level Stats"
        description="Putts, fairways, and penalties from detailed scoring"
      >
        {shotLevelStats.puttsPerRound.sampleSize > 0 ||
        shotLevelStats.girPercentage.sampleSize > 0 ||
        shotLevelStats.firPercentage.sampleSize > 0 ||
        shotLevelStats.penaltiesPerRound.sampleSize > 0 ? (
          <View className="flex-row flex-wrap gap-md">
            <View style={{ flexBasis: "45%", flexGrow: 1 }}>
              <StatCard
                title="Putts / Round"
                value={formatDecimal(shotLevelStats.puttsPerRound.value, 1)}
                subtitle={basedOn(shotLevelStats.puttsPerRound)}
              />
            </View>
            <View style={{ flexBasis: "45%", flexGrow: 1 }}>
              <StatCard
                title="GIR"
                value={formatPercentage(shotLevelStats.girPercentage.value)}
                subtitle={basedOn(shotLevelStats.girPercentage)}
              />
            </View>
            <View style={{ flexBasis: "45%", flexGrow: 1 }}>
              <StatCard
                title="Fairways Hit"
                value={formatPercentage(shotLevelStats.firPercentage.value)}
                subtitle={basedOn(shotLevelStats.firPercentage)}
              />
            </View>
            <View style={{ flexBasis: "45%", flexGrow: 1 }}>
              <StatCard
                title="Penalties / Round"
                value={formatDecimal(
                  shotLevelStats.penaltiesPerRound.value,
                  1,
                )}
                subtitle={basedOn(shotLevelStats.penaltiesPerRound)}
              />
            </View>
          </View>
        ) : (
          <Card>
            <CardContent className="p-md pt-md">
              <Text className="text-body-sm text-muted-foreground">
                No shot-level data yet. Turn on{" "}
                <Text className="text-body-sm font-medium text-foreground">
                  Detailed scoring
                </Text>{" "}
                when adding a round to track putts, greens in regulation,
                fairways, and penalties.
              </Text>
            </CardContent>
          </Card>
        )}
      </StatisticsSection>

      {extendedStats.bestMonth ? (
        <>
          <View className="h-px bg-border" />
          <StatisticsSection
            icon="🌟"
            title="Best Month"
            description="Your peak performance period"
          >
            <Card className="tint-primary">
              <CardContent className="p-lg pt-lg">
                <View className="flex-row items-center justify-between">
                  <View>
                    <Text className="text-figure text-foreground">
                      {extendedStats.bestMonth.month}{" "}
                      {extendedStats.bestMonth.year}
                    </Text>
                    <Text className="text-body-sm text-muted-foreground">
                      {extendedStats.bestMonth.roundCount} rounds played
                    </Text>
                  </View>
                  <View className="items-end">
                    <Text className="text-figure-lg text-success">
                      {formatDifferential(
                        extendedStats.bestMonth.avgDifferential,
                      )}
                    </Text>
                    <Text className="text-body-sm text-muted-foreground">
                      avg differential
                    </Text>
                  </View>
                </View>
              </CardContent>
            </Card>
          </StatisticsSection>
        </>
      ) : null}

      {extendedStats.exceptionalRounds.length > 0 ? (
        <>
          <View className="h-px bg-border" />
          <StatisticsSection
            icon="⚡"
            title="Exceptional Rounds"
            description={`You've had ${extendedStats.exceptionalRounds.length} exceptional round${extendedStats.exceptionalRounds.length !== 1 ? "s" : ""}!`}
            learnMoreContent="An exceptional round is when your score differential is 7 or more strokes better than your handicap index at the time. These rounds trigger an Exceptional Score Reduction (ESR) in the USGA handicap system."
          >
            <View className="gap-sm">
              {extendedStats.exceptionalRounds.map((round) => (
                <Pressable
                  key={round.roundId}
                  accessibilityRole="link"
                  onPress={() =>
                    router.push(
                      `/rounds/${round.roundId}/calculation` as Href,
                    )
                  }
                >
                  <Card className="tint-score-eagle">
                    <CardContent className="p-md pt-md">
                      <View className="flex-row items-center justify-between">
                        <View className="flex-row items-center gap-sm flex-1">
                          <Text className="text-figure">🏆</Text>
                          <View className="flex-1">
                            <Text
                              className="text-body font-semibold text-foreground"
                              numberOfLines={1}
                            >
                              {round.courseName}
                            </Text>
                            <Text className="text-meta text-muted-foreground">
                              {new Date(round.date).toLocaleDateString()}
                            </Text>
                          </View>
                        </View>
                        <View className="items-end">
                          <Text className="text-figure-sm text-success">
                            {formatDifferential(round.differential)}
                          </Text>
                          <Text className="text-meta text-muted-foreground">
                            differential
                          </Text>
                        </View>
                      </View>
                    </CardContent>
                  </Card>
                </Pressable>
              ))}
            </View>
          </StatisticsSection>
        </>
      ) : null}
    </View>
  );
}
