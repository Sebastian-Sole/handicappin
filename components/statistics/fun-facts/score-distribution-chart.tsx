"use client";

import type { ScoreDistribution } from "@/types/statistics";

interface ScoreDistributionChartProps {
  data: ScoreDistribution;
}

const SCORE_TYPES = [
  { key: "eagle", label: "Eagle or better", emoji: "🦅", color: "bg-score-eagle" },
  { key: "birdie", label: "Birdie", emoji: "🐦", color: "bg-score-birdie" },
  { key: "par", label: "Par", emoji: "✓", color: "bg-score-par" },
  { key: "bogey", label: "Bogey", emoji: "😅", color: "bg-score-bogey" },
  { key: "doubleBogey", label: "Double Bogey", emoji: "😰", color: "bg-score-double" },
  { key: "triplePlus", label: "Triple+", emoji: "💀", color: "bg-score-triple" },
] as const;

export function ScoreDistributionChart({ data }: ScoreDistributionChartProps) {
  const total = Object.values(data).reduce((sum, item) => sum + item.count, 0);

  if (total === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground">
        No hole data available
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {SCORE_TYPES.map(({ key, label, emoji, color }) => {
        const item = data[key];
        return (
          <div key={key} className="space-y-1">
            <div className="flex justify-between text-sm">
              <span>
                {emoji} {label}
              </span>
              <span className="font-medium">
                {item.count} ({item.percentage.toFixed(1)}%)
              </span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full ${color} rounded-full transition-all`}
                style={{ width: `${item.percentage}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
