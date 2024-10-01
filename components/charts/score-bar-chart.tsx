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

interface ScoreBarChartProps {
  scores: {
    roundDate: string;
    score: number;
    influencesHcp?: boolean;
  }[];
  className?: string;
}

const ScoreBarChart = ({ scores, className }: ScoreBarChartProps) => {
  return (
    <>
      {scores.length !== 0 && (
        <div className={`aspect-[16/9] ${className}`}>
          <ChartContainer
            config={{
              round: {
                label: "Desktop",
                color: "hsl(var(--primary))",
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
                tickCount={7}
                tickMargin={8}
                axisLine={false}
                domain={["dataMin - 10", "dataMax + 5"]}
              ></YAxis>
              <CartesianGrid strokeDasharray="5 5" />

              <Bar dataKey="score" radius={8}>
                {scores.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={
                      entry.influencesHcp
                        ? "hsl(var(--bar-active))"
                        : "hsl(var(--bar-inactive)/0.5)"
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
