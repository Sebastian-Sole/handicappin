import {
  CartesianGrid,
  XAxis,
  Bar,
  BarChart,
  Line,
  LineChart,
  YAxis,
} from "recharts";
import {
  ChartTooltipContent,
  ChartTooltip,
  ChartContainer,
} from "@/components/ui/chart";

function BarchartChart(props: any) {
  const { data } = props;
  return (
    <div {...props}>
      <ChartContainer
        config={{
          desktop: {
            label: "Desktop",
            color: "hsl(var(--chart-1))",
          },
        }}
        className="min-h-full"
      >
        <BarChart accessibilityLayer data={data}>
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
          <Bar dataKey="score" fill="var(--color-desktop)" radius={8} />
        </BarChart>
      </ChartContainer>
    </div>
  );
}

function LinechartChart(props: any) {
  const { data } = props;
  return (
    <div {...props}>
      <ChartContainer
        config={{
          desktop: {
            label: "Desktop",
            color: "hsl(var(--chart-1))",
          },
        }}
      >
        <LineChart
          accessibilityLayer
          data={data}
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
          <ChartTooltip
            cursor={false}
            content={<ChartTooltipContent hideLabel />}
          />
          <Line
            dataKey="desktop"
            type="natural"
            stroke="var(--color-desktop)"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ChartContainer>
    </div>
  );
}

export { BarchartChart, LinechartChart };
