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
import { useThemeColors } from "@/utils/theme-colors";

interface HandicapTrendChartProps {
  previousHandicaps: {
    key: string;
    roundDate: string;
    roundTime: string;
    handicap: number;
  }[];
  isPositive: boolean;
}

const HandicapTrendChart = ({
  previousHandicaps,
  isPositive,
}: HandicapTrendChartProps) => {
  const colors = useThemeColors();
  const strokeColor = isPositive ? colors.destructive : colors.primary;

  // Calculate dynamic Y-axis range with padding
  const hasData = previousHandicaps.length > 0;
  const minHandicap = hasData
    ? Math.min(...previousHandicaps.map((h) => h.handicap))
    : 0;
  const maxHandicap = hasData
    ? Math.max(...previousHandicaps.map((h) => h.handicap))
    : 54;
  const range = maxHandicap - minHandicap;
  const padding = Math.max(2, range * 0.2); // At least 2 units padding, or 20% of range

  // Calculate nice tick spacing
  const totalRange = range + padding * 2;
  const tickSpacing = Math.ceil(totalRange / 5);
  const startValue = Math.max(0, Math.floor(minHandicap - padding));
  const endValue = Math.min(54, Math.ceil(maxHandicap + padding));

  // Generate tick values
  const tickValues = [];
  for (let i = startValue; i <= endValue; i += tickSpacing) {
    tickValues.push(i);
  }
  // Ensure we have at least the min and max
  if (!tickValues.includes(startValue)) tickValues.unshift(startValue);
  if (!tickValues.includes(endValue)) tickValues.push(endValue);

  return (
    <>
      {previousHandicaps.length !== 0 && (
        <div className="aspect-video">
          <ChartContainer
            config={{
              handicap: {
                label: "Handicap Index",
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
                dataKey="key"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tickFormatter={(value, index) => {
                  const dataPoint = previousHandicaps[index];
                  if (dataPoint?.roundDate) {
                    const dateParts = dataPoint.roundDate.split(/[-\/.\s]/);
                    return `${dateParts[1]}/${dateParts[0]}`;
                  }
                  return value;
                }}
              />
              <YAxis
                dataKey="handicap"
                tickLine={false}
                tickMargin={8}
                axisLine={false}
                domain={[startValue, endValue]}
                ticks={tickValues}
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
                      const color = props.color || strokeColor;
                      return (
                        <div className="flex w-full items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <div
                              className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
                              style={{ backgroundColor: color }}
                            />
                            <span className="text-muted-foreground">
                              Handicap Index
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
