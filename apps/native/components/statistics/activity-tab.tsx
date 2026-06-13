/**
 * Activity tab — native mirror of apps/web/components/statistics/activity/
 * activity-section.tsx (overview stats, rounds-per-month + day-of-week bar
 * charts, seasonal breakdown, round types, time-of-day chart).
 */
import { Text, View } from "react-native";

import { TokenBarChart } from "@/components/charts/token-bar-chart";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDecimal, formatDifferential } from "@/lib/statistics/format-utils";
import type {
  ActivityStats,
  DayOfWeekStats,
  HolesPlayedStats,
  MonthlyRoundCount,
  TimeOfDayStats,
} from "@/lib/statistics/types";
import { cn } from "@/lib/utils";

import { StatisticsSection } from "./shared";

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const MIN_MONTHS_DISPLAYED = 3;

function getPreviousMonth(month: string, year: number) {
  const monthIndex = MONTH_NAMES.indexOf(month);
  if (monthIndex <= 0) return { month: "Dec", year: year - 1 };
  return { month: MONTH_NAMES[monthIndex - 1]!, year };
}

function ensureMinimumMonths(data: MonthlyRoundCount[]): MonthlyRoundCount[] {
  if (data.length >= MIN_MONTHS_DISPLAYED) return data;
  const result = [...data];
  const earliest = result[0];
  if (!earliest) return result;
  let currentMonth = earliest.month;
  let currentYear = earliest.year;
  while (result.length < MIN_MONTHS_DISPLAYED) {
    const prev = getPreviousMonth(currentMonth, currentYear);
    result.unshift({ month: prev.month, year: prev.year, count: 0 });
    currentMonth = prev.month;
    currentYear = prev.year;
  }
  return result;
}

interface ActivityTabProps {
  roundsPerMonth: MonthlyRoundCount[];
  holesPlayedStats: HolesPlayedStats[];
  dayOfWeekStats: DayOfWeekStats[];
  timeOfDayStats: TimeOfDayStats[];
  activityStats: ActivityStats;
}

