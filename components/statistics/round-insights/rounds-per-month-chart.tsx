"use client";

import { Bar, BarChart, XAxis, YAxis, CartesianGrid } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import type { MonthlyRoundCount } from "@/types/statistics";

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

const MIN_MONTHS_DISPLAYED = 3;

function getPreviousMonth(month: string, year: number): { month: string; year: number } {
  const monthIndex = MONTH_NAMES.indexOf(month);
  if (monthIndex === 0) {
    return { month: "Dec", year: year - 1 };
  }
  return { month: MONTH_NAMES[monthIndex - 1], year };
}

function ensureMinimumMonths(data: MonthlyRoundCount[]): MonthlyRoundCount[] {
  if (data.length >= MIN_MONTHS_DISPLAYED) {
    return data;
  }

  const result = [...data];

  // Get the earliest month in the data
  const earliest = result[0];
  if (!earliest) return result;

  // Add months before the earliest until we have minimum
  let currentMonth = earliest.month;
  let currentYear = earliest.year;

  while (result.length < MIN_MONTHS_DISPLAYED) {
    const prev = getPreviousMonth(currentMonth, currentYear);
    result.unshift({
      month: prev.month,
      year: prev.year,
      count: 0,
    });
    currentMonth = prev.month;
    currentYear = prev.year;
  }

  return result;
}

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

  const paddedData = ensureMinimumMonths(data.slice(-12));
  const chartData = paddedData.map((monthData) => ({
    month: `${monthData.month} '${String(monthData.year).slice(2)}`,
    count: monthData.count,
  }));

  return (
    <ChartContainer
      className="h-48 w-full"
      config={{
        count: {
          label: "Rounds",
          color: "var(--primary)",
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
  );
}
