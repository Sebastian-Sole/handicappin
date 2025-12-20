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
          round: {
            label: "Desktop",
            color: "hsl(var(--primary))",
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
          />
          <Bar dataKey="score" fill="var(--color-round)" radius={8} />
        </BarChart>
      </ChartContainer>
    </div>
  );
}

interface LinechartChartProps {
  data: any;
  className?: string;
  isPositive?: string;
}
function LinechartChart({ data, className, isPositive }: LinechartChartProps) {
  return (
    <div className={className}>
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
              return `${dateParts[1]}/${dateParts[0]}`;
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
            stroke={
              isPositive ? "hsl(var(--destructive))" : "hsl(var(--primary))"
            }
            strokeWidth={2}
            dot={true}
          />
        </LineChart>
      </ChartContainer>
    </div>
  );
}

export { BarchartChart, LinechartChart };
