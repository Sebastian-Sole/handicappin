"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { StatisticsSection } from "../shared/statistics-section";
import { RoundsPerMonthChart } from "../round-insights/rounds-per-month-chart";
import { DayOfWeekChart } from "../round-insights/day-of-week-chart";
import { TimeDistributionChart } from "../round-insights/time-distribution-chart";
import { BestTimeInsight } from "../patterns/best-time-insight";
import { formatDifferential, formatDecimal } from "@/lib/statistics/format-utils";
import type {
  MonthlyRoundCount,
  HolesPlayedStats,
  DayOfWeekStats,
  TimeOfDayStats,
  ActivityStats,
} from "@/types/statistics";

interface ActivitySectionProps {
  roundsPerMonth: MonthlyRoundCount[];
  holesPlayedStats: HolesPlayedStats[];
  dayOfWeekStats: DayOfWeekStats[];
  timeOfDayStats: TimeOfDayStats[];
  activityStats: ActivityStats;
}

export function ActivitySection({
  roundsPerMonth,
  holesPlayedStats,
  dayOfWeekStats,
  timeOfDayStats,
  activityStats,
}: ActivitySectionProps) {
  const nineHole = holesPlayedStats.find((stats) => stats.type === "9-hole");
  const eighteenHole = holesPlayedStats.find((stats) => stats.type === "18-hole");

  const hasNoData =
    roundsPerMonth.length === 0 &&
    dayOfWeekStats.every((day) => day.roundCount === 0);

  if (hasNoData) {
    return (
      <Card>
        <CardContent className="p-12 text-center text-muted-foreground">
          <div className="text-4xl mb-4">📊</div>
          <p className="text-lg font-medium">No activity data yet</p>
          <p className="text-sm">Play some rounds to see your activity patterns</p>
        </CardContent>
      </Card>
    );
  }

  const formatGap = (days: number): string => {
    if (days < 7) return `${days} day${days !== 1 ? "s" : ""}`;
    if (days < 30) {
      const weeks = Math.floor(days / 7);
      return `${weeks} week${weeks !== 1 ? "s" : ""}`;
    }
    const months = Math.floor(days / 30);
    return `${months} month${months !== 1 ? "s" : ""}`;
  };

  // Find best and worst seasons
  const seasonsWithRounds = activityStats.seasonalStats.filter((s) => s.roundCount > 0);
  const bestSeason =
    seasonsWithRounds.length > 0
      ? [...seasonsWithRounds].sort((a, b) => a.avgDifferential - b.avgDifferential)[0]
      : null;

  return (
    <div className="space-y-8">
      {/* Activity Overview Section */}
      <StatisticsSection
        icon="📊"
        title="Activity Overview"
        description="Track your playing frequency and round types"
      >
        <div className="space-y-6">
          {/* Quick Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-sm text-muted-foreground">Avg Rounds/Month</p>
                <p className="text-2xl font-bold">
                  {formatDecimal(activityStats.avgRoundsPerMonth, 1)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-sm text-muted-foreground">Current Streak</p>
                <p className="text-2xl font-bold">
                  {activityStats.currentStreak > 0
                    ? `${activityStats.currentStreak} week${activityStats.currentStreak !== 1 ? "s" : ""}`
                    : "--"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {activityStats.currentStreak > 0
                    ? "consecutive weeks playing"
                    : "play weekly to start a streak"}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-sm text-muted-foreground">Longest Gap</p>
                <p className="text-2xl font-bold">
                  {activityStats.longestGap > 0
                    ? formatGap(activityStats.longestGap)
                    : "--"}
                </p>
              </CardContent>
            </Card>
            {activityStats.mostActiveMonth && (
              <Card className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border-blue-500/20">
                <CardContent className="p-4 text-center">
                  <p className="text-sm text-muted-foreground">Most Active</p>
                  <p className="text-lg font-bold">
                    {activityStats.mostActiveMonth.month.substring(0, 3)}{" "}
                    {activityStats.mostActiveMonth.year}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {activityStats.mostActiveMonth.count} rounds
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Rounds Per Month Chart */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Rounds Per Month</CardTitle>
              </CardHeader>
              <CardContent>
                <RoundsPerMonthChart data={roundsPerMonth} />
              </CardContent>
            </Card>

            {/* Day of Week Chart */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Rounds by Day of Week</CardTitle>
              </CardHeader>
              <CardContent>
                <DayOfWeekChart data={dayOfWeekStats} />
              </CardContent>
            </Card>
          </div>
        </div>
      </StatisticsSection>

      <Separator />

      {/* Seasonal Breakdown */}
      {seasonsWithRounds.length > 0 && (
        <>
          <StatisticsSection
            icon="🌤️"
            title="Seasonal Breakdown"
            description="How your game varies throughout the year"
          >
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {activityStats.seasonalStats.map((season) => {
                const isBest = bestSeason && season.season === bestSeason.season;
                return (
                  <Card
                    key={season.season}
                    className={
                      isBest
                        ? "bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-green-500/20"
                        : ""
                    }
                  >
                    <CardContent className="p-4 text-center flex flex-col justify-center min-h-[130px]">
                      <p className="text-sm font-medium">{season.season}</p>
                      <p className="text-2xl font-bold">{season.roundCount}</p>
                      <p className="text-xs text-muted-foreground">rounds</p>
                      {season.roundCount > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDifferential(season.avgDifferential)} avg diff
                        </p>
                      )}
                      {isBest && (
                        <p className="text-xs text-green-600 font-medium mt-1">
                          Best season!
                        </p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </StatisticsSection>
          <Separator />
        </>
      )}

      {/* Play Patterns Section */}
      <StatisticsSection
        icon="🎯"
        title="Play Patterns"
        description="Discover when you play your best golf"
        learnMoreContent={
          <p>
            These patterns are calculated from your tee times. Understanding when you
            perform best can help you schedule rounds for optimal results. The
            &quot;best day&quot; is determined by your average score differential on
            that day of the week.
          </p>
        }
      >
        <div className="space-y-6">
          {/* Best Time Insight Card */}
          <BestTimeInsight
            dayOfWeekStats={dayOfWeekStats}
            timeOfDayStats={timeOfDayStats}
          />

          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 9 vs 18 Hole Comparison */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Round Types</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-center min-h-[140px]">
                <div className="flex items-center justify-center gap-8 md:gap-12">
                  <div className="text-center">
                    <div className="text-4xl md:text-5xl font-bold">
                      {nineHole?.count ?? 0}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">9-Hole</p>
                    {nineHole && nineHole.count > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {formatDifferential(nineHole.avgDifferential)} avg
                      </p>
                    )}
                  </div>
                  <div className="text-3xl text-muted-foreground font-light">vs</div>
                  <div className="text-center">
                    <div className="text-4xl md:text-5xl font-bold">
                      {eighteenHole?.count ?? 0}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">18-Hole</p>
                    {eighteenHole && eighteenHole.count > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {formatDifferential(eighteenHole.avgDifferential)} avg
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Time of Day Distribution */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Time of Day</CardTitle>
              </CardHeader>
              <CardContent>
                <TimeDistributionChart data={timeOfDayStats} />
              </CardContent>
            </Card>
          </div>
        </div>
      </StatisticsSection>
    </div>
  );
}
