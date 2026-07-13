/**
 * Statistics — native twin of apps/web/app/statistics/page.tsx +
 * components/statistics/statistics.tsx: time-range filter, player identity
 * card, and the four inner tabs (Performance, Activity, Courses,
 * Frivolities) over the SAME pure calculation library (lib/statistics —
 * a verbatim mirror of web's).
 */
import { useQuery } from "@tanstack/react-query";
import { Redirect, router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { tokens } from "@handicappin/tokens/tokens";

import { ActivityTab } from "@/components/statistics/activity-tab";
import { CoursesTab } from "@/components/statistics/courses-tab";
import { FrivolitiesTab } from "@/components/statistics/frivolities-tab";
import { PerformanceTab } from "@/components/statistics/performance-tab";
import {
  PlayerIdentityCard,
  SegmentedTabs,
} from "@/components/statistics/shared";
import { DataSettledMarker } from "@/components/data-settled";
import { Button } from "@/components/ui/button";
import { H1, H2 } from "@/components/ui/typography";
import { analytics } from "@/lib/analytics";
import { profileQueryOptions } from "@/lib/api/procedures/auth";
import { scorecardsQueryOptions } from "@/lib/api/procedures/scorecard";
import { useSession } from "@/lib/auth/session-provider";
import { useDataSettled } from "@/lib/query/settle";
import {
  calculateAverageRoundsPerMonth,
  calculateBestMonth,
  calculateBogeyFreeRounds,
  calculateConsistencyRating,
  calculateCoursePerformance,
  calculateCurrentStreak,
  calculateDayOfWeekStats,
  calculateDaysSinceLastRound,
  calculateExceptionalRounds,
  calculateGolfAge,
  calculateHoleByHoleStats,
  calculateHolesPlayedStats,
  calculateLongestGap,
  calculateLunarPerformance,
  calculateMostActiveMonth,
  calculateOverviewStats,
  calculateRoundsPerMonth,
  calculateScoreDistribution,
  calculateScoringConsistency,
  calculateSeasonalStats,
  calculateStrokesByParType,
  calculateTimeOfDayStats,
  calculateTotalStrokes,
  calculateAvgStrokesPerHole,
  calculatePerfectHoles,
  calculateUniqueCourses,
  calculateUniqueHolesPlayed,
  calculateShotLevelStats,
  filterByTimeRange,
} from "@/lib/statistics/calculations";
import { calculatePlayerType } from "@/lib/statistics/player-type";
import type { TimeRange } from "@/lib/statistics/types";

type StatsTab = "performance" | "activity" | "courses" | "frivolities";

const TIME_RANGES: { value: TimeRange; label: string }[] = [
  { value: "6months", label: "6 months" },
  { value: "1year", label: "1 year" },
  { value: "all", label: "All time" },
];

export default function StatisticsScreen() {
  const { session, initializing } = useSession();
  const insets = useSafeAreaInsets();
  const [timeRange, setTimeRange] = useState<TimeRange>("all");
  const [tab, setTab] = useState<StatsTab>("performance");

  // Mirrors web: one stats_viewed per screen mount, then one per tab switch.
  useEffect(() => {
    analytics.capture("stats_viewed", { tab: "performance" });
  }, []);

  const userId = session?.user.id ?? null;
  const scorecardsQuery = useQuery({
    ...scorecardsQueryOptions(userId ?? ""),
    enabled: userId != null,
  });
  const profileQuery = useQuery({
    ...profileQueryOptions(userId ?? ""),
    enabled: userId != null,
  });
  const settled = useDataSettled([scorecardsQuery, profileQuery]);

  const scorecards = useMemo(
    () => scorecardsQuery.data ?? [],
    [scorecardsQuery.data],
  );
  const sortedScorecards = useMemo(
    () =>
      [...scorecards].sort(
        (a, b) =>
          new Date(a.teeTime).getTime() - new Date(b.teeTime).getTime(),
      ),
    [scorecards],
  );
  const filteredScorecards = useMemo(
    () => filterByTimeRange(sortedScorecards, timeRange),
    [sortedScorecards, timeRange],
  );

  const handicapIndex = Number(profileQuery.data?.handicapIndex ?? 0);

  const overviewStats = useMemo(
    () => calculateOverviewStats(filteredScorecards, handicapIndex),
    [filteredScorecards, handicapIndex],
  );
  const coursePerformance = useMemo(
    () => calculateCoursePerformance(filteredScorecards),
    [filteredScorecards],
  );
  const activityStats = useMemo(
    () => ({
      avgRoundsPerMonth: calculateAverageRoundsPerMonth(filteredScorecards),
      mostActiveMonth: calculateMostActiveMonth(filteredScorecards),
      longestGap: calculateLongestGap(filteredScorecards),
      currentStreak: calculateCurrentStreak(sortedScorecards),
      seasonalStats: calculateSeasonalStats(filteredScorecards),
    }),
    [filteredScorecards, sortedScorecards],
  );
  // Shot-level stats (plans/010) — only rounds logged with detailed scoring
  // contribute; the section handles the all-empty case itself.
  const shotLevelStats = useMemo(
    () => calculateShotLevelStats(filteredScorecards),
    [filteredScorecards],
  );
  const performanceExtendedStats = useMemo(
    () => ({
      consistencyRating: calculateConsistencyRating(filteredScorecards),
      scoringConsistency: calculateScoringConsistency(filteredScorecards),
      bestMonth: calculateBestMonth(filteredScorecards),
      uniqueCourses: calculateUniqueCourses(filteredScorecards),
      exceptionalRounds: calculateExceptionalRounds(filteredScorecards),
    }),
    [filteredScorecards],
  );
  const funStats = useMemo(() => {
    const courses = calculateCoursePerformance(sortedScorecards);
    const uniqueCountries = new Set(courses.map((c) => c.country)).size;
    return {
      totalStrokes: calculateTotalStrokes(sortedScorecards),
      avgStrokesPerHole: calculateAvgStrokesPerHole(sortedScorecards),
      strokesByDayOfWeek: calculateDayOfWeekStats(sortedScorecards),
      strokesByParType: calculateStrokesByParType(sortedScorecards),
      scoreDistribution: calculateScoreDistribution(sortedScorecards),
      daysSinceLastRound: calculateDaysSinceLastRound(sortedScorecards),
      golfAgeDays: calculateGolfAge(sortedScorecards),
      playerType: calculatePlayerType(sortedScorecards),
      perfectHoles: calculatePerfectHoles(sortedScorecards),
      bogeyFreeRounds: calculateBogeyFreeRounds(sortedScorecards),
      holeByHoleStats: calculateHoleByHoleStats(sortedScorecards),
      lunarPerformance: calculateLunarPerformance(sortedScorecards),
      uniqueHolesPlayed: calculateUniqueHolesPlayed(sortedScorecards),
      uniqueCoursesPlayed: courses.length,
      countriesPlayed: uniqueCountries,
    };
  }, [sortedScorecards]);

  const bestCourse = useMemo(() => {
    if (coursePerformance.length === 0) return undefined;
    return [...coursePerformance].sort(
      (a, b) => a.bestDifferential - b.bestDifferential,
    )[0];
  }, [coursePerformance]);

  if (initializing) return null;
  if (!session) return <Redirect href="/login" />;

  if (scorecardsQuery.isError) {
    return (
      <View
        testID="statistics-screen"
        className="flex-1 bg-background items-center justify-center p-lg gap-md"
      >
        <DataSettledMarker settled={settled} />
        <H2 className="text-center">Unlimited plan required</H2>
        <Text className="text-body text-muted-foreground text-center">
          {scorecardsQuery.error instanceof Error
            ? scorecardsQuery.error.message
            : "Statistics requires an Unlimited or Lifetime plan."}
        </Text>
      </View>
    );
  }

  // Empty state mirrors web's no-rounds branch.
  if (settled && scorecards.length === 0) {
    return (
      <View
        testID="statistics-screen"
        className="flex-1 bg-background items-center justify-center p-lg"
      >
        <DataSettledMarker settled={settled} />
        <View className="items-center gap-md">
          <H1 className="text-figure-lg text-center">No Statistics Yet</H1>
          <Text className="text-lead text-muted-foreground text-center">
            Record your first round to start tracking your performance.
          </Text>
          <Button onPress={() => router.push("/rounds/add")}>
            Record Your First Round
          </Button>
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      testID="statistics-screen"
      className="flex-1 bg-background"
      contentContainerStyle={{
        paddingTop: insets.top + tokens.spacing.md,
        paddingHorizontal: tokens.spacing.md,
        paddingBottom: tokens.spacing["3xl"],
      }}
    >
      <DataSettledMarker settled={settled} />

      {/* Header + time range filter */}
      <View className="mb-lg gap-md">
        <View>
          <H1 className="text-figure-lg">Statistics</H1>
          <Text className="text-body text-muted-foreground">
            Deep dive into your golf performance
          </Text>
        </View>
        <View className="flex-row gap-sm">
          {TIME_RANGES.map((range) => (
            <Pressable
              key={range.value}
              testID={`time-range-${range.value}`}
              accessibilityRole="button"
              accessibilityState={{ selected: timeRange === range.value }}
              onPress={() => setTimeRange(range.value)}
              className={
                timeRange === range.value
                  ? "rounded-md bg-primary px-md py-sm"
                  : "rounded-md border border-input px-md py-sm"
              }
            >
              <Text
                className={
                  timeRange === range.value
                    ? "text-label-sm text-primary-foreground"
                    : "text-label-sm text-foreground"
                }
              >
                {range.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <PlayerIdentityCard
        playerType={funStats.playerType}
        currentHandicap={overviewStats.currentHandicap}
        handicapChange={overviewStats.handicapChange}
        totalRounds={overviewStats.totalRounds}
        golfAgeDays={funStats.golfAgeDays}
        daysSinceLastRound={funStats.daysSinceLastRound}
      />

      <SegmentedTabs
        tabs={[
          { value: "performance", label: "Perform" },
          { value: "activity", label: "Activity" },
          { value: "courses", label: "Courses" },
          { value: "frivolities", label: "Fun" },
        ]}
        value={tab}
        onChange={(next) => {
          analytics.capture("stats_viewed", { tab: next });
          setTab(next);
        }}
      />

      {tab === "performance" ? (
        <PerformanceTab
          stats={overviewStats}
          extendedStats={performanceExtendedStats}
          shotLevelStats={shotLevelStats}
          bestCourse={bestCourse}
        />
      ) : null}
      {tab === "activity" ? (
        <ActivityTab
          roundsPerMonth={calculateRoundsPerMonth(filteredScorecards)}
          holesPlayedStats={calculateHolesPlayedStats(filteredScorecards)}
          dayOfWeekStats={calculateDayOfWeekStats(filteredScorecards)}
          timeOfDayStats={calculateTimeOfDayStats(filteredScorecards)}
          activityStats={activityStats}
        />
      ) : null}
      {tab === "courses" ? (
        <CoursesTab
          courses={coursePerformance}
          uniqueCourses={performanceExtendedStats.uniqueCourses}
          totalRounds={overviewStats.totalRounds}
        />
      ) : null}
      {tab === "frivolities" ? <FrivolitiesTab stats={funStats} /> : null}
    </ScrollView>
  );
}
