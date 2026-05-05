"use client";

import { useMemo, useState } from "react";
import { TimeRangeFilter } from "./time-range-filter";
import { PlayerIdentityCard } from "./hero/player-identity-card";
import { PerformanceSection } from "./overview/overview-section";
import { ActivitySection } from "./activity/activity-section";
import { CoursesSection } from "./courses/courses-section";
import { FrivolitiesSection } from "./frivolities/frivolities-section";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  filterByTimeRange,
  calculateOverviewStats,
  calculateCoursePerformance,
  calculateDayOfWeekStats,
  calculateTimeOfDayStats,
  calculateHolesPlayedStats,
  calculateRoundsPerMonth,
  calculateTotalStrokes,
  calculateAvgStrokesPerHole,
  calculateStrokesByParType,
  calculateScoreDistribution,
  calculateDaysSinceLastRound,
  calculateGolfAge,
  calculateAverageRoundsPerMonth,
  calculateMostActiveMonth,
  calculateLongestGap,
  calculateCurrentStreak,
  calculateSeasonalStats,
  calculateScoringConsistency,
  calculateConsistencyRating,
  calculateBestMonth,
  calculateUniqueCourses,
  calculatePerfectHoles,
  calculateBogeyFreeRounds,
  calculateExceptionalRounds,
  calculateHoleByHoleStats,
  calculateLunarPerformance,
  calculateUniqueHolesPlayed,
} from "@/lib/statistics/calculations";
import { calculatePlayerType } from "@/lib/statistics/player-type";
import type { Tables } from "@/types/supabase";
import type { ScorecardWithRound } from "@/types/scorecard-input";
import type { TimeRange } from "@/types/statistics";
import useMounted from "@/hooks/useMounted";
import StatisticsSkeleton from "./statistics-skeleton";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { H1 } from "@/components/ui/typography";

interface StatisticsProps {
  profile: Tables<"profile">;
  scorecards: ScorecardWithRound[];
}

