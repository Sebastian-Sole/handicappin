"use client";

import { Bar, BarChart, XAxis, YAxis, CartesianGrid } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { formatNumber } from "@/lib/statistics/format-utils";
import type { DayOfWeekStats } from "@/types/statistics";

interface StrokesByDayChartProps {
  data: DayOfWeekStats[];
}

export function StrokesByDayChart({ data }: StrokesByDayChartProps) {
  const chartData = data.map((dayStats) => ({
    day: dayStats.day.substring(0, 3),
    strokes: dayStats.totalStrokes,
    rounds: dayStats.roundCount,
  }));

  const hasData = data.some((dayStats) => dayStats.totalStrokes > 0);

  if (!hasData) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground">
        No stroke data available
      </div>
    );
  }

  // Find the day with most strokes for the insight
  const maxStrokesDay = [...data]
    .filter((day) => day.totalStrokes > 0)
    .sort((a, b) => b.totalStrokes - a.totalStrokes)[0];

  return (
    <div className="space-y-4">
      <ChartContainer
        className="h-48 w-full"
        config={{
          strokes: {
            label: "Total Strokes",
            color: "var(--primary)",
          },
        }}
      >
          <BarChart data={chartData} accessibilityLayer>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} />
            <YAxis tickLine={false} axisLine={false} tickMargin={8} />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  formatter={(value, name, props) => {
                    const rounds = props.payload.rounds;
                    return (
                      <span>
                        {formatNumber(value as number)} strokes ({rounds} rounds)
                      </span>
                    );
                  }}
                />
              }
            />
            <Bar dataKey="strokes" fill="var(--color-strokes)" radius={[4, 4, 0, 0]} />
          </BarChart>
      </ChartContainer>
      {maxStrokesDay && (
        <p className="text-sm text-center text-muted-foreground">
          You&apos;ve hit the most strokes on{" "}
          <span className="font-medium text-foreground">{maxStrokesDay.day}s</span> (
          {formatNumber(maxStrokesDay.totalStrokes)} strokes across{" "}
          {maxStrokesDay.roundCount} rounds)
        </p>
      )}
    </div>
  );
}
