"use client";

import type { TimeOfDayStats } from "@/types/statistics";

interface TimeDistributionChartProps {
  data: TimeOfDayStats[];
}

const PERIOD_INFO = {
  morning: { label: "Morning", emoji: "🌅", range: "Before 12pm" },
  afternoon: { label: "Afternoon", emoji: "☀️", range: "12pm - 5pm" },
  evening: { label: "Evening", emoji: "🌇", range: "After 5pm" },
};

export function TimeDistributionChart({ data }: TimeDistributionChartProps) {
  const total = data.reduce((sum, period) => sum + period.roundCount, 0);

  if (total === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground">
        No data available
      </div>
    );
  }

  return (
    <div className="space-y-4 py-4">
      {data.map((period) => {
        const info = PERIOD_INFO[period.period];
        const percentage = (period.roundCount / total) * 100;

        return (
          <div key={period.period} className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>
                {info.emoji} {info.label}
                <span className="text-muted-foreground ml-2 text-xs">
                  ({info.range})
                </span>
              </span>
              <span className="font-medium">
                {period.roundCount} ({percentage.toFixed(0)}%)
              </span>
            </div>
            <div className="h-3 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
