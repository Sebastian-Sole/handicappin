"use client";

import Link from "next/link";
import { H4, Muted } from "../ui/typography";
import { Button } from "../ui/button";

import { CartesianGrid, XAxis, Bar, BarChart, YAxis, Cell } from "recharts";
import {
  ChartTooltipContent,
  ChartTooltip,
  ChartContainer,
} from "@/components/ui/chart";
import { RefreshCcw } from "lucide-react";
import { useThemeColors } from "@/utils/theme-colors";

interface ScoreBarChartProps {
  scores: {
    roundDate: string;
    score: number;
    influencesHcp?: boolean;
  }[];
  className?: string;
}

const ScoreBarChart = ({ scores, className }: ScoreBarChartProps) => {
  const colors = useThemeColors();

  // Calculate evenly spaced ticks with clean numbers
  const minScore = Math.min(...scores.map((s) => s.score));
  const maxScore = Math.max(...scores.map((s) => s.score));

  // Find a nice range that covers the data with some padding
  const range = maxScore - minScore;
  const padding = 9;
  const totalRange = range + padding * 2;

  // Round to nearest 5 for cleaner tick spacing
  const tickSpacing = Math.ceil(totalRange / 6 / 5) * 5;

  // Calculate start value to center the range nicely
  const centerValue = (minScore + maxScore) / 2;
  const startValue = centerValue - tickSpacing * 3; // 3 intervals below center

  // Generate 7 evenly spaced ticks
  const tickValues = [];
  for (let i = 0; i <= 6; i++) {
    tickValues.push(startValue + i * tickSpacing);
  }

  return (
    <>
      {scores.length !== 0 && (
        <div className={`aspect-video ${className}`}>
          <ChartContainer
            config={{
              round: {
                label: "Desktop",
                color: "hsl(var(--chart-1))",
              },
            }}
            className="min-h-full"
          >
            <BarChart accessibilityLayer data={scores}>
              <XAxis
                dataKey="roundDate"
                tickLine={false}
                tickMargin={8}
                axisLine={false}
                tickFormatter={(value) => {
                  const dateParts = value.split(/[-\/.\s]/);
                  return `${dateParts[1]}/${dateParts[0]}`;
                }}
              />
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent hideLabel />}
              />
              <YAxis
                dataKey="score"
                tickLine={false}
                tickMargin={8}
                axisLine={false}
                domain={[minScore - padding, maxScore + padding]}
                ticks={tickValues}
              />
              <CartesianGrid strokeDasharray="5 5" />

              <Bar dataKey="score" radius={8}>
                {scores.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={
                      entry.influencesHcp
                        ? colors.barActive
                        : colors.barInactive
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
        </div>
      )}
      {className === "hidden sm:block" && scores.length !== 0 && (
        <div className={`flex justify-center mt-4 sm:hidden p-8`}>
          <Muted className="flex items-center">
            <RefreshCcw className="mr-2" />
            Rotate your device to view the chart
          </Muted>
        </div>
      )}

      {scores.length === 0 && (
        <div className="flex items-center justify-center h-64 xl:h-[90%] border border-gray-100 flex-col">
          <H4>No rounds found</H4>
          <Link
            href={`/rounds/add`}
            className="text-primary underline mt-4"
            prefetch={false}
          >
            <Button variant={"secondary"}>Add a round here</Button>
          </Link>
        </div>
      )}
    </>
  );
};

export default ScoreBarChart;
