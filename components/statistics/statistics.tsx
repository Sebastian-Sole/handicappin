"use client";

import { useMemo, useState } from "react";
import { TimeRangeFilter } from "./time-range-filter";
import { PlayerIdentityCard } from "./hero/player-identity-card";
import { PerformanceSection } from "./overview/overview-section";
import { PatternsSection } from "./patterns/patterns-section";
import { RoundsPerMonthChart } from "./round-insights/rounds-per-month-chart";
import { ScoringBreakdownSection } from "./fun-facts/fun-facts-section";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getFlagEmoji } from "@/utils/frivolities/headerGenerator";
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
} from "@/lib/statistics/calculations";
import { calculatePlayerType } from "@/lib/statistics/player-type";
import type { Tables } from "@/types/supabase";
import type { ScorecardWithRound } from "@/types/scorecard-input";
import type { TimeRange, CoursePerformance, HolesPlayedStats } from "@/types/statistics";
import useMounted from "@/hooks/useMounted";
import StatisticsSkeleton from "./statistics-skeleton";

interface StatisticsProps {
  profile: Tables<"profile">;
  scorecards: ScorecardWithRound[];
}

export function Statistics({ profile, scorecards }: StatisticsProps) {
  const isMounted = useMounted();
  const [timeRange, setTimeRange] = useState<TimeRange>("all");

  // Sort scorecards by teeTime
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

  // Fun stats (always use all-time data for most meaningful results)
  const funStats = useMemo(() => {
    return {
      totalStrokes: calculateTotalStrokes(sortedScorecards),
      avgStrokesPerHole: calculateAvgStrokesPerHole(sortedScorecards),
      strokesByDayOfWeek: calculateDayOfWeekStats(sortedScorecards),
      strokesByParType: calculateStrokesByParType(sortedScorecards),
      scoreDistribution: calculateScoreDistribution(sortedScorecards),
      daysSinceLastRound: calculateDaysSinceLastRound(sortedScorecards),
      golfAgeDays: calculateGolfAge(sortedScorecards),
      playerType: calculatePlayerType(sortedScorecards),
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

  return (
    <div className="bg-background text-foreground p-4 md:p-8 rounded-lg min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold">Statistics</h1>
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

      {/* Tabbed Content */}
      <Tabs defaultValue="performance" className="w-full">
        <TabsList className="grid w-full grid-cols-5 mb-6">
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="patterns">Patterns</TabsTrigger>
          <TabsTrigger value="courses">Courses</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="scoring">Scoring</TabsTrigger>
        </TabsList>

        {/* Performance Tab */}
        <TabsContent value="performance">
          <PerformanceSection stats={overviewStats} bestCourse={bestCourse} />
        </TabsContent>

        {/* Patterns Tab */}
        <TabsContent value="patterns">
          <PatternsSection
            dayOfWeekStats={dayOfWeekStats}
            timeOfDayStats={timeOfDayStats}
          />
        </TabsContent>

        {/* Courses Tab */}
        <TabsContent value="courses">
          <CourseAnalyticsTab courses={coursePerformance} />
        </TabsContent>

        {/* Activity Tab */}
        <TabsContent value="activity">
          <ActivityTab
            roundsPerMonth={roundsPerMonth}
            holesPlayedStats={holesPlayedStats}
          />
        </TabsContent>

        {/* Scoring Tab */}
        <TabsContent value="scoring">
          <ScoringBreakdownSection stats={funStats} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Course Analytics Tab Content
function CourseAnalyticsTab({ courses }: { courses: CoursePerformance[] }) {
  if (courses.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center text-muted-foreground">
          <div className="text-4xl mb-4">🏌️</div>
          <p className="text-lg font-medium">No course data yet</p>
          <p className="text-sm">Play more rounds to see course analytics</p>
        </CardContent>
      </Card>
    );
  }

  const bestCourse = [...courses].sort(
    (a, b) => a.avgDifferential - b.avgDifferential
  )[0];
  const worstCourse = [...courses].sort(
    (a, b) => b.avgDifferential - a.avgDifferential
  )[0];
  const mostPlayed = courses[0]; // Already sorted by round count

  return (
    <div className="space-y-6">
      {/* Highlight Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              Most Played
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-semibold">
              {getFlagEmoji(mostPlayed.country)} {mostPlayed.courseName}
            </p>
            <p className="text-sm text-muted-foreground">
              {mostPlayed.roundCount} rounds
            </p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-green-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              Best Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-semibold">
              {getFlagEmoji(bestCourse.country)} {bestCourse.courseName}
            </p>
            <p className="text-sm text-muted-foreground">
              Avg diff: {bestCourse.avgDifferential.toFixed(1)}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-orange-500/10 to-amber-500/10 border-orange-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              Challenging Course
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-semibold">
              {getFlagEmoji(worstCourse.country)} {worstCourse.courseName}
            </p>
            <p className="text-sm text-muted-foreground">
              Avg diff: {worstCourse.avgDifferential.toFixed(1)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Full Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">All Courses</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Course</TableHead>
                <TableHead className="text-right">Rounds</TableHead>
                <TableHead className="text-right">Avg Diff</TableHead>
                <TableHead className="text-right hidden md:table-cell">Best</TableHead>
                <TableHead className="text-right hidden md:table-cell">Worst</TableHead>
                <TableHead className="text-right hidden lg:table-cell">Avg Score</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {courses.map((course) => (
                <TableRow key={course.courseId}>
                  <TableCell>
                    <span className="mr-2">{getFlagEmoji(course.country)}</span>
                    {course.courseName}
                    <span className="text-muted-foreground text-xs ml-2 hidden sm:inline">
                      {course.city}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">{course.roundCount}</TableCell>
                  <TableCell className="text-right">
                    {course.avgDifferential.toFixed(1)}
                  </TableCell>
                  <TableCell className="text-right hidden md:table-cell">
                    {course.bestDifferential.toFixed(1)}
                  </TableCell>
                  <TableCell className="text-right hidden md:table-cell">
                    {course.worstDifferential.toFixed(1)}
                  </TableCell>
                  <TableCell className="text-right hidden lg:table-cell">
                    {Math.round(course.avgScore)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// Activity Tab Content
function ActivityTab({
  roundsPerMonth,
  holesPlayedStats,
}: {
  roundsPerMonth: ReturnType<typeof calculateRoundsPerMonth>;
  holesPlayedStats: HolesPlayedStats[];
}) {
  const nineHole = holesPlayedStats.find((stats) => stats.type === "9-hole");
  const eighteenHole = holesPlayedStats.find((stats) => stats.type === "18-hole");

  return (
    <div className="space-y-6">
      {/* Rounds Per Month Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Rounds Per Month</CardTitle>
        </CardHeader>
        <CardContent>
          <RoundsPerMonthChart data={roundsPerMonth} />
        </CardContent>
      </Card>

      {/* 9 vs 18 Hole Comparison */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Round Types</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center gap-8 md:gap-16 py-8">
            <div className="text-center">
              <div className="text-5xl md:text-6xl font-bold">{nineHole?.count || 0}</div>
              <p className="text-sm text-muted-foreground mt-2">9-Hole Rounds</p>
              {nineHole && nineHole.count > 0 && (
                <p className="text-xs text-muted-foreground">
                  Avg diff: {nineHole.avgDifferential.toFixed(1)}
                </p>
              )}
            </div>
            <div className="text-4xl text-muted-foreground font-light">vs</div>
            <div className="text-center">
              <div className="text-5xl md:text-6xl font-bold">{eighteenHole?.count || 0}</div>
              <p className="text-sm text-muted-foreground mt-2">18-Hole Rounds</p>
              {eighteenHole && eighteenHole.count > 0 && (
                <p className="text-xs text-muted-foreground">
                  Avg diff: {eighteenHole.avgDifferential.toFixed(1)}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
