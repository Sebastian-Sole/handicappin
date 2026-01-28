"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DayOfWeekChart } from "./day-of-week-chart";
import { TimeDistributionChart } from "./time-distribution-chart";
import { RoundsPerMonthChart } from "./rounds-per-month-chart";
import type {
  DayOfWeekStats,
  TimeOfDayStats,
  HolesPlayedStats,
  MonthlyRoundCount,
} from "@/types/statistics";

interface RoundInsightsSectionProps {
  dayOfWeekStats: DayOfWeekStats[];
  timeOfDayStats: TimeOfDayStats[];
  holesPlayedStats: HolesPlayedStats[];
  roundsPerMonth: MonthlyRoundCount[];
}

export function RoundInsightsSection({
  dayOfWeekStats,
  timeOfDayStats,
  holesPlayedStats,
  roundsPerMonth,
}: RoundInsightsSectionProps) {
  const nineHole = holesPlayedStats.find((stats) => stats.type === "9-hole");
  const eighteenHole = holesPlayedStats.find((stats) => stats.type === "18-hole");

  return (
    <section className="mb-8">
      <h2 className="text-xl font-semibold mb-4">Round Insights</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Day of Week Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Rounds by Day of Week</CardTitle>
          </CardHeader>
          <CardContent>
            <DayOfWeekChart data={dayOfWeekStats} />
          </CardContent>
        </Card>

        {/* Time of Day Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Time of Day</CardTitle>
          </CardHeader>
          <CardContent>
            <TimeDistributionChart data={timeOfDayStats} />
          </CardContent>
        </Card>

        {/* Rounds Per Month */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Rounds Per Month</CardTitle>
          </CardHeader>
          <CardContent>
            <RoundsPerMonthChart data={roundsPerMonth} />
          </CardContent>
        </Card>

        {/* 9 vs 18 Hole */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">9-Hole vs 18-Hole</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-center gap-8 py-8">
            <div className="text-center">
              <p className="text-4xl font-bold">{nineHole?.count || 0}</p>
              <p className="text-sm text-muted-foreground">9-Hole Rounds</p>
              {nineHole && nineHole.count > 0 && (
                <p className="text-xs text-muted-foreground">
                  Avg diff: {nineHole.avgDifferential.toFixed(1)}
                </p>
              )}
            </div>
            <div className="text-4xl text-muted-foreground">vs</div>
            <div className="text-center">
              <p className="text-4xl font-bold">{eighteenHole?.count || 0}</p>
              <p className="text-sm text-muted-foreground">18-Hole Rounds</p>
              {eighteenHole && eighteenHole.count > 0 && (
                <p className="text-xs text-muted-foreground">
                  Avg diff: {eighteenHole.avgDifferential.toFixed(1)}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
