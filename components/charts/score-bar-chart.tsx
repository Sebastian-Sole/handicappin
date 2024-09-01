"use client";

import Link from "next/link";
import { H4 } from "../ui/typography";
import { Button } from "../ui/button";

import { CartesianGrid, XAxis, Bar, BarChart, YAxis } from "recharts";
import {
  ChartTooltipContent,
  ChartTooltip,
  ChartContainer,
} from "@/components/ui/chart";

interface ScoreBarChartProps {
  scores: {
    roundDate: string;
    score: number;
  }[];
}

const ScoreBarChart = ({ scores }: ScoreBarChartProps) => {
  return (
    <>
      {scores.length !== 0 && (
        <div className="aspect-[16/9]">
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
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="roundDate"
                tickLine={false}
                tickMargin={8}
                axisLine={false}
                tickFormatter={(value) => {
                  const dateParts = value.split(/[-\/.\s]/);
                  return `${dateParts[0]}/${dateParts[1]}`;
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
              ></YAxis>
              <Bar dataKey="score" fill="var(--color-round)" radius={8} />
            </BarChart>
          </ChartContainer>
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
