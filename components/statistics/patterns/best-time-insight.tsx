"use client";

import { Card, CardContent } from "@/components/ui/card";
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
  const daysWithRounds = dayOfWeekStats.filter((day) => day.roundCount > 0);
  if (daysWithRounds.length === 0) {
    return null;
  }

  const bestDay = [...daysWithRounds].sort(
    (a, b) => a.avgDifferential - b.avgDifferential
  )[0];

  // Find best time of day (lowest avg score among periods with rounds)
  const timesWithRounds = timeOfDayStats.filter((time) => time.roundCount > 0);
  const bestTime =
    timesWithRounds.length > 0
      ? [...timesWithRounds].sort((a, b) => a.avgScore - b.avgScore)[0]
      : null;

  // Calculate overall average differential for comparison
  const overallAvgDifferential =
    daysWithRounds.reduce(
      (sum, day) => sum + day.avgDifferential * day.roundCount,
      0
    ) / daysWithRounds.reduce((sum, day) => sum + day.roundCount, 0);

  const strokesDifference = overallAvgDifferential - bestDay.avgDifferential;
  const hasSignificantDifference = strokesDifference >= 0.5;

  // Build the insight message
  let insightMessage = "";
  if (hasSignificantDifference) {
    insightMessage = `You play ${strokesDifference.toFixed(1)} strokes better on ${bestDay.day}s`;
    if (bestTime) {
      insightMessage += ` ${TIME_PERIOD_LABELS[bestTime.period]}`;
    }
  } else {
    insightMessage = `Your best day is ${bestDay.day}`;
    if (bestTime) {
      insightMessage += ` ${TIME_PERIOD_LABELS[bestTime.period]}`;
    }
  }

  return (
    <Card className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 border-green-500/20">
      <CardContent className="p-6">
        <div className="flex items-center gap-4">
          <div className="text-4xl">🎯</div>
          <div>
            <h3 className="font-semibold text-lg">When You Play Best</h3>
            <p className="text-muted-foreground">{insightMessage}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {bestDay.day}: {bestDay.avgDifferential.toFixed(1)} avg differential ({bestDay.roundCount} rounds)
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