export function Statistics({ profile, scorecards }: StatisticsProps) {
  const isMounted = useMounted();
  const [timeRange, setTimeRange] = useState<TimeRange>("all");

  // Sort scorecards by teeTime (numeric fields are already converted by the backend)
  const sortedScorecards = useMemo(() => {
    return [...scorecards].sort(
      (a, b) => new Date(a.teeTime).getTime() - new Date(b.teeTime).getTime()
    );
  }, [scorecards]);

  // Filter by time range
  const filteredScorecards = useMemo(() => {
    return filterByTimeRange(sortedScorecards, timeRange);
  }, [sortedScorecards, timeRange]);

  // Calculate all statistics
  const overviewStats = useMemo(() => {
    return calculateOverviewStats(filteredScorecards, Number(profile.handicapIndex));
  }, [filteredScorecards, profile.handicapIndex]);

  const coursePerformance = useMemo(() => {
    return calculateCoursePerformance(filteredScorecards);
  }, [filteredScorecards]);

  const dayOfWeekStats = useMemo(() => {
    return calculateDayOfWeekStats(filteredScorecards);
  }, [filteredScorecards]);

  const timeOfDayStats = useMemo(() => {
    return calculateTimeOfDayStats(filteredScorecards);
  }, [filteredScorecards]);

  const holesPlayedStats = useMemo(() => {
    return calculateHolesPlayedStats(filteredScorecards);
  }, [filteredScorecards]);

  const roundsPerMonth = useMemo(() => {
    return calculateRoundsPerMonth(filteredScorecards);
  }, [filteredScorecards]);

  // Activity stats (use filtered data)
  const activityStats = useMemo(() => {
    return {
      avgRoundsPerMonth: calculateAverageRoundsPerMonth(filteredScorecards),
      mostActiveMonth: calculateMostActiveMonth(filteredScorecards),
      longestGap: calculateLongestGap(filteredScorecards),
      currentStreak: calculateCurrentStreak(sortedScorecards), // Use all-time for streak
      seasonalStats: calculateSeasonalStats(filteredScorecards),
    };
  }, [filteredScorecards, sortedScorecards]);

  // Performance extended stats
  const performanceExtendedStats = useMemo(() => {
    return {
      consistencyRating: calculateConsistencyRating(filteredScorecards),
      scoringConsistency: calculateScoringConsistency(filteredScorecards),
      bestMonth: calculateBestMonth(filteredScorecards),
      uniqueCourses: calculateUniqueCourses(filteredScorecards),
      exceptionalRounds: calculateExceptionalRounds(filteredScorecards),
    };
  }, [filteredScorecards]);

  // Fun stats (always use all-time data for most meaningful results)
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
      // New fun stats
      holeByHoleStats: calculateHoleByHoleStats(sortedScorecards),
      lunarPerformance: calculateLunarPerformance(sortedScorecards),
      uniqueHolesPlayed: calculateUniqueHolesPlayed(sortedScorecards),
      uniqueCoursesPlayed: courses.length,
      countriesPlayed: uniqueCountries,
    };
  }, [sortedScorecards]);

  // Find best course for context in performance section
  const bestCourse = useMemo(() => {
    if (coursePerformance.length === 0) return undefined;
    return [...coursePerformance].sort(
      (a, b) => a.bestDifferential - b.bestDifferential
    )[0];
  }, [coursePerformance]);

  if (!isMounted) return <StatisticsSkeleton />;

  // Empty state for users with no rounds
  if (scorecards.length === 0) {
    return (
      <div className="bg-background text-foreground p-md md:p-xl rounded-lg min-h-screen flex flex-col items-center justify-center">
        <div className="text-center max-w-md">
          <H1 className="text-figure-lg mb-md">No Statistics Yet</H1>
          <p className="text-muted-foreground text-lg mb-lg">
            Record your first round to start tracking your performance.
          </p>
          <p className="text-sm text-muted-foreground mb-lg">
            Once you have a few rounds recorded, you&apos;ll see:
          </p>
          <ul className="text-left text-sm text-muted-foreground space-y-sm mb-xl">
            <li>- Handicap trends and performance analysis</li>
            <li>- Course-by-course breakdowns</li>
            <li>- Activity patterns and streaks</li>
            <li>- Scoring insights and player type analysis</li>
          </ul>
          <Button asChild>
            <Link href="/rounds/add">Record Your First Round</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background text-foreground p-md md:p-xl rounded-lg min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-lg gap-md">
        <div>
          <H1 className="text-figure-lg">Statistics</H1>
          <p className="text-muted-foreground">
            Deep dive into your golf performance
          </p>
        </div>
        <TimeRangeFilter value={timeRange} onChange={setTimeRange} />
      </div>

      {/* Hero - Player Identity Card (Always Visible) */}
      <PlayerIdentityCard
        playerType={funStats.playerType}
        currentHandicap={overviewStats.currentHandicap}
        handicapChange={overviewStats.handicapChange}
        totalRounds={overviewStats.totalRounds}
        golfAgeDays={funStats.golfAgeDays}
        daysSinceLastRound={funStats.daysSinceLastRound}
      />

      {/* Tabbed Content - 4 tabs: Performance, Activity, Courses, Frivolities */}
      <Tabs defaultValue="performance" className="w-full">
        <TabsList className="grid w-full grid-cols-4 mb-lg">
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="courses">Courses</TabsTrigger>
          <TabsTrigger value="frivolities">Frivolities</TabsTrigger>
        </TabsList>

        {/* Performance Tab */}
        <TabsContent value="performance">
          <PerformanceSection
            stats={overviewStats}
            extendedStats={performanceExtendedStats}
            bestCourse={bestCourse}
          />
        </TabsContent>

        {/* Activity Tab (merged with Patterns) */}
        <TabsContent value="activity">
          <ActivitySection
            roundsPerMonth={roundsPerMonth}
            holesPlayedStats={holesPlayedStats}
            dayOfWeekStats={dayOfWeekStats}
            timeOfDayStats={timeOfDayStats}
            activityStats={activityStats}
          />
        </TabsContent>

        {/* Courses Tab */}
        <TabsContent value="courses">
          <CoursesSection
            courses={coursePerformance}
            uniqueCourses={performanceExtendedStats.uniqueCourses}
            totalRounds={overviewStats.totalRounds}
          />
        </TabsContent>

        {/* Frivolities Tab (renamed from Scoring) */}
        <TabsContent value="frivolities">
          <FrivolitiesSection stats={funStats} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
