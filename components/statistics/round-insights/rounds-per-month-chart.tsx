"use client";

import { Bar, BarChart, XAxis, YAxis, CartesianGrid } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import type { MonthlyRoundCount } from "@/types/statistics";

interface RoundsPerMonthChartProps {
  data: MonthlyRoundCount[];
}

export function RoundsPerMonthChart({ data }: RoundsPerMonthChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground">
        No data available
      </div>
    );
  }

  const chartData = data.slice(-12).map((monthData) => ({
    month: `${monthData.month} '${String(monthData.year).slice(2)}`,
    count: monthData.count,
  }));

  return (
    <div className="aspect-video">
      <ChartContainer
        config={{
          count: {
            label: "Rounds",
            color: "hsl(var(--chart-1))",
          },
        }}
      >
        <BarChart data={chartData} accessibilityLayer>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="month"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            fontSize={10}
          />
          <YAxis tickLine={false} axisLine={false} tickMargin={8} />
          <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
          <Bar dataKey="count" fill="var(--color-count)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ChartContainer>
    </div>
  );
}
