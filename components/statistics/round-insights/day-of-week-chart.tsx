"use client";

import { Bar, BarChart, XAxis, YAxis, CartesianGrid } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import type { DayOfWeekStats } from "@/types/statistics";

interface DayOfWeekChartProps {
  data: DayOfWeekStats[];
}

export function DayOfWeekChart({ data }: DayOfWeekChartProps) {
  const chartData = data.map((dayStats) => ({
    day: dayStats.day.substring(0, 3),
    rounds: dayStats.roundCount,
    avgDiff: dayStats.avgDifferential,
  }));

  if (data.every((dayStats) => dayStats.roundCount === 0)) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground">
        No data available
      </div>
    );
  }

  return (
    <div className="aspect-video">
      <ChartContainer
        config={{
          rounds: {
            label: "Rounds",
            color: "hsl(var(--chart-1))",
          },
        }}
      >
        <BarChart data={chartData} accessibilityLayer>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} />
          <YAxis tickLine={false} axisLine={false} tickMargin={8} />
          <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
          <Bar dataKey="rounds" fill="var(--color-rounds)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ChartContainer>
    </div>
  );
}
