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
    key: string;
    roundDate: string;
    roundTime: string;
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
  const padding = Math.max(2, range * 0.15); // At least 2 units padding, or 15% of range

  // Calculate nice tick spacing (prefer 5, 10, or multiples of 5)
  const totalRange = range + padding * 2;
  const roughSpacing = totalRange / 5; // Aim for ~5 intervals
  let tickSpacing;
  if (roughSpacing <= 2) {
    tickSpacing = 1;
  } else if (roughSpacing <= 5) {
    tickSpacing = 2;
  } else if (roughSpacing <= 10) {
    tickSpacing = 5;
  } else {
    tickSpacing = Math.ceil(roughSpacing / 5) * 5; // Round to nearest 5
  }

  // Calculate clean start value (round down to nearest tickSpacing)
  const rawStartValue = Math.max(0, minScore - padding);
  const startValue = Math.floor(rawStartValue / tickSpacing) * tickSpacing;

  // Calculate clean end value (round up to nearest tickSpacing)
  const rawEndValue = maxScore + padding;
  const endValue = Math.ceil(rawEndValue / tickSpacing) * tickSpacing;

  // Generate evenly spaced ticks
  const tickValues = [];
  for (let i = startValue; i <= endValue; i += tickSpacing) {
    tickValues.push(Math.round(i * 10) / 10); // Round to 1 decimal to avoid floating point errors
  }

  return (
    <>
      {scores.length !== 0 && (
        <div className={`aspect-video ${className}`}>
          <ChartContainer
            config={{
              score: {
                label: "Score Differential",
                color: "hsl(var(--chart-1))",
              },
            }}
            className="min-h-full"
          >
            <BarChart accessibilityLayer data={scores}>
              <XAxis
                dataKey="key"
                tickLine={false}
                tickMargin={8}
                axisLine={false}
                tickFormatter={(value, index) => {
                  const dataPoint = scores[index];
                  if (dataPoint?.roundDate) {
                    const dateParts = dataPoint.roundDate.split(/[-\/.\s]/);
                    return `${dateParts[1]}/${dateParts[0]}`;
                  }
                  return value;
                }}
              />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    labelFormatter={(value, payload) => {
                      if (payload && payload[0]?.payload) {
                        const data = payload[0].payload;
                        return `${data.roundDate} at ${data.roundTime}`;
                      }
                      return value;
                    }}
                    formatter={(value, _name, props) => {
                      const color = props.payload.fill || colors.barActive;
                      return (
                        <div className="flex w-full items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <div
                              className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
                              style={{ backgroundColor: color }}
                            />
                            <span className="text-muted-foreground">
                              Score Differential
                            </span>
                          </div>
                          <span className="font-mono font-medium tabular-nums text-foreground">
                            {value}
                          </span>
                        </div>
                      );
                    }}
                  />
                }
              />
              <YAxis
                dataKey="score"
                tickLine={false}
                tickMargin={8}
                axisLine={false}
                domain={[startValue, endValue]}
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
