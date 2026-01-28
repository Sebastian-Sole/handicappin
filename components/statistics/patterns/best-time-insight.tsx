"use client";

import { Card, CardContent } from "@/components/ui/card";
import { formatDifferential, isValidNumber } from "@/lib/statistics/format-utils";
import type { DayOfWeekStats, TimeOfDayStats } from "@/types/statistics";

interface BestTimeInsightProps {
  dayOfWeekStats: DayOfWeekStats[];
  timeOfDayStats: TimeOfDayStats[];
}

const TIME_PERIOD_LABELS = {
  morning: "in the morning",
  afternoon: "in the afternoon",
  evening: "in the evening",
};

export function BestTimeInsight({
  dayOfWeekStats,
  timeOfDayStats,
}: BestTimeInsightProps) {
  // Find best day of week (lowest avg differential among days with rounds)
  const daysWithRounds = dayOfWeekStats.filter(
    (day) => day.roundCount > 0 && isValidNumber(day.avgDifferential)
  );
  if (daysWithRounds.length === 0) {
    return null;
  }

  const bestDay = [...daysWithRounds].sort(
    (a, b) => a.avgDifferential - b.avgDifferential
  )[0];

  // Find best time of day (lowest avg score among periods with rounds)
  const timesWithRounds = timeOfDayStats.filter(
    (time) => time.roundCount > 0 && isValidNumber(time.avgScore)
  );
  const bestTime =
    timesWithRounds.length > 0
      ? [...timesWithRounds].sort((a, b) => a.avgScore - b.avgScore)[0]
      : null;

  // Calculate overall average differential for comparison
  const totalRounds = daysWithRounds.reduce((sum, day) => sum + day.roundCount, 0);
  const overallAvgDifferential =
    totalRounds > 0
      ? daysWithRounds.reduce(
          (sum, day) => sum + day.avgDifferential * day.roundCount,
          0
        ) / totalRounds
      : 0;

  const strokesDifference = overallAvgDifferential - bestDay.avgDifferential;
  const hasSignificantDifference =
    isValidNumber(strokesDifference) && strokesDifference >= 0.5;

  // Build the insight message - keep day and time as separate observations
  // since they are computed independently (not a cross-analysis of day×time)
  let dayInsight = "";
  if (hasSignificantDifference) {
    dayInsight = `You play ${strokesDifference.toFixed(1)} strokes better on ${bestDay.day}s.`;
  } else {
    dayInsight = `Your best day is ${bestDay.day}.`;
  }

  let timeInsight = "";
  if (bestTime) {
    timeInsight = ` You also tend to play better ${TIME_PERIOD_LABELS[bestTime.period]}.`;
  }

  const insightMessage = dayInsight + timeInsight;

  return (
    <Card className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 border-green-500/20">
      <CardContent className="p-6">
        <div className="flex items-center gap-4">
          <div className="text-4xl">🎯</div>
          <div>
            <h3 className="font-semibold text-lg">When You Play Best</h3>
            <p className="text-muted-foreground">{insightMessage}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {bestDay.day}: {formatDifferential(bestDay.avgDifferential)} avg
              differential ({bestDay.roundCount} rounds)
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