export function ActivityTab({
  roundsPerMonth,
  holesPlayedStats,
  dayOfWeekStats,
  timeOfDayStats,
  activityStats,
}: ActivityTabProps) {
  const nineHole = holesPlayedStats.find((stats) => stats.type === "9-hole");
  const eighteenHole = holesPlayedStats.find(
    (stats) => stats.type === "18-hole",
  );
  const hasNoData =
    roundsPerMonth.length === 0 &&
    dayOfWeekStats.every((day) => day.roundCount === 0);

  if (hasNoData) {
    return (
      <Card>
        <CardContent>
          <EmptyState
            title="No activity data yet"
            description="Play some rounds to see your activity patterns"
          />
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

  const seasonsWithRounds = activityStats.seasonalStats.filter(
    (s) => s.roundCount > 0,
  );
  const bestSeason =
    seasonsWithRounds.length > 0
      ? [...seasonsWithRounds].sort(
          (a, b) => a.avgDifferential - b.avgDifferential,
        )[0]
      : null;

  const monthChartData = ensureMinimumMonths(roundsPerMonth.slice(-12)).map(
    (m) => ({
      label: `${m.month} '${String(m.year).slice(2)}`,
      value: m.count,
    }),
  );
  const dayChartData = dayOfWeekStats.map((d) => ({
    label: d.day.substring(0, 3),
    value: d.roundCount,
  }));
  const timeChartData = timeOfDayStats.map((t) => ({
    label: t.period,
    value: t.roundCount,
  }));

  return (
    <View className="gap-xl" testID="activity-tab">
      <StatisticsSection
        icon="📊"
        title="Activity Overview"
        description="Track your playing frequency and round types"
      >
        <View className="gap-lg">
          <View className="flex-row flex-wrap gap-md">
            <View style={{ flexBasis: "45%", flexGrow: 1 }}>
              <Card>
                <CardContent className="p-md pt-md items-center">
                  <Text className="text-body-sm text-muted-foreground">
                    Avg Rounds/Month
                  </Text>
                  <Text className="text-figure text-foreground">
                    {formatDecimal(activityStats.avgRoundsPerMonth, 1)}
                  </Text>
                </CardContent>
              </Card>
            </View>
            <View style={{ flexBasis: "45%", flexGrow: 1 }}>
              <Card>
                <CardContent className="p-md pt-md items-center">
                  <Text className="text-body-sm text-muted-foreground">
                    Current Streak
                  </Text>
                  <Text className="text-figure text-foreground">
                    {activityStats.currentStreak > 0
                      ? `${activityStats.currentStreak} wk${activityStats.currentStreak !== 1 ? "s" : ""}`
                      : "--"}
                  </Text>
                  <Text className="text-meta text-muted-foreground text-center">
                    {activityStats.currentStreak > 0
                      ? "consecutive weeks playing"
                      : "play weekly to start a streak"}
                  </Text>
                </CardContent>
              </Card>
            </View>
            <View style={{ flexBasis: "45%", flexGrow: 1 }}>
              <Card>
                <CardContent className="p-md pt-md items-center">
                  <Text className="text-body-sm text-muted-foreground">
                    Longest Gap
                  </Text>
                  <Text className="text-figure text-foreground">
                    {activityStats.longestGap > 0
                      ? formatGap(activityStats.longestGap)
                      : "--"}
                  </Text>
                </CardContent>
              </Card>
            </View>
            {activityStats.mostActiveMonth ? (
              <View style={{ flexBasis: "45%", flexGrow: 1 }}>
                <Card className="tint-info">
                  <CardContent className="p-md pt-md items-center">
                    <Text className="text-body-sm text-muted-foreground">
                      Most Active
                    </Text>
                    <Text className="text-figure-xs text-foreground">
                      {activityStats.mostActiveMonth.month.substring(0, 3)}{" "}
                      {activityStats.mostActiveMonth.year}
                    </Text>
                    <Text className="text-meta text-muted-foreground">
                      {activityStats.mostActiveMonth.count} rounds
                    </Text>
                  </CardContent>
                </Card>
              </View>
            ) : null}
          </View>

          <Card>
            <CardHeader className="pb-sm">
              <Text className="text-heading-4 text-foreground">
                Rounds Per Month
              </Text>
            </CardHeader>
            <CardContent>
              <TokenBarChart data={monthChartData} testID="chart-rounds-per-month" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-sm">
              <Text className="text-heading-4 text-foreground">
                Rounds by Day of Week
              </Text>
            </CardHeader>
            <CardContent>
              <TokenBarChart data={dayChartData} testID="chart-day-of-week" />
            </CardContent>
          </Card>
        </View>
      </StatisticsSection>

      {seasonsWithRounds.length > 0 ? (
        <>
          <View className="h-px bg-border" />
          <StatisticsSection
            icon="🌤️"
            title="Seasonal Breakdown"
            description="How your game varies throughout the year"
          >
            <View className="flex-row flex-wrap gap-md">
              {activityStats.seasonalStats.map((season) => {
                const isBest =
                  bestSeason && season.season === bestSeason.season;
                return (
                  <View
                    key={season.season}
                    style={{ flexBasis: "45%", flexGrow: 1 }}
                  >
                    <Card className={cn(isBest && "tint-success")}>
                      <CardContent className="p-md pt-md items-center">
                        <Text className="text-label-sm text-foreground">
                          {season.season}
                        </Text>
                        <Text className="text-figure text-foreground">
                          {season.roundCount}
                        </Text>
                        <Text className="text-meta text-muted-foreground">
                          rounds
                        </Text>
                        {season.roundCount > 0 ? (
                          <Text className="text-meta text-muted-foreground mt-xs">
                            {formatDifferential(season.avgDifferential)} avg
                            diff
                          </Text>
                        ) : null}
                        {isBest ? (
                          <Text className="text-meta-strong text-success mt-xs">
                            Best season!
                          </Text>
                        ) : null}
                      </CardContent>
                    </Card>
                  </View>
                );
              })}
            </View>
          </StatisticsSection>
        </>
      ) : null}

      <View className="h-px bg-border" />

      <StatisticsSection
        icon="🎯"
        title="Play Patterns"
        description="Discover when you play your best golf"
        learnMoreContent="These patterns are calculated from your tee times. The best day is determined by your average score differential on that day of the week."
      >
        <View className="gap-lg">
          <Card>
            <CardHeader className="pb-sm">
              <Text className="text-heading-4 text-foreground">
                Round Types
              </Text>
            </CardHeader>
            <CardContent>
              <View className="flex-row items-center justify-center gap-xl py-md">
                <View className="items-center">
                  <Text className="text-figure-xl text-foreground">
                    {nineHole?.count ?? 0}
                  </Text>
                  <Text className="text-body-sm text-muted-foreground mt-xs">
                    9-Hole
                  </Text>
                  {nineHole && nineHole.count > 0 ? (
                    <Text className="text-meta text-muted-foreground">
                      {formatDifferential(nineHole.avgDifferential)} avg
                    </Text>
                  ) : null}
                </View>
                <Text className="text-heading-2 text-muted-foreground">
                  vs
                </Text>
                <View className="items-center">
                  <Text className="text-figure-xl text-foreground">
                    {eighteenHole?.count ?? 0}
                  </Text>
                  <Text className="text-body-sm text-muted-foreground mt-xs">
                    18-Hole
                  </Text>
                  {eighteenHole && eighteenHole.count > 0 ? (
                    <Text className="text-meta text-muted-foreground">
                      {formatDifferential(eighteenHole.avgDifferential)} avg
                    </Text>
                  ) : null}
                </View>
              </View>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-sm">
              <Text className="text-heading-4 text-foreground">
                Time of Day
              </Text>
            </CardHeader>
            <CardContent>
              <TokenBarChart data={timeChartData} testID="chart-time-of-day" />
            </CardContent>
          </Card>
        </View>
      </StatisticsSection>
    </View>
  );
}
