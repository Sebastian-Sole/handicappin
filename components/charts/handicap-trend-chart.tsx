"use client";

import Link from "next/link";
import { H4 } from "../ui/typography";
import { Button } from "../ui/button";
import { CartesianGrid, XAxis, Line, LineChart, YAxis } from "recharts";
import {
  ChartTooltipContent,
  ChartTooltip,
  ChartContainer,
} from "@/components/ui/chart";
import { useEffect, useState } from "react";

interface HandicapTrendChartProps {
  previousHandicaps: {
    roundDate: string;
    handicap: number;
  }[];
  isPositive: boolean;
}

const HandicapTrendChart = ({
  previousHandicaps,
  isPositive,
}: HandicapTrendChartProps) => {
  const [strokeColor, setStrokeColor] = useState<string>("");

  useEffect(() => {
    const value = getComputedStyle(document.documentElement)
      .getPropertyValue("--chart-1")
      .trim();
    setStrokeColor(value);
  }, [isPositive]);

  return (
    <>
      {previousHandicaps.length !== 0 && (
        <div className="aspect-video">
          <ChartContainer
            config={{
              desktop: {
                label: "Score",
                color: "hsl(var(--chart-1))",
              },
            }}
          >
            <LineChart
              accessibilityLayer
              data={previousHandicaps}
              margin={{
                left: 12,
                right: 12,
              }}
            >
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="roundDate"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tickFormatter={(value) => {
                  const dateParts = value.split(/[-\/.\s]/);
                  return `${dateParts[0]}/${dateParts[1]}`;
                }}
              />
              <YAxis
                dataKey="handicap"
                tickLine={false}
                tickMargin={8}
                axisLine={false}
                domain={[18, 54]}
              />
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent hideLabel />}
              />
              <Line
                dataKey="handicap"
                type="natural"
                stroke={strokeColor}
                strokeWidth={2}
                dot={true}
              />
            </LineChart>
          </ChartContainer>
        </div>
      )}
      {previousHandicaps.length === 0 && (
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

export default HandicapTrendChart;
