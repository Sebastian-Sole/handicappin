"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DayOfWeekChart } from "../round-insights/day-of-week-chart";
import { TimeDistributionChart } from "../round-insights/time-distribution-chart";
import { BestTimeInsight } from "./best-time-insight";
import type { DayOfWeekStats, TimeOfDayStats } from "@/types/statistics";

interface PatternsSectionProps {
  dayOfWeekStats: DayOfWeekStats[];
  timeOfDayStats: TimeOfDayStats[];
}

export function PatternsSection({
  dayOfWeekStats,
  timeOfDayStats,
}: PatternsSectionProps) {
  return (
    <div className="space-y-6">
      {/* Best Time Insight Card */}
      <BestTimeInsight
        dayOfWeekStats={dayOfWeekStats}
        timeOfDayStats={timeOfDayStats}
      />

      {/* Charts Grid */}
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
      </div>
    </div>
  );
}
